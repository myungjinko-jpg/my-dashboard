import { useMemo, useState } from "react";
import {
  hasAnyMetricData, parseDateValue, formatCurrency, formatPercent,
  formatNumber, getWeightedCpi, getWeightedRetention, getWeightedD0Playtime,
} from "../utils";

function fmtDate(ts) {
  if (!ts) return "-";
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

const STATUS_STYLE = {
  TESTING:     { fg: "#B45309", bg: "rgba(245,180,0,0.14)" },
  COMPLETED:   { fg: "#16A34A", bg: "rgba(22,163,74,0.12)" },
  REGISTERING: { fg: "#6B7280", bg: "rgba(107,114,128,0.12)" },
};

// 타이틀 기반 색 아이콘 (해시 → HSL)
function titleColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${h}, 62%, 60%)`;
}

export default function OverviewTable({ rawData, selectedProject, onSelect }) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("TESTING");

  const rows = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const twoDaysAgo = new Date(today); twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    // 프로젝트별 그룹
    const byProject = {};
    rawData.forEach((row) => {
      if (!row.Project) return;
      (byProject[row.Project] = byProject[row.Project] || []).push(row);
    });

    return Object.entries(byProject).map(([project, allRows]) => {
      // 이번 테스트 = 가장 최근 데이터가 속한 이터레이션 (번호 순서가 아니라 실제 날짜 기준)
      const latestTs = Math.max(...allRows.map((r) => parseDateValue(r.Date) || 0));
      const latestRow = allRows.find((r) => (parseDateValue(r.Date) || 0) === latestTs);
      const currentIteration = latestRow?.Iteration || "";
      const iterRows = allRows.filter((r) => r.Iteration === currentIteration);
      const metricRows = iterRows.filter(hasAnyMetricData);

      const latestDate = new Date(latestTs); latestDate.setHours(0, 0, 0, 0);
      const isLive = latestTs > 0 && latestDate >= twoDaysAgo;

      // 시작 날짜 = 이번 테스트(현재 이터레이션)의 첫 데이터 날짜
      const iterTs = iterRows.map((r) => parseDateValue(r.Date)).filter(Boolean);
      const startTs = iterTs.length ? Math.min(...iterTs) : null;

      const hasMetric = metricRows.length > 0;
      const status = !hasMetric ? "REGISTERING" : (isLive ? "TESTING" : "COMPLETED");

      return {
        project,
        iteration: currentIteration || "",
        date: startTs,
        sortTs: latestTs,
        status,
        isLive,
        cpi: hasMetric ? getWeightedCpi(metricRows) : null,
        d1: hasMetric ? getWeightedRetention(metricRows) : null,
        d0pt: hasMetric ? getWeightedD0Playtime(metricRows) : null,
      };
    })
    // 라이브 우선 → 최신 활동일 내림차순
    .sort((a, b) => (b.isLive - a.isLive) || ((b.sortTs || 0) - (a.sortTs || 0)));
  }, [rawData]);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (kw && !r.project.toLowerCase().includes(kw)) return false;
      return true;
    });
  }, [rows, q, statusFilter]);

  // 타이틀 4 : 나머지 6 (데이터 6컬럼 균등)
  const GRID = "minmax(220px, 4fr) repeat(6, 1fr)";
  const th = { fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", padding: "0 12px", textAlign: "left" };
  const thC = { ...th, textAlign: "center" };
  const td = { fontSize: 13, padding: "0 12px", color: "var(--text)", textAlign: "center" };

  return (
    <div style={{ border: "1px solid var(--card-border)", borderRadius: 12, overflow: "hidden", background: "var(--card)" }}>
      {/* 필터 바 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search game title…"
          style={{ flex: 1, minWidth: 180, padding: "7px 12px", fontSize: 13, border: "1px solid var(--card-border)", borderRadius: 8, background: "var(--bg)", color: "var(--text)" }} />
        <div style={{ display: "flex", gap: 4 }}>
          {[["all", "All"], ["TESTING", "Testing"], ["COMPLETED", "Completed"], ["REGISTERING", "Registering"]].map(([k, label]) => {
            const active = statusFilter === k;
            return (
              <button key={k} onClick={() => setStatusFilter(k)}
                style={{ fontSize: 12, fontWeight: active ? 700 : 500, padding: "6px 12px", borderRadius: 8, border: `1px solid ${active ? "var(--primary)" : "var(--card-border)"}`, background: active ? "var(--primary-light)" : "var(--card)", color: active ? "var(--primary)" : "var(--muted)", cursor: "pointer" }}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 헤더 */}
      <div style={{ display: "grid", gridTemplateColumns: GRID, alignItems: "center", height: 38, borderBottom: "1px solid var(--line)", background: "var(--card-bg-subtle)" }}>
        <span style={th}>GAME TITLE</span>
        <span style={thC}>START DATE</span>
        <span style={thC}>STATUS</span>
        <span style={thC}>TYPE</span>
        <span style={thC}>CPI</span>
        <span style={thC}>D1 RET</span>
        <span style={thC}>D0 PLAYTIME</span>
      </div>

      {/* 행 */}
      <div style={{ maxHeight: 420, overflowY: "auto" }}>
        {filtered.length === 0 && (
          <div style={{ padding: 30, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No projects to show.</div>
        )}
        {filtered.map((r) => {
          const sel = r.project === selectedProject;
          const ss = STATUS_STYLE[r.status];
          return (
            <div key={r.project} onClick={() => onSelect(r.project)}
              style={{
                display: "grid", gridTemplateColumns: GRID, alignItems: "center",
                height: 52, borderBottom: "1px solid var(--line)", cursor: "pointer",
                background: sel ? "var(--primary-light)" : "var(--card)",
                borderLeft: `3px solid ${sel ? "var(--primary)" : "transparent"}`,
              }}
              onMouseEnter={(e) => { if (!sel) e.currentTarget.style.background = "var(--card-bg-subtle)"; }}
              onMouseLeave={(e) => { if (!sel) e.currentTarget.style.background = "var(--card)"; }}>
              <span style={{ ...td, display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <span style={{ width: 26, height: 26, borderRadius: 7, background: titleColor(r.project), flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700 }}>
                  {r.project.replace(/^[[(].*?[\])]\s*/, "").charAt(0).toUpperCase()}
                </span>
                <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.project}</span>
                {r.status === "TESTING" && <span title="테스트 진행중" style={{ width: 7, height: 7, borderRadius: "50%", background: "#DC2626", flexShrink: 0 }} />}
              </span>
              <span style={{ ...td, fontSize: 12, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{fmtDate(r.date)}</span>
              <span style={{ ...td, display: "flex", justifyContent: "center" }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".03em", padding: "3px 8px", borderRadius: 4, background: ss.bg, color: ss.fg }}>{r.status}</span>
              </span>
              <span style={{ ...td, fontSize: 12, color: "var(--muted)" }}>{r.iteration || "-"}</span>
              <span style={{ ...td, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{r.cpi ? formatCurrency(r.cpi) : "-"}</span>
              <span style={{ ...td, fontVariantNumeric: "tabular-nums" }}>{r.d1 != null && r.d1 >= 0 ? formatPercent(r.d1) : "-"}</span>
              <span style={{ ...td, fontVariantNumeric: "tabular-nums", color: "var(--muted)" }}>{r.d0pt ? `${formatNumber(Math.round(r.d0pt))}s` : "-"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
