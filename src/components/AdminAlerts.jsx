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

const STEP_GUIDE = {
  "파트너십 계약서 검토": {
    desc: "법무팀 또는 경영지원팀에 계약서 검토를 요청합니다.",
    actions: ["원드라이브에 계약서 초안 업로드 후 링크 공유", "검토 의견 반영 후 최종본 확정", "드라이브링크 필드에 최종 계약서 링크 등록"],
  },
  "파트너십 계약서 기안": {
    desc: "네이버웍스에서 계약서 기안을 상신합니다.",
    actions: ["결재선 확인 후 기안 상신", "결재 완료 후 기안링크 필드에 링크 등록"],
  },
  "거래처 등록 서류 확보": {
    desc: "스튜디오로부터 거래처 등록에 필요한 서류를 수령합니다.",
    actions: ["사업자등록증 사본 요청", "통장 사본 요청 (예금주·계좌번호 확인)", "수령 후 원드라이브에 업로드"],
  },
  "거래처 등록": {
    desc: "경영지원팀에 거래처 등록을 요청합니다.",
    actions: ["서류 첨부하여 경영지원팀에 등록 요청", "등록 완료 여부 확인 후 체크"],
  },
  "빌드 상세내역 확보": {
    desc: "스튜디오로부터 빌드 상세내역을 수령합니다.",
    actions: ["CPI 테스트 결과 데이터 수령 (설치수, D1 리텐션 등)", "원드라이브에 업로드 후 드라이브링크 등록"],
  },
  "인보이스 준비": {
    desc: "스튜디오에 인보이스 발행을 요청합니다.",
    actions: ["지급 금액·항목 안내 후 인보이스 발행 요청", "수령한 인보이스 원드라이브에 업로드", "드라이브링크 필드에 링크 등록"],
  },
  "프로토타입 비용 기안": {
    desc: "네이버웍스에서 프로토타입 비용 지급 기안을 상신합니다.",
    actions: ["인보이스 확인 후 지급 금액 확정", "기안 상신 후 결재 완료 시 기안링크 등록"],
  },
  "이터레이션 비용 기안 (발생 시)": {
    desc: "이터레이션이 진행된 경우에만 해당합니다.",
    actions: ["이터레이션 횟수 및 비용 확정", "인보이스 수령 후 기안 상신", "결재 완료 후 기안링크 등록"],
  },
  "부속합의서 작성 및 검토": {
    desc: "기존 파트너십 계약에 부속합의서를 추가합니다.",
    actions: ["기존 계약 조건 기반으로 부속합의서 초안 작성", "법무팀 또는 경영지원팀 검토 요청", "최종본 원드라이브에 업로드 후 드라이브링크 등록"],
  },
  "부속합의서 기안": {
    desc: "네이버웍스에서 부속합의서 기안을 상신합니다.",
    actions: ["결재선 확인 후 기안 상신", "결재 완료 후 기안링크 필드에 링크 등록"],
  },
};

const amber = "#F5B400";
const amberFaint = "rgba(245,180,0,0.10)";
const green = "#16A34A";
const greenFaint = "rgba(22,163,74,0.10)";
const red = "#DC2626";
const blue = "#0078D4";
const blueFaint = "rgba(0,120,212,0.08)";

function StatusBadge({ done, exists }) {
  if (done) return <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".03em", padding: "2px 7px", borderRadius: 3, background: greenFaint, color: green }}>완료</span>;
  if (exists) return <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".03em", padding: "2px 7px", borderRadius: 3, background: amberFaint, color: amber }}>진행중</span>;
  return <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".03em", padding: "2px 7px", borderRadius: 3, background: "var(--bg)", color: "var(--muted)", border: "1px solid var(--line)" }}>미시작</span>;
}

