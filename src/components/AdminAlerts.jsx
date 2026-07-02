import { useCallback, useEffect, useState } from "react";

const TYPE_COLOR = {
  "거래처 등록": "#4f9cf0",
  "기안 제출":   "#8b5cf6",
  "인보이스 수령": "#f97316",
  "계약서 검토":  "#f59e0b",
  "부속합의서":   "#ec4899",
  "기타":        "#64748b",
};

const IS_DEV = import.meta.env.DEV;
const API_BASE = IS_DEV ? "http://localhost:5601" : "";

function TypeBadge({ type }) {
  const color = TYPE_COLOR[type] || "#64748b";
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 8,
      background: color + "1a", color, border: `1px solid ${color}33`,
      whiteSpace: "nowrap",
    }}>{type}</span>
  );
}

function PriorityDot({ priority }) {
  return (
    <span style={{
      width: 8, height: 8, borderRadius: "50%", flexShrink: 0, display: "inline-block",
      background: priority === "긴급" ? "#ef4444" : "#94a3b8",
    }} title={priority} />
  );
}

export default function AdminAlerts() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all"); // all | 긴급 | 미완료 | 완료
  const [typeFilter, setTypeFilter] = useState("all");
  const [sending, setSending] = useState(false);
  const [sentMsg, setSentMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await fetch(`${API_BASE}/api/admin-notion`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const { items: data } = await r.json();
      setItems(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (id, current) => {
    // optimistic update
    setItems(prev => prev.map(i => i.id === id ? { ...i, 완료: !current } : i));
    try {
      await fetch(`${API_BASE}/api/admin-notion`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: id, done: !current }),
      });
    } catch {
      setItems(prev => prev.map(i => i.id === id ? { ...i, 완료: current } : i));
    }
  };

  const sendAlert = async () => {
    setSending(true); setSentMsg("");
    try {
      const r = await fetch(`${API_BASE}/api/admin-alert`, { method: "POST" });
      const data = await r.json();
      setSentMsg(data.sent ? `Slack 발송 완료 (${data.sent}건)` : data.message || "발송 완료");
    } catch {
      setSentMsg("발송 실패");
    } finally {
      setSending(false);
      setTimeout(() => setSentMsg(""), 4000);
    }
  };

  const pending = items.filter(i => !i.완료);
  const urgent  = pending.filter(i => i.우선순위 === "긴급");
  const types   = [...new Set(items.map(i => i.유형))].filter(Boolean);

  const visible = items.filter(i => {
    if (filter === "긴급"  && i.우선순위 !== "긴급") return false;
    if (filter === "미완료" && i.완료) return false;
    if (filter === "완료"  && !i.완료) return false;
    if (typeFilter !== "all" && i.유형 !== typeFilter) return false;
    return true;
  });

  const grouped = visible.reduce((acc, item) => {
    const key = item.프로젝트 || "기타";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <div style={{ padding: "0 0 60px" }}>
      {/* 상단 KPI */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "16px 0" }}>
        {[
          { label: "전체 항목", value: items.length, color: "var(--muted)" },
          { label: "미처리",    value: pending.length, color: "#f59e0b" },
          { label: "긴급",      value: urgent.length,  color: "#ef4444" },
          { label: "완료",      value: items.length - pending.length, color: "#22c55e" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            flex: "1 1 120px", minWidth: 100, padding: "14px 16px",
            background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 8,
          }}>
            <div style={{ fontSize: 28, fontWeight: 800, color, fontVariantNumeric: "tabular-nums", lineHeight: 1, marginBottom: 4 }}>{value}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{label}</div>
          </div>
        ))}

        <div style={{ flex: "1 1 auto", display: "flex", alignItems: "flex-end", justifyContent: "flex-end", paddingBottom: 4 }}>
          <button onClick={sendAlert} disabled={sending} style={{
            padding: "9px 16px", borderRadius: 7, border: "none", cursor: sending ? "not-allowed" : "pointer",
            background: "#4f9cf0", color: "#fff", fontSize: 13, fontWeight: 700,
            fontFamily: "inherit", opacity: sending ? 0.7 : 1, transition: "opacity .15s",
          }}>
            {sending ? "발송 중…" : "🔔 Slack 알림 발송"}
          </button>
          {sentMsg && <span style={{ marginLeft: 10, fontSize: 12, color: "#22c55e", fontWeight: 600 }}>{sentMsg}</span>}
        </div>
      </div>

      {/* 필터 바 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
        padding: "10px 14px", marginBottom: 16,
        background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 8,
      }}>
        {["all","미완료","긴급","완료"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "4px 12px", borderRadius: 5, border: "none", cursor: "pointer",
            fontFamily: "inherit", fontSize: 12, transition: "all .12s",
            background: filter === f ? "var(--primary)" : "transparent",
            color: filter === f ? "#fff" : "var(--muted)",
            fontWeight: filter === f ? 700 : 400,
          }}>{f === "all" ? "전체" : f}</button>
        ))}
        <div style={{ width: 1, height: 18, background: "var(--line)" }} />
        <span style={{ fontSize: 11, color: "var(--muted)" }}>유형</span>
        {["all", ...types].map(t => (
          <button key={t} onClick={() => setTypeFilter(t)} style={{
            padding: "3px 9px", borderRadius: 4, cursor: "pointer", fontFamily: "inherit", fontSize: 11,
            border: `1px solid ${typeFilter === t ? (TYPE_COLOR[t] || "var(--primary)") : "var(--card-border)"}`,
            background: typeFilter === t ? (TYPE_COLOR[t] || "var(--primary)") + "22" : "transparent",
            color: typeFilter === t ? (TYPE_COLOR[t] || "var(--primary)") : "var(--muted)",
            fontWeight: typeFilter === t ? 700 : 400,
          }}>{t === "all" ? "전체" : t}</button>
        ))}
        <button onClick={load} style={{
          marginLeft: "auto", padding: "3px 10px", borderRadius: 4,
          border: "1px solid var(--card-border)", background: "transparent",
          cursor: "pointer", fontSize: 11, color: "var(--muted)", fontFamily: "inherit",
        }}>↻ 새로고침</button>
      </div>

      {/* 본문 */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--muted)", fontSize: 13 }}>
          노션 데이터 불러오는 중…
        </div>
      ) : error ? (
        <div style={{ padding: 20, color: "#ef4444", fontSize: 13, background: "var(--card)", borderRadius: 8, border: "1px solid #ef444433" }}>
          데이터 로드 실패: {error}
        </div>
      ) : visible.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--muted)", fontSize: 13 }}>
          조건에 해당하는 항목이 없습니다
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {Object.entries(grouped).map(([project, projItems]) => (
            <div key={project}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--primary)" }} />
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--muted)" }}>{project}</span>
                <span style={{ fontSize: 10, color: "var(--muted)", background: "var(--bg)", border: "1px solid var(--line)", padding: "0 6px", borderRadius: 8 }}>
                  {projItems.filter(i => !i.완료).length}건 미처리
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {projItems.map(item => (
                  <div key={item.id} onClick={() => toggle(item.id, item.완료)} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                    background: item.완료 ? "var(--bg)" : "var(--card)",
                    border: `1px solid ${item.완료 ? "var(--line)" : "var(--card-border)"}`,
                    borderLeft: `3px solid ${item.완료 ? "var(--line)" : (TYPE_COLOR[item.유형] || "#64748b")}`,
                    borderRadius: 6, cursor: "pointer", transition: "all .12s", opacity: item.완료 ? 0.55 : 1,
                  }}
                    onMouseEnter={e => { if (!item.완료) e.currentTarget.style.background = "var(--hover, #f5f7fd)"; }}
                    onMouseLeave={e => e.currentTarget.style.background = item.완료 ? "var(--bg)" : "var(--card)"}
                  >
                    <div style={{
                      width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                      border: `2px solid ${item.완료 ? "#22c55e" : "var(--line)"}`,
                      background: item.완료 ? "#22c55e" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all .15s",
                    }}>
                      {item.완료 && <span style={{ color: "#fff", fontSize: 12 }}>✓</span>}
                    </div>
                    <PriorityDot priority={item.우선순위} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 600, color: "var(--text)",
                        textDecoration: item.완료 ? "line-through" : "none",
                      }}>{item.항목명}</div>
                      {item.메모 && (
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {item.메모}
                        </div>
                      )}
                    </div>
                    <TypeBadge type={item.유형} />
                    <a href={item.url} target="_blank" rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      style={{ fontSize: 11, color: "var(--muted)", textDecoration: "none", flexShrink: 0, opacity: 0.5 }}>
                      ↗
                    </a>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 20, fontSize: 11, color: "var(--muted)", textAlign: "center" }}>
        데이터 소스: Notion &mdash;&nbsp;
        <a href="https://app.notion.com/p/8ba3d64fe8b045829bb887195bbff23e" target="_blank" rel="noopener noreferrer"
          style={{ color: "var(--primary)", textDecoration: "none" }}>행정 체크리스트 DB ↗</a>
      </div>
    </div>
  );
}
