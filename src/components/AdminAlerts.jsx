import { useCallback, useEffect, useState } from "react";

const IS_DEV = import.meta.env.DEV;
const API_BASE = IS_DEV ? "http://localhost:5601" : "";

const TEMPLATE_NEW = [
  "파트너십 계약서 검토",
  "파트너십 계약서 기안",
  "거래처 등록 서류 확보",
  "거래처 등록",
  "빌드 상세내역 확보",
  "인보이스 준비",
  "프로토타입 비용 기안",
  "이터레이션 비용 기안 (발생 시)",
];

const TEMPLATE_REPEAT = [
  "부속합의서 작성 및 검토",
  "부속합의서 기안",
  "빌드 상세내역 확보",
  "인보이스 준비",
  "프로토타입 비용 기안",
  "이터레이션 비용 기안 (발생 시)",
];

function ProgressBar({ done, total }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5 }}>
      <div style={{ flex: 1, height: 3, borderRadius: 2, background: "var(--line)", overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 2, transition: "width .3s",
          width: `${pct}%`,
          background: pct === 100 ? "#22c55e" : "var(--primary)",
        }} />
      </div>
      <span style={{ fontSize: 10, color: "var(--muted)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
        {done}/{total}
      </span>
    </div>
  );
}

export default function AdminAlerts() {
  const [items, setItems]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [selected, setSelected]     = useState(null);
  // 프로젝트별 템플릿 타입: "new" | "repeat"
  const [projTypes, setProjTypes]   = useState({});
  const [toggling, setToggling]     = useState({});
  const [sending, setSending]       = useState(false);
  const [sentMsg, setSentMsg]       = useState("");
  const [showNewProj, setShowNewProj] = useState(false);
  const [newProjName, setNewProjName] = useState("");
  const [newStudioName, setNewStudioName] = useState("");
  const [newProjType, setNewProjType] = useState("new");
  const [creating, setCreating]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await fetch(`${API_BASE}/api/admin-notion`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const { items: data } = await r.json();
      setItems(data);
      if (data.length > 0 && !selected) {
        setSelected(data[0].프로젝트 || "기타");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  // Notion 아이템 중 해당 프로젝트+항목명 매칭
  const findItem = (project, stepName) =>
    items.find(i => i.프로젝트 === project && i.항목명 === stepName);

  const toggleStep = async (project, stepName) => {
    const existing = findItem(project, stepName);
    const key = `${project}__${stepName}`;
    setToggling(t => ({ ...t, [key]: true }));

    try {
      if (existing) {
        // 완료 토글
        const newDone = !existing.완료;
        setItems(prev => prev.map(i => i.id === existing.id ? { ...i, 완료: newDone } : i));
        await fetch(`${API_BASE}/api/admin-notion`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageId: existing.id, done: newDone }),
        });
      } else {
        // Notion에 신규 생성 (완료 상태로)
        const r = await fetch(`${API_BASE}/api/admin-notion`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project, stepName, done: true }),
        });
        if (r.ok) {
          const { item } = await r.json();
          setItems(prev => [...prev, item]);
        }
      }
    } catch {
      // rollback
      if (existing) {
        setItems(prev => prev.map(i => i.id === existing.id ? { ...i, 완료: existing.완료 } : i));
      }
    } finally {
      setToggling(t => { const n = { ...t }; delete n[key]; return n; });
    }
  };

  const createProject = async () => {
    if (!newProjName.trim()) return;
    setCreating(true);
    const tpl = newProjType === "new" ? TEMPLATE_NEW : TEMPLATE_REPEAT;
    try {
      const r = await fetch(`${API_BASE}/api/admin-notion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: newProjName.trim(), studio: newStudioName.trim(), steps: tpl }),
      });
      const { items: newItems } = await r.json();
      setItems(prev => [...prev, ...newItems]);
      setProjTypes(t => ({ ...t, [newProjName.trim()]: newProjType }));
      setSelected(newProjName.trim());
      setNewProjName("");
      setNewStudioName("");
      setShowNewProj(false);
    } catch { /* ignore */ }
    finally { setCreating(false); }
  };

  const sendAlert = async () => {
    setSending(true); setSentMsg("");
    try {
      const r = await fetch(`${API_BASE}/api/admin-alert`, { method: "POST" });
      const data = await r.json();
      setSentMsg(data.sent ? `Slack 발송 완료 (${data.sent}건)` : data.message || "발송 완료");
    } catch { setSentMsg("발송 실패"); }
    finally {
      setSending(false);
      setTimeout(() => setSentMsg(""), 4000);
    }
  };

  const grouped = items.reduce((acc, item) => {
    const key = item.프로젝트 || "기타";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
  const projects = Object.keys(grouped);

  const getTemplate = (proj) =>
    (projTypes[proj] || "new") === "new" ? TEMPLATE_NEW : TEMPLATE_REPEAT;

  const getDoneCount = (proj) => {
    const tpl = getTemplate(proj);
    return tpl.filter(step => findItem(proj, step)?.완료).length;
  };

  const pending = items.filter(i => !i.완료);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "0 0 60px" }}>

      {/* 상단 요약 */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {[
          { label: "전체 프로젝트", value: projects.length, color: "var(--muted)" },
          { label: "미처리 항목",   value: pending.length,  color: "#f59e0b" },
          { label: "완료",          value: items.length - pending.length, color: "#22c55e" },
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
        <div style={{ textAlign: "center", padding: 60, color: "var(--muted)", fontSize: 13 }}>노션 데이터 불러오는 중…</div>
      ) : error ? (
        <div style={{ padding: 20, color: "#ef4444", fontSize: 13, background: "var(--card)", borderRadius: 8, border: "1px solid #ef444433" }}>
          데이터 로드 실패: {error}
        </div>
      ) : (
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>

          {/* 왼쪽: 프로젝트 목록 */}
          <div style={{
            width: 220, flexShrink: 0,
            background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 10, overflow: "hidden",
          }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: ".06em", textTransform: "uppercase" }}>프로젝트</span>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={() => setShowNewProj(true)} style={{
                  padding: "2px 8px", borderRadius: 4, border: "1px solid var(--primary)",
                  background: "transparent", cursor: "pointer", fontSize: 10, color: "var(--primary)",
                  fontFamily: "inherit", fontWeight: 700,
                }}>+ 추가</button>
                <button onClick={load} style={{
                  padding: "2px 8px", borderRadius: 4, border: "1px solid var(--card-border)",
                  background: "transparent", cursor: "pointer", fontSize: 10, color: "var(--muted)", fontFamily: "inherit",
                }}>↻</button>
              </div>
            </div>
            {projects.length === 0 ? (
              <div style={{ padding: 20, fontSize: 12, color: "var(--muted)", textAlign: "center" }}>항목 없음</div>
            ) : projects.map(proj => {
              const tpl = getTemplate(proj);
              const done = getDoneCount(proj);
              const isActive = selected === proj;
              return (
                <div key={proj} onClick={() => setSelected(proj)} style={{
                  padding: "10px 14px", cursor: "pointer", transition: "background .12s",
                  borderBottom: "1px solid var(--line)",
                  background: isActive ? "color-mix(in srgb, var(--primary) 10%, transparent)" : "transparent",
                  borderLeft: `3px solid ${isActive ? "var(--primary)" : "transparent"}`,
                }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "var(--bg)"; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? "var(--primary)" : "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {proj}
                  </div>
                  {(() => { const studio = grouped[proj]?.[0]?.스튜디오; return studio ? (
                    <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{studio}</div>
                  ) : null; })()}
                  <ProgressBar done={done} total={tpl.length} />
                </div>
              );
            })}
          </div>

          {/* 오른쪽: 체크리스트 */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {!selected ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>프로젝트를 선택하세요</div>
            ) : (() => {
              const tpl = getTemplate(selected);
              const type = projTypes[selected] || "new";
              return (
                <div style={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 10, overflow: "hidden" }}>
                  {/* 헤더 */}
                  <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{selected}</span>
                    {selectedItems[0]?.스튜디오 && (
                      <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 8 }}>{selectedItems[0].스튜디오}</span>
                    )}
                  </div>
                    {/* 템플릿 타입 토글 */}
                    <div style={{ display: "flex", gap: 4, background: "var(--bg)", borderRadius: 6, padding: 3, border: "1px solid var(--line)" }}>
                      {[["new", "신규 스튜디오"], ["repeat", "기존 스튜디오"]].map(([val, label]) => (
                        <button key={val} onClick={() => setProjTypes(t => ({ ...t, [selected]: val }))}
                          style={{
                            padding: "4px 10px", borderRadius: 4, border: "none", cursor: "pointer",
                            fontFamily: "inherit", fontSize: 11, fontWeight: type === val ? 700 : 400,
                            background: type === val ? "var(--primary)" : "transparent",
                            color: type === val ? "#fff" : "var(--muted)", transition: "all .12s",
                          }}>{label}</button>
                      ))}
                    </div>
                    <span style={{ fontSize: 11, color: "var(--muted)", background: "var(--bg)", border: "1px solid var(--line)", padding: "2px 8px", borderRadius: 8 }}>
                      {getDoneCount(selected)}/{tpl.length} 완료
                    </span>
                  </div>

                  {/* 체크리스트 */}
                  <div>
                    {tpl.map((step, idx) => {
                      const notion = findItem(selected, step);
                      const done = notion?.완료 || false;
                      const exists = !!notion;
                      const key = `${selected}__${step}`;
                      const isToggling = !!toggling[key];
                      const optional = step.includes("(발생 시)");

                      return (
                        <div key={step} onClick={() => !isToggling && toggleStep(selected, step)} style={{
                          display: "flex", alignItems: "flex-start", gap: 12,
                          padding: "13px 18px",
                          borderBottom: idx < tpl.length - 1 ? "1px solid var(--line)" : "none",
                          cursor: isToggling ? "wait" : "pointer",
                          background: done ? "var(--bg)" : "var(--card)",
                          opacity: isToggling ? 0.6 : 1,
                          transition: "all .12s",
                        }}
                          onMouseEnter={e => { if (!done && !isToggling) e.currentTarget.style.background = "var(--bg)"; }}
                          onMouseLeave={e => e.currentTarget.style.background = done ? "var(--bg)" : "var(--card)"}
                        >
                          {/* 순번 */}
                          <span style={{
                            width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11, fontWeight: 700, fontVariantNumeric: "tabular-nums",
                            background: done ? "#22c55e" : exists ? "var(--primary)" : "var(--line)",
                            color: done || exists ? "#fff" : "var(--muted)",
                            transition: "all .2s",
                          }}>
                            {done ? "✓" : idx + 1}
                          </span>

                          {/* 내용 */}
                          <div style={{ flex: 1 }}>
                            <span style={{
                              fontSize: 13, fontWeight: done ? 400 : 600,
                              color: done ? "var(--muted)" : "var(--text)",
                              textDecoration: done ? "line-through" : "none",
                            }}>{step}</span>
                            {optional && !done && (
                              <span style={{ marginLeft: 6, fontSize: 10, color: "var(--muted)", background: "var(--bg)", border: "1px solid var(--line)", padding: "1px 6px", borderRadius: 4 }}>선택</span>
                            )}
                            {notion?.메모 && (
                              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{notion.메모}</div>
                            )}
                          {(notion?.기안링크 || notion?.드라이브링크) && (
                            <div style={{ display: "flex", gap: 8, marginTop: 5 }}>
                              {notion.기안링크 && (
                                <a href={notion.기안링크} target="_blank" rel="noopener noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  style={{
                                    fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
                                    background: "#00c73c18", color: "#00c73c", border: "1px solid #00c73c33",
                                    textDecoration: "none", display: "flex", alignItems: "center", gap: 3,
                                  }}>
                                  📋 네이버웍스 기안
                                </a>
                              )}
                              {notion.드라이브링크 && (
                                <a href={notion.드라이브링크} target="_blank" rel="noopener noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  style={{
                                    fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
                                    background: "#0078d418", color: "#0078d4", border: "1px solid #0078d433",
                                    textDecoration: "none", display: "flex", alignItems: "center", gap: 3,
                                  }}>
                                  ☁️ 원드라이브
                                </a>
                              )}
                            </div>
                          )}
                          </div>

                          {/* 상태 */}
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, flexShrink: 0,
                            ...(done
                              ? { background: "#22c55e18", color: "#22c55e", border: "1px solid #22c55e33" }
                              : exists
                              ? { background: "#f59e0b18", color: "#f59e0b", border: "1px solid #f59e0b33" }
                              : { background: "var(--bg)", color: "var(--muted)", border: "1px solid var(--line)" }
                            ),
                          }}>
                            {done ? "완료" : exists ? "진행중" : "미시작"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* 새 프로젝트 모달 */}
      {showNewProj && (
        <div onClick={() => setShowNewProj(false)} style={{
          position: "fixed", inset: 0, background: "#00000055",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "var(--card)", border: "1px solid var(--card-border)",
            borderRadius: 12, padding: 24, width: 360, boxShadow: "0 8px 32px #0002",
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>새 프로젝트 추가</div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 6 }}>스튜디오명</div>
              <input
                value={newStudioName}
                onChange={e => setNewStudioName(e.target.value)}
                placeholder="예: Neptune Studio"
                style={{
                  width: "100%", padding: "9px 12px", borderRadius: 7, boxSizing: "border-box",
                  border: "1px solid var(--card-border)", background: "var(--bg)",
                  color: "var(--text)", fontSize: 13, fontFamily: "inherit", outline: "none",
                }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 6 }}>프로젝트명</div>
              <input
                autoFocus
                value={newProjName}
                onChange={e => setNewProjName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && createProject()}
                placeholder="예: WeChat Mini Game Test"
                style={{
                  width: "100%", padding: "9px 12px", borderRadius: 7, boxSizing: "border-box",
                  border: `1px solid ${projects.includes(newProjName.trim()) ? "#ef4444" : "var(--card-border)"}`,
                  background: "var(--bg)", color: "var(--text)", fontSize: 13, fontFamily: "inherit", outline: "none",
                }}
              />
              {projects.includes(newProjName.trim()) && (
                <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>이미 존재하는 프로젝트명입니다</div>
              )}
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 6 }}>계약 유형</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[["new", "신규 스튜디오", `${TEMPLATE_NEW.length}단계`], ["repeat", "기존 스튜디오", `${TEMPLATE_REPEAT.length}단계`]].map(([val, label, sub]) => (
                  <div key={val} onClick={() => setNewProjType(val)} style={{
                    flex: 1, padding: "10px 12px", borderRadius: 8, cursor: "pointer",
                    border: `1.5px solid ${newProjType === val ? "var(--primary)" : "var(--card-border)"}`,
                    background: newProjType === val ? "color-mix(in srgb, var(--primary) 8%, transparent)" : "var(--bg)",
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: newProjType === val ? "var(--primary)" : "var(--text)" }}>{label}</div>
                    <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{sub}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowNewProj(false)} style={{
                flex: 1, padding: "9px 0", borderRadius: 7, border: "1px solid var(--card-border)",
                background: "transparent", cursor: "pointer", fontSize: 13, color: "var(--muted)", fontFamily: "inherit",
              }}>취소</button>
              <button onClick={createProject} disabled={!newProjName.trim() || creating || projects.includes(newProjName.trim())} style={{
                flex: 2, padding: "9px 0", borderRadius: 7, border: "none",
                background: "var(--primary)", color: "#fff", cursor: creating || !newProjName.trim() || projects.includes(newProjName.trim()) ? "not-allowed" : "pointer",
                fontSize: 13, fontWeight: 700, fontFamily: "inherit", opacity: creating ? 0.7 : 1,
              }}>
                {creating ? "생성 중…" : projects.includes(newProjName.trim()) ? "중복된 프로젝트명" : "프로젝트 생성"}
              </button>
            </div>
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