export default function AdminAlerts() {
  const [items, setItems]                 = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState("");
  const [selected, setSelected]           = useState(null);
  const [projTypes, setProjTypes]         = useState({});
  const [toggling, setToggling]           = useState({});
  const [sending, setSending]             = useState(false);
  const [sentMsg, setSentMsg]             = useState("");
  const [showNewProj, setShowNewProj]     = useState(false);
  const [newProjName, setNewProjName]     = useState("");
  const [newStudioName, setNewStudioName] = useState("");
  const [newProjType, setNewProjType]     = useState("new");
  const [creating, setCreating]           = useState(false);
  const [guideModal, setGuideModal]       = useState(null);
  const [linkEdit, setLinkEdit]           = useState(null); // { key, field, draft }
  const [savingLink, setSavingLink]       = useState({});
  const [sortBy, setSortBy]               = useState("default");
  const [showDoneProjects, setShowDoneProjects] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting]           = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await fetch(`${API_BASE}/api/admin-notion`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const { items: data } = await r.json();
      setItems(data);
      const types = {};
      data.forEach(item => {
        if (item.유형 && !types[item.프로젝트]) {
          types[item.프로젝트] = item.유형 === "기존" ? "repeat" : "new";
        }
      });
      setProjTypes(prev => ({ ...types, ...prev }));
      if (data.length > 0 && !selected) setSelected(data[0].프로젝트 || "기타");
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  const findItem = (project, step) => items.find(i => i.프로젝트 === project && i.항목명 === step);

  const toggleStep = async (project, step) => {
    const existing = findItem(project, step);
    if (existing?.완료) {
      if (!window.confirm(`"${step}" 완료를 취소하시겠습니까?`)) return;
    }
    const key = `${project}__${step}`;
    setToggling(t => ({ ...t, [key]: true }));
    try {
      if (existing) {
        const newDone = !existing.완료;
        setItems(prev => prev.map(i => i.id === existing.id ? { ...i, 완료: newDone } : i));
        await fetch(`${API_BASE}/api/admin-notion`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageId: existing.id, done: newDone }),
        });
      } else {
        const r = await fetch(`${API_BASE}/api/admin-notion`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project, stepName: step, done: true }),
        });
        if (r.ok) { const { item } = await r.json(); setItems(prev => [...prev, item]); }
      }
    } catch {
      if (existing) setItems(prev => prev.map(i => i.id === existing.id ? { ...i, 완료: existing.완료 } : i));
    } finally {
      setToggling(t => { const n = { ...t }; delete n[key]; return n; });
    }
  };

  const createProject = async () => {
    if (!newProjName.trim()) return;
    setCreating(true);
    const tpl = newProjType === "new" ? TEMPLATE_NEW : TEMPLATE_REPEAT;
    const notionType = newProjType === "new" ? "신규" : "기존";
    try {
      const r = await fetch(`${API_BASE}/api/admin-notion`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: newProjName.trim(), studio: newStudioName.trim(), steps: tpl, projType: notionType }),
      });
      const { items: newItems } = await r.json();
      setItems(prev => [...prev, ...newItems]);
      setProjTypes(t => ({ ...t, [newProjName.trim()]: newProjType }));
      setSelected(newProjName.trim());
      setNewProjName(""); setNewStudioName(""); setShowNewProj(false);
    } catch { /* ignore */ }
    finally { setCreating(false); }
  };

  const deleteProject = async (proj) => {
    setDeleting(true);
    try {
      await fetch(`${API_BASE}/api/admin-notion`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: proj }),
      });
      setItems(prev => prev.filter(i => i.프로젝트 !== proj));
      if (selected === proj) setSelected(null);
      setDeleteConfirm(null);
    } finally { setDeleting(false); }
  };

  const saveLink = async (project, step, field, url) => {
    const notion = findItem(project, step);
    if (!notion) return;
    const sKey = `${project}__${step}__${field}`;
    setSavingLink(s => ({ ...s, [sKey]: true }));
    try {
      await fetch(`${API_BASE}/api/admin-notion`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: notion.id, [field]: url || null }),
      });
      setItems(prev => prev.map(i => i.id === notion.id ? { ...i, [field]: url || null } : i));
      setLinkEdit(null);
    } finally {
      setSavingLink(s => { const n = { ...s }; delete n[sKey]; return n; });
    }
  };

  const sendAlert = async () => {
    setSending(true); setSentMsg("");
    try {
      const r = await fetch(`${API_BASE}/api/admin-alert`, { method: "POST" });
      const data = await r.json();
      setSentMsg(data.sent ? `${data.sent}건 발송됨` : data.message || "발송 완료");
    } catch { setSentMsg("발송 실패"); }
    finally { setSending(false); setTimeout(() => setSentMsg(""), 4000); }
  };

  const grouped = items.reduce((acc, item) => {
    const key = item.프로젝트 || "기타";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const getTemplate   = proj => (projTypes[proj] || "new") === "new" ? TEMPLATE_NEW : TEMPLATE_REPEAT;
  const getDoneCount  = proj => getTemplate(proj).filter(s => findItem(proj, s)?.완료).length;
  const isAllDone     = proj => { const tpl = getTemplate(proj); return tpl.length > 0 && getDoneCount(proj) === tpl.length; };

  const allProjects = Object.keys(grouped);
  const sortedAll = [...allProjects].sort((a, b) => {
    if (sortBy === "name") return a.localeCompare(b, "ko");
    if (sortBy === "rate") {
      const rA = getDoneCount(a) / Math.max(getTemplate(a).length, 1);
      const rB = getDoneCount(b) / Math.max(getTemplate(b).length, 1);
      return rA - rB;
    }
    return 0;
  });
  const activeProjects   = sortedAll.filter(p => !isAllDone(p));
  const completedProjects = sortedAll.filter(p => isAllDone(p));

  const selectedItems = selected ? (grouped[selected] || []) : [];
  const totalPending  = items.filter(i => !i.완료).length;
  const totalDone     = items.length - totalPending;

  const SORT_LABELS = { default: "기본", name: "이름순", rate: "진행률순" };
  const SORT_KEYS   = ["default", "name", "rate"];

  const renderSidebarProject = (proj, isDone) => {
    const tpl        = getTemplate(proj);
    const done       = getDoneCount(proj);
    const isActive   = selected === proj;
    const studio     = grouped[proj]?.[0]?.스튜디오;
    const pct        = tpl.length === 0 ? 0 : Math.round((done / tpl.length) * 100);
    const isDeleting = deleteConfirm === proj;

    return (
      <div key={proj} style={{ borderBottom: "1px solid var(--line)" }}>
        <div
          onClick={() => { if (!isDeleting) setSelected(proj); }}
          style={{
            padding: "10px 14px", cursor: isDeleting ? "default" : "pointer",
            borderLeft: `2px solid ${isActive && !isDeleting ? amber : "transparent"}`,
            background: isDeleting ? "rgba(220,38,38,.04)" : isActive ? amberFaint : "transparent",
            transition: "background .1s", position: "relative",
          }}
          onMouseEnter={e => { if (!isActive && !isDeleting) e.currentTarget.style.background = "#F8F9FA"; }}
          onMouseLeave={e => { if (!isActive && !isDeleting) e.currentTarget.style.background = "transparent"; }}
        >
          {isDeleting ? (
            <div>
              <div style={{ fontSize: 11, color: red, fontWeight: 600, marginBottom: 6 }}>"{proj}" 삭제하시겠습니까?</div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={e => { e.stopPropagation(); deleteProject(proj); }} disabled={deleting}
                  style={{ flex: 1, fontSize: 10, fontWeight: 700, padding: "4px 0", borderRadius: 3, border: "none", background: red, color: "#fff", cursor: deleting ? "wait" : "pointer", fontFamily: "inherit" }}>
                  {deleting ? "삭제 중…" : "삭제"}
                </button>
                <button onClick={e => { e.stopPropagation(); setDeleteConfirm(null); }}
                  style={{ flex: 1, fontSize: 10, padding: "4px 0", borderRadius: 3, border: "1px solid var(--line)", background: "transparent", color: "var(--muted)", cursor: "pointer", fontFamily: "inherit" }}>
                  취소
                </button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 4 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: isDone ? "var(--muted)" : "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 1 }}>{proj}</div>
                  {studio && <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{studio}</div>}
                </div>
                <button
                  onClick={e => { e.stopPropagation(); setDeleteConfirm(proj); }}
                  style={{ flexShrink: 0, fontSize: 10, padding: "1px 5px", borderRadius: 3, border: "1px solid transparent", background: "transparent", color: "transparent", cursor: "pointer", fontFamily: "inherit", transition: "all .15s" }}
                  onMouseEnter={e => { e.currentTarget.style.color = red; e.currentTarget.style.borderColor = `rgba(220,38,38,.3)`; e.currentTarget.style.background = `rgba(220,38,38,.06)`; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "transparent"; e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.background = "transparent"; }}
                  title="프로젝트 삭제"
                >✕</button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ flex: 1, height: 2, background: "var(--line)", borderRadius: 1, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: isDone ? green : amber, borderRadius: 1, transition: "width .3s" }} />
                </div>
                <span style={{ fontSize: 9, color: "var(--muted)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{done}/{tpl.length}</span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 500 }}>

      {/* ── Metrics strip ── */}
      <div style={{ display: "flex", alignItems: "center", padding: "12px 20px", borderBottom: "1px solid var(--line)", background: "var(--card)" }}>
        {[
          { label: "전체 프로젝트", value: allProjects.length, color: "var(--text)" },
          { label: "미처리 항목",   value: totalPending,       color: amber },
          { label: "완료",          value: totalDone,           color: green },
        ].map(({ label, value, color }, i) => (
          <div key={label} style={{ display: "flex", alignItems: "baseline", gap: 6, padding: "0 20px", borderRight: i < 2 ? "1px solid var(--line)" : "none" }}>
            <span style={{ fontSize: 22, fontWeight: 700, color, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{value}</span>
            <span style={{ fontSize: 11, color: "var(--muted)", letterSpacing: ".04em" }}>{label}</span>
          </div>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {sentMsg && <span style={{ fontSize: 11, color: green, fontWeight: 600 }}>{sentMsg}</span>}
          <button onClick={sendAlert} disabled={sending} style={{
            padding: "7px 14px", borderRadius: 4, border: "1px solid var(--line)",
            background: "var(--card)", color: "var(--text)", fontSize: 12, fontWeight: 600,
            fontFamily: "inherit", cursor: sending ? "not-allowed" : "pointer", opacity: sending ? 0.6 : 1, letterSpacing: ".02em",
          }}>{sending ? "발송 중…" : "Slack 알림 발송"}</button>
        </div>
      </div>

      {/* ── Body ── */}
      {loading ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 13 }}>노션 데이터 불러오는 중…</div>
      ) : error ? (
        <div style={{ margin: 20, padding: "12px 16px", fontSize: 13, color: red, background: "rgba(220,38,38,.06)", border: `1px solid rgba(220,38,38,.2)`, borderRadius: 4 }}>
          데이터 로드 실패: {error}
        </div>
      ) : (
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

          {/* ── Left nav ── */}
          <div style={{ width: 210, flexShrink: 0, borderRight: "1px solid var(--line)", display: "flex", flexDirection: "column", background: "var(--card)" }}>

            {/* Nav header */}
            <div style={{ padding: "10px 14px 8px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)", flex: 1 }}>프로젝트</span>
              {/* Sort toggle */}
              <div style={{ display: "flex", border: "1px solid var(--line)", borderRadius: 3, overflow: "hidden" }}>
                {SORT_KEYS.map(k => (
                  <button key={k} onClick={() => setSortBy(k)} style={{
                    fontSize: 9, fontWeight: sortBy === k ? 700 : 400, padding: "2px 5px",
                    border: "none", background: sortBy === k ? amber : "transparent",
                    color: sortBy === k ? "#fff" : "var(--muted)", cursor: "pointer", fontFamily: "inherit",
                  }}>{SORT_LABELS[k]}</button>
                ))}
              </div>
              <button onClick={() => setShowNewProj(true)} style={{
                fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 3,
                border: `1px solid ${amber}`, color: amber, background: amberFaint,
                cursor: "pointer", fontFamily: "inherit",
              }}>+</button>
              <button onClick={load} style={{
                fontSize: 11, padding: "2px 6px", borderRadius: 3,
                border: "1px solid var(--line)", color: "var(--muted)",
                background: "transparent", cursor: "pointer", fontFamily: "inherit",
              }}>↻</button>
            </div>

            {/* Active projects */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {activeProjects.length === 0 && completedProjects.length === 0 && (
                <div style={{ padding: "24px 14px", fontSize: 12, color: "var(--muted)", textAlign: "center" }}>프로젝트 없음</div>
              )}
              {activeProjects.map(proj => renderSidebarProject(proj, false))}

              {/* Completed projects section */}
              {completedProjects.length > 0 && (
                <>
                  <div
                    onClick={() => setShowDoneProjects(v => !v)}
                    style={{ padding: "7px 14px", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", borderBottom: "1px solid var(--line)", background: "#F8F9FA" }}
                  >
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--muted)", flex: 1 }}>
                      완료된 프로젝트 ({completedProjects.length})
                    </span>
                    <span style={{ fontSize: 9, color: "var(--muted)", transform: showDoneProjects ? "rotate(180deg)" : "none", transition: "transform .15s" }}>▾</span>
                  </div>
                  {showDoneProjects && completedProjects.map(proj => renderSidebarProject(proj, true))}
                </>
              )}
            </div>

            <div style={{ padding: "8px 14px", borderTop: "1px solid var(--line)" }}>
              <a href="https://app.notion.com/p/8ba3d64fe8b045829bb887195bbff23e" target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 10, color: "var(--muted)", textDecoration: "none" }}>Notion DB ↗</a>
            </div>
          </div>

          {/* ── Right detail ── */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {!selected ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 13 }}>프로젝트를 선택하세요</div>
            ) : (() => {
              const tpl      = getTemplate(selected);
              const type     = projTypes[selected] || "new";
              const doneCount = getDoneCount(selected);
              const studio   = selectedItems[0]?.스튜디오;

              // Sort: incomplete first, complete at bottom
              const incomplete = tpl.filter(s => !findItem(selected, s)?.완료);
              const complete   = tpl.filter(s =>  findItem(selected, s)?.완료);
              const sortedTpl  = [...incomplete, ...complete];

              return (
                <>
                  {/* Detail header */}
                  <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "var(--card)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{selected}</span>
                      {studio && <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 8 }}>{studio}</span>}
                    </div>
                    <div style={{ display: "flex", border: "1px solid var(--line)", borderRadius: 4, overflow: "hidden" }}>
                      {[["new", "신규 스튜디오"], ["repeat", "기존 스튜디오"]].map(([val, label]) => (
                        <button key={val} onClick={() => setProjTypes(t => ({ ...t, [selected]: val }))} style={{
                          padding: "4px 11px", border: "none", cursor: "pointer", fontFamily: "inherit",
                          fontSize: 11, fontWeight: type === val ? 700 : 400,
                          background: type === val ? amber : "transparent",
                          color: type === val ? "#fff" : "var(--muted)", transition: "all .1s",
                        }}>{label}</button>
                      ))}
                    </div>
                    <span style={{ fontSize: 11, color: "var(--muted)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                      <span style={{ fontWeight: 700, color: green }}>{doneCount}</span>/{tpl.length} 완료
                    </span>
                  </div>

                  {/* Column headers */}
                  <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 70px 130px 28px", padding: "0 20px", height: 32, alignItems: "center", borderBottom: "1px solid var(--line)", background: "#F8F9FA", gap: 12 }}>
                    {[["#"], ["항목"], ["상태"], ["링크"], [""]].map(([h], i) => (
                      <span key={i} style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--muted)" }}>{h}</span>
                    ))}
                  </div>

                  {/* Rows */}
                  <div style={{ flex: 1, overflowY: "auto" }}>
                    {sortedTpl.map((step, idx) => {
                      const notion     = findItem(selected, step);
                      const done       = notion?.완료 || false;
                      const exists     = !!notion;
                      const key        = `${selected}__${step}`;
                      const isToggling = !!toggling[key];
                      const guide      = STEP_GUIDE[step];
                      const optional   = step.includes("(발생 시)");
                      const origIdx    = tpl.indexOf(step);

                      // Divider between incomplete and complete
                      const isDivider = idx === incomplete.length && complete.length > 0 && incomplete.length > 0;

                      const hasGian   = !!notion?.기안링크;
                      const hasDrive  = !!notion?.드라이브링크;
                      const editingGian  = linkEdit?.key === key && linkEdit?.field === "기안링크";
                      const editingDrive = linkEdit?.key === key && linkEdit?.field === "드라이브링크";

                      return (
                        <div key={step}>
                          {isDivider && (
                            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 20px", background: "#F8F9FA", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
                              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: green }}>완료됨 ({complete.length})</span>
                              <div style={{ flex: 1, height: 1, background: `rgba(22,163,74,.2)` }} />
                            </div>
                          )}

                          {/* Row */}
                          <div style={{
                            display: "grid", gridTemplateColumns: "40px 1fr 70px 130px 28px",
                            padding: "0 20px", height: 44, alignItems: "center", gap: 12,
                            opacity: isToggling ? 0.5 : 1, background: "var(--card)",
                            borderBottom: "1px solid var(--line)",
                          }}
                            onMouseEnter={e => { e.currentTarget.style.background = "#F8F9FA"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "var(--card)"; }}
                          >
                            {/* Check circle */}
                            <div onClick={() => { if (!isToggling) toggleStep(selected, step); }} style={{
                              width: 22, height: 22, borderRadius: "50%",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 10, fontWeight: 700, fontVariantNumeric: "tabular-nums",
                              cursor: isToggling ? "wait" : "pointer",
                              border: `1.5px solid ${done ? green : exists ? amber : "var(--line)"}`,
                              background: done ? greenFaint : exists ? amberFaint : "transparent",
                              color: done ? green : exists ? amber : "var(--muted)",
                              transition: "all .15s", flexShrink: 0,
                            }}>{done ? "✓" : origIdx + 1}</div>

                            {/* Step name */}
                            <div style={{ minWidth: 0, overflow: "hidden" }}>
                              <span style={{
                                fontSize: 13, fontWeight: done ? 400 : 500,
                                color: done ? "var(--muted)" : "var(--text)",
                                textDecoration: done ? "line-through" : "none",
                                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block",
                              }}>{step}</span>
                              {optional && !done && <span style={{ fontSize: 9, letterSpacing: ".05em", color: "var(--muted)", fontWeight: 600 }}>선택 사항</span>}
                            </div>

                            {/* Status */}
                            <StatusBadge done={done} exists={exists} />

                            {/* Link buttons */}
                            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                              {/* 기안링크 */}
                              {hasGian ? (
                                <a href={notion.기안링크} target="_blank" rel="noopener noreferrer" style={{
                                  fontSize: 10, fontWeight: 600, padding: "3px 7px", borderRadius: 3,
                                  background: "rgba(22,163,74,.08)", color: green,
                                  border: "1px solid rgba(22,163,74,.25)", textDecoration: "none", whiteSpace: "nowrap",
                                }}>기안 →</a>
                              ) : (
                                <button onClick={() => exists && setLinkEdit({ key, field: "기안링크", draft: "" })} style={{
                                  fontSize: 10, fontWeight: 500, padding: "3px 7px", borderRadius: 3,
                                  border: `1px dashed ${exists ? "var(--line)" : "transparent"}`,
                                  background: "transparent", color: exists ? "var(--muted)" : "transparent",
                                  cursor: exists ? "pointer" : "default", fontFamily: "inherit", whiteSpace: "nowrap",
                                }}>{exists ? "+ 기안" : ""}</button>
                              )}
                              {/* 드라이브링크 */}
                              {hasDrive ? (
                                <a href={notion.드라이브링크} target="_blank" rel="noopener noreferrer" style={{
                                  fontSize: 10, fontWeight: 600, padding: "3px 7px", borderRadius: 3,
                                  background: blueFaint, color: blue,
                                  border: "1px solid rgba(0,120,212,.25)", textDecoration: "none", whiteSpace: "nowrap",
                                }}>드라이브 →</a>
                              ) : (
                                <button onClick={() => exists && setLinkEdit({ key, field: "드라이브링크", draft: "" })} style={{
                                  fontSize: 10, fontWeight: 500, padding: "3px 7px", borderRadius: 3,
                                  border: `1px dashed ${exists ? "var(--line)" : "transparent"}`,
                                  background: "transparent", color: exists ? "var(--muted)" : "transparent",
                                  cursor: exists ? "pointer" : "default", fontFamily: "inherit", whiteSpace: "nowrap",
                                }}>{exists ? "+ 드라이브" : ""}</button>
                              )}
                            </div>

                            {/* Guide button */}
                            {guide ? (
                              <button onClick={() => setGuideModal({ step, guide })} style={{
                                width: 22, height: 22, borderRadius: 3, border: "1px solid var(--line)",
                                background: "transparent", cursor: "pointer", fontFamily: "inherit",
                                fontSize: 10, fontWeight: 700, color: "var(--muted)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                flexShrink: 0, transition: "all .1s",
                              }}
                                onMouseEnter={e => { e.currentTarget.style.background = amberFaint; e.currentTarget.style.borderColor = amber; e.currentTarget.style.color = amber; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "var(--line)"; e.currentTarget.style.color = "var(--muted)"; }}
                              >?</button>
                            ) : <span />}
                          </div>

                          {/* Inline link edit row */}
                          {(editingGian || editingDrive) && (() => {
                            const field     = linkEdit.field;
                            const isGian    = field === "기안링크";
                            const accentC   = isGian ? green : blue;
                            const accentBg  = isGian ? "rgba(22,163,74,.08)" : blueFaint;
                            const sKey      = `${key}__${field}`;
                            const isSaving  = !!savingLink[sKey];
                            return (
                              <div style={{ padding: "8px 20px 8px 72px", background: "#FAFBFC", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", width: 56, flexShrink: 0 }}>{field}</span>
                                <input
                                  autoFocus
                                  value={linkEdit.draft}
                                  onChange={e => setLinkEdit(l => ({ ...l, draft: e.target.value }))}
                                  onKeyDown={e => {
                                    if (e.key === "Enter" && linkEdit.draft) saveLink(selected, step, field, linkEdit.draft);
                                    if (e.key === "Escape") setLinkEdit(null);
                                  }}
                                  placeholder="URL 붙여넣기 후 Enter"
                                  style={{
                                    flex: 1, fontSize: 11, padding: "4px 8px", borderRadius: 3,
                                    border: `1px solid ${accentC}`, background: accentBg,
                                    color: "var(--text)", fontFamily: "inherit", outline: "none",
                                    maxWidth: 360, opacity: isSaving ? 0.5 : 1,
                                  }}
                                />
                                {linkEdit.draft && (
                                  <button onClick={() => saveLink(selected, step, field, linkEdit.draft)} disabled={isSaving} style={{
                                    fontSize: 10, fontWeight: 600, padding: "4px 10px", borderRadius: 3,
                                    border: `1px solid ${accentC}`, background: accentBg, color: accentC,
                                    cursor: isSaving ? "wait" : "pointer", fontFamily: "inherit",
                                  }}>저장</button>
                                )}
                                <button onClick={() => setLinkEdit(null)} style={{
                                  fontSize: 10, padding: "4px 8px", borderRadius: 3,
                                  border: "1px solid var(--line)", background: "transparent",
                                  color: "var(--muted)", cursor: "pointer", fontFamily: "inherit",
                                }}>취소</button>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── Guide modal ── */}
      {guideModal && (
        <div onClick={() => setGuideModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 6, width: 460, maxHeight: "80vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 12px 48px rgba(0,0,0,.18)" }}>
            <div style={{ padding: "16px 20px 14px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: amber, marginBottom: 4 }}>가이드</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", lineHeight: 1.35 }}>{guideModal.step}</div>
              </div>
              <button onClick={() => setGuideModal(null)} style={{ width: 26, height: 26, borderRadius: 4, border: "1px solid var(--line)", background: "transparent", cursor: "pointer", fontSize: 14, color: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>✕</button>
            </div>
            <div style={{ padding: "18px 20px", overflowY: "auto" }}>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 18px", lineHeight: 1.65 }}>{guideModal.guide.desc}</p>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>처리 절차</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {guideModal.guide.actions.map((action, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: "#fff", background: amber, width: 20, height: 20, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>{i + 1}</span>
                    <span style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.6 }}>{action}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── New project modal ── */}
      {showNewProj && (
        <div onClick={() => setShowNewProj(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 6, padding: 24, width: 380, boxShadow: "0 8px 40px rgba(0,0,0,.15)" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 18, letterSpacing: "-.01em" }}>새 프로젝트 추가</div>

            {[
              { label: "스튜디오명", value: newStudioName, setter: setNewStudioName, placeholder: "예: Neptune Studio", autoFocus: false },
              { label: "프로젝트명", value: newProjName,   setter: setNewProjName,   placeholder: "예: WeChat Mini Game Test", autoFocus: true },
            ].map(({ label, value, setter, placeholder, autoFocus }) => (
              <div key={label} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 }}>{label}</div>
                <input autoFocus={autoFocus} value={value} onChange={e => setter(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && label === "프로젝트명" && createProject()}
                  placeholder={placeholder}
                  style={{
                    width: "100%", padding: "8px 10px", borderRadius: 4, boxSizing: "border-box",
                    border: `1px solid ${label === "프로젝트명" && allProjects.includes(value.trim()) ? red : "var(--card-border)"}`,
                    background: "var(--bg)", color: "var(--text)", fontSize: 13, fontFamily: "inherit", outline: "none",
                  }}
                />
                {label === "프로젝트명" && allProjects.includes(value.trim()) && (
                  <div style={{ fontSize: 11, color: red, marginTop: 4 }}>이미 존재하는 프로젝트명입니다</div>
                )}
              </div>
            ))}

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>계약 유형</div>
              <div style={{ display: "flex", gap: 8 }}>
                {[["new", "신규 스튜디오", `${TEMPLATE_NEW.length}단계`], ["repeat", "기존 스튜디오", `${TEMPLATE_REPEAT.length}단계`]].map(([val, label, sub]) => (
                  <div key={val} onClick={() => setNewProjType(val)} style={{
                    flex: 1, padding: "10px 12px", borderRadius: 4, cursor: "pointer",
                    border: `1.5px solid ${newProjType === val ? amber : "var(--card-border)"}`,
                    background: newProjType === val ? amberFaint : "var(--bg)",
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: newProjType === val ? amber : "var(--text)", marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 10, color: "var(--muted)" }}>{sub}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowNewProj(false)} style={{ flex: 1, padding: "8px 0", borderRadius: 4, border: "1px solid var(--card-border)", background: "transparent", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--muted)", fontFamily: "inherit" }}>취소</button>
              <button onClick={createProject} disabled={!newProjName.trim() || creating || allProjects.includes(newProjName.trim())} style={{
                flex: 2, padding: "8px 0", borderRadius: 4, border: "none",
                background: !newProjName.trim() || allProjects.includes(newProjName.trim()) ? "var(--line)" : amber,
                color: !newProjName.trim() || allProjects.includes(newProjName.trim()) ? "var(--muted)" : "#fff",
                cursor: creating || !newProjName.trim() || allProjects.includes(newProjName.trim()) ? "not-allowed" : "pointer",
                fontSize: 12, fontWeight: 700, fontFamily: "inherit", transition: "background .1s",
              }}>{creating ? "생성 중…" : allProjects.includes(newProjName.trim()) ? "중복된 프로젝트명" : "프로젝트 생성"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
