import { useCallback, useEffect, useState } from "react";

const TYPE_COLOR = {
  "거래처 등록":  "#4f9cf0",
  "기안 제출":    "#8b5cf6",
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

function ProgressBar({ done, total }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
      <div style={{ flex: 1, height: 4, borderRadius: 2, background: "var(--line)", overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 2, transition: "width .3s",
          width: `${pct}%`,
          background: pct === 100 ? "#22c55e" : "var(--primary)",
        }} />
      </div>
      <span style={{ fontSize: 10, color: "var(--muted)", whiteSpace: "nowrap" }}>{done}/{total}</span>
    </div>
  );
}

export default function AdminAlerts() {
  const [items, setItems]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [selected, setSelected]   = useState(null); // 선택된 프로젝트명
  const [sending, setSending]     = useState(false);
  const [sentMsg, setSentMsg]     = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await fetch(`${API_BASE}/api/admin-notion`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const { items: data } = await r.json();
      setItems(data);
      // 첫 프로젝트 자동 선택
      if (data.length > 0 && !selected) {
        const first = data[0].프로젝트 || "기타";
        setSelected(first);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  const toggle = async (id, current) => {
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

  // 프로젝트별 그룹
  const grouped = items.reduce((acc, item) => {
    const key = item.프로젝트 || "기타";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const projects = Object.keys(grouped);
  const selectedItems = selected ? (grouped[selected] || []) : [];
  const pending = items.filter(i => !i.완료);
  const urgent  = pending.filter(i => i.우선순위 === "긴급");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "0 0 60px" }}>

      {/* 상단 요약 + Slack 버튼 */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {[
          { label: "전체", value: items.length, color: "var(--muted)" },
          { label: "미처리", value: pending.length, color: "#f59e0b" },
          { label: "긴급",  value: urgent.length,   color: "#ef4444" },
          { label: "완료",  value: items.length - pending.length, color: "#22c55e" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            flex: "1 1 100px", minWidth: 90, padding: "12px 14px",
            background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 8,
          }}>
            <div style={{ fontSize: 24, fontWeight: 800, color, fontVariantNumeric: "tabular-nums", lineHeight: 1, marginBottom: 3 }}>{value}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text)" }}>{label}</div>
          </div>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {sentMsg && <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>{sentMsg}</span>}
          <button onClick={sendAlert} disabled={sending} style={{
            padding: "9px 16px", borderRadius: 7, border: "none", cursor: sending ? "not-allowed" : "pointer",
            background: "#4f9cf0", color: "#fff", fontSize: 13, fontWeight: 700,
            fontFamily: "inherit", opacity: sending ? 0.7 : 1,
          }}>
            {sending ? "발송 중…" : "🔔 Slack 알림 발송"}
          </button>
        </div>
      </div>

      {/* 마스터-디테일 */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--muted)", fontSize: 13 }}>
          노션 데이터 불러오는 중…
        </div>
      ) : error ? (
        <div style={{ padding: 20, color: "#ef4444", fontSize: 13, background: "var(--card)", borderRadius: 8, border: "1px solid #ef444433" }}>
          데이터 로드 실패: {error}
        </div>
      ) : (
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>

          {/* 왼쪽: 프로젝트 목록 */}
          <div style={{
            width: 220, flexShrink: 0,
            background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 10,
            overflow: "hidden",
          }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: ".06em", textTransform: "uppercase" }}>프로젝트</span>
              <button onClick={load} style={{
                padding: "2px 8px", borderRadius: 4, border: "1px solid var(--card-border)",
                background: "transparent", cursor: "pointer", fontSize: 10, color: "var(--muted)", fontFamily: "inherit",
              }}>↻</button>
            </div>
            {projects.length === 0 ? (
              <div style={{ padding: 20, fontSize: 12, color: "var(--muted)", textAlign: "center" }}>항목 없음</div>
            ) : (
              projects.map(proj => {
                const projItems = grouped[proj];
                const done = projItems.filter(i => i.완료).length;
                const hasUrgent = projItems.some(i => !i.완료 && i.우선순위 === "긴급");
                const isActive = selected === proj;
                return (
                  <div
                    key={proj}
                    onClick={() => setSelected(proj)}
                    style={{
                      padding: "10px 14px", cursor: "pointer", transition: "background .12s",
                      borderBottom: "1px solid var(--line)",
                      background: isActive ? "var(--primary)12" : "transparent",
                      borderLeft: `3px solid ${isActive ? "var(--primary)" : "transparent"}`,
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "var(--bg)"; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      {hasUrgent && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", flexShrink: 0, display: "inline-block" }} />}
                      <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? "var(--primary)" : "var(--text)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {proj}
                      </span>
                    </div>
                    <ProgressBar done={done} total={projItems.length} />
                  </div>
                );
              })
            )}
          </div>

          {/* 오른쪽: 선택 프로젝트 상세 */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {!selected ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                프로젝트를 선택하세요
              </div>
            ) : (
              <div style={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 10, overflow: "hidden" }}>
                {/* 헤더 */}
                <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{selected}</span>
                  <span style={{ fontSize: 11, color: "var(--muted)", background: "var(--bg)", border: "1px solid var(--line)", padding: "1px 8px", borderRadius: 8 }}>
                    {selectedItems.filter(i => !i.완료).length}건 미처리 / 전체 {selectedItems.length}건
                  </span>
                </div>

                {/* 체크리스트 */}
                <div style={{ padding: "8px 0" }}>
                  {selectedItems.length === 0 ? (
                    <div style={{ padding: 30, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>항목 없음</div>
                  ) : (
                    selectedItems.map((item, idx) => (
                      <div
                        key={item.id}
                        onClick={() => toggle(item.id, item.완료)}
                        style={{
                          display: "flex", alignItems: "flex-start", gap: 12,
                          padding: "11px 18px", cursor: "pointer",
                          borderBottom: idx < selectedItems.length - 1 ? "1px solid var(--line)" : "none",
                          background: item.완료 ? "var(--bg)" : "var(--card)",
                          opacity: item.완료 ? 0.6 : 1, transition: "all .12s",
                        }}
                        onMouseEnter={e => { if (!item.완료) e.currentTarget.style.background = "var(--bg)"; }}
                        onMouseLeave={e => e.currentTarget.style.background = item.완료 ? "var(--bg)" : "var(--card)"}
                      >
                        {/* 체크박스 */}
                        <div style={{
                          width: 20, height: 20, borderRadius: 5, flexShrink: 0, marginTop: 1,
                          border: `2px solid ${item.완료 ? "#22c55e" : "var(--line)"}`,
                          background: item.완료 ? "#22c55e" : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "all .15s",
                        }}>
                          {item.완료 && <span style={{ color: "#fff", fontSize: 12, lineHeight: 1 }}>✓</span>}
                        </div>

                        {/* 순번 */}
                        <span style={{ fontSize: 11, color: "var(--muted)", flexShrink: 0, marginTop: 3, fontVariantNumeric: "tabular-nums" }}>
                          {String(idx + 1).padStart(2, "0")}
                        </span>

                        {/* 내용 */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 13, fontWeight: 600, color: "var(--text)",
                            textDecoration: item.완료 ? "line-through" : "none", marginBottom: 2,
                          }}>{item.항목명}</div>
                          {item.메모 && (
                            <div style={{ fontSize: 11, color: "var(--muted)" }}>{item.메모}</div>
                          )}
                          {item.마감일 && (
                            <div style={{ fontSize: 10, color: "#f59e0b", marginTop: 3 }}>마감 {item.마감일}</div>
                          )}
                        </div>

                        {/* 우선순위 + 유형 */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                          {item.우선순위 === "긴급" && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#ef4444", background: "#ef444415", border: "1px solid #ef444433", padding: "1px 6px", borderRadius: 4 }}>긴급</span>
                          )}
                          <TypeBadge type={item.유형} />
                          <a href={item.url} target="_blank" rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            style={{ fontSize: 12, color: "var(--muted)", textDecoration: "none", opacity: 0.5 }}>
                            ↗
                          </a>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "center" }}>
        데이터 소스: Notion &mdash;&nbsp;
        <a href="https://app.notion.com/p/8ba3d64fe8b045829bb887195bbff23e" target="_blank" rel="noopener noreferrer"
          style={{ color: "var(--primary)", textDecoration: "none" }}>행정 체크리스트 DB ↗</a>
      </div>
    </div>
  );
}
