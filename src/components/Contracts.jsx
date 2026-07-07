import { useCallback, useEffect, useMemo, useState } from "react";

const IS_DEV = import.meta.env.DEV;
const API_BASE = IS_DEV ? "http://localhost:5601" : "";

const NOTION_DB_URL = "https://app.notion.com/p/519164c16c9145679dafce69b6d9ab58";

const CONTRACT_KINDS = ["파트너십계약", "부속합의서", "NDA"];
const PARTNER_LEVEL_KINDS = ["파트너십계약", "NDA", "거래처등록"];
const PROJECT_LEVEL_KINDS = ["부속합의서", "지출기안"];
const ALL_KINDS = ["파트너십계약", "NDA", "거래처등록", "부속합의서", "지출기안"];
const STATUS_ORDER = ["요청전", "진행중", "완료"];

const amber = "#F5B400";
const amberFaint = "rgba(245,180,0,0.10)";
const green = "#16A34A";
const greenFaint = "rgba(22,163,74,0.10)";
const red = "#DC2626";
const blue = "#0078D4";
const blueFaint = "rgba(0,120,212,0.08)";

const DOCS_BY_KIND = {
  거래처등록: ["법인등록증", "법인통장"],
  지출기안: ["법인등록증", "법인통장", "부속합의서", "스펙내용", "인보이스"],
};

const VENDOR_FIELDS = [
  ["거래처식별번호", "법인등록증 내 기재"],
  ["거래처명", "법인등록증 내 기재"],
  ["거래처국가", ""],
  ["거래처주소", "주소 / 도시 / 우편번호"],
  ["거래처대표", ""],
  ["거래처담당자", ""],
  ["거래처Email", ""],
];
const BANK_FIELDS = ["BankName", "BranchName", "BankAddress", "BeneficiaryName", "AccountNumber"];

const EMPTY_FORM = {
  제목: "", 파트너사: "", 프로젝트: "", 구분: "파트너십계약", 상태: "요청전", 메모: "",
  체결일: "", 만료일: "", 자동갱신: false, 계약서URL: "", 기안링크: "", 이터레이션구분: "",
  법인등록증: false, 법인통장: false, 부속합의서: false, 스펙내용: false, 인보이스: false,
  거래처식별번호: "", 거래처명: "", 거래처국가: "", 거래처주소: "", 거래처대표: "", 거래처담당자: "", 거래처Email: "",
  BankName: "", BranchName: "", BankAddress: "", BeneficiaryName: "", AccountNumber: "",
};

function dday(만료일) {
  if (!만료일) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const exp = new Date(만료일); exp.setHours(0, 0, 0, 0);
  return Math.round((exp - today) / 86400000);
}

function StatusBadge({ 상태 }) {
  if (상태 === "완료") return <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".03em", padding: "2px 7px", borderRadius: 3, background: greenFaint, color: green }}>완료</span>;
  if (상태 === "진행중") return <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".03em", padding: "2px 7px", borderRadius: 3, background: amberFaint, color: amber }}>진행중</span>;
  return <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".03em", padding: "2px 7px", borderRadius: 3, background: "var(--card)", color: "var(--muted)", border: "1px solid var(--line)" }}>요청전</span>;
}

export default function Contracts() {
  const [items, setItems]         = useState([]);
  const [partners, setPartners]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [selected, setSelected]   = useState(null);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving]       = useState(false);
  const [busy, setBusy]           = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [addingPartner, setAddingPartner] = useState(false);
  const [newPartnerName, setNewPartnerName] = useState("");
  const [addingProject, setAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [creatingTpl, setCreatingTpl] = useState(false);
  const [titleTouched, setTitleTouched] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await fetch(`${API_BASE}/api/partner-admin`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setItems(data.items);
      setPartners(data.partners || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const allPartners = useMemo(() => {
    const set = new Set(partners);
    items.forEach(i => i.파트너사 && set.add(i.파트너사));
    return [...set].sort();
  }, [items, partners]);

  // 항목 있는 파트너 먼저, 빈 파트너(DB select 등록만 된 곳)는 아래에
  const visiblePartnerList = useMemo(() => {
    const has = allPartners.filter(p => items.some(i => i.파트너사 === p));
    const empty = allPartners.filter(p => !items.some(i => i.파트너사 === p));
    return [...has, ...empty];
  }, [allPartners, items]);

  useEffect(() => {
    if (!selected && visiblePartnerList.length > 0) setSelected(visiblePartnerList[0]);
  }, [visiblePartnerList, selected]);

  const byPartner = useMemo(() => {
    const map = {};
    allPartners.forEach(p => { map[p] = items.filter(i => i.파트너사 === p); });
    return map;
  }, [items, allPartners]);

  const alerts = useMemo(() => {
    const out = [];
    items.forEach(i => {
      const d = dday(i.만료일);
      if (CONTRACT_KINDS.includes(i.구분) && d !== null && d >= 0 && d <= 30) out.push(`${i.제목} 만료 D-${d}`);
    });
    return out;
  }, [items]);

  const totalDone = items.filter(i => i.상태 === "완료").length;
  const totalPending = items.length - totalDone;

  const patch = async (pageId, fields) => {
    setBusy(b => ({ ...b, [pageId]: true }));
    const prev = items.find(i => i.id === pageId);
    setItems(list => list.map(i => i.id === pageId ? { ...i, ...fields } : i));
    try {
      const r = await fetch(`${API_BASE}/api/partner-admin`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, ...fields }),
      });
      if (!r.ok) throw new Error();
    } catch {
      if (prev) setItems(list => list.map(i => i.id === pageId ? prev : i));
    } finally {
      setBusy(b => { const n = { ...b }; delete n[pageId]; return n; });
    }
  };

  const cycleStatus = (item) => {
    if (item.상태 === "완료" && !window.confirm(`"${item.제목}" 완료를 취소하시겠습니까?`)) return;
    const next = STATUS_ORDER[(STATUS_ORDER.indexOf(item.상태 || "요청전") + 1) % STATUS_ORDER.length];
    patch(item.id, { 상태: next });
  };

  const remove = async (item) => {
    setBusy(b => ({ ...b, [item.id]: true }));
    try {
      await fetch(`${API_BASE}/api/partner-admin`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: item.id }),
      });
      setItems(prev => prev.filter(i => i.id !== item.id));
    } finally {
      setBusy(b => { const n = { ...b }; delete n[item.id]; return n; });
      setDeleteConfirm(null);
    }
  };

  const autoTitle = useCallback((구분, partner, project) => {
    const scope = project || partner;
    if (!scope) return "";
    if (구분 === "지출기안") {
      const n = items.filter(i => i.파트너사 === partner && i.구분 === "지출기안" && (!project || i.프로젝트 === project)).length;
      return `[${scope}] ${n === 0 ? "프로토타입" : `이터레이션#${n}`} 지출기안`;
    }
    return `[${scope}] ${구분}`;
  }, [items]);

  useEffect(() => {
    if (!showForm || editingId || titleTouched) return;
    const t = autoTitle(form.구분, form.파트너사.trim(), form.프로젝트.trim());
    setForm(f => f.제목 === t ? f : { ...f, 제목: t });
  }, [showForm, editingId, titleTouched, form.구분, form.파트너사, form.프로젝트, autoTitle]); // eslint-disable-line

  // 템플릿 일괄 생성
  const createRows = async (rows) => {
    setCreatingTpl(true);
    try {
      for (const fields of rows) {
        const r = await fetch(`${API_BASE}/api/partner-admin`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fields),
        });
        if (r.ok) {
          const { item } = await r.json();
          setItems(prev => [item, ...prev]);
        }
      }
    } finally { setCreatingTpl(false); }
  };

  // 신규 파트너 템플릿: 파트너십계약 + 거래처등록
  const createPartnerTemplate = (partner) => createRows([
    { 제목: `[${partner}] 파트너십계약`, 파트너사: partner, 구분: "파트너십계약", 상태: "요청전" },
    { 제목: `[${partner}] 거래처등록`, 파트너사: partner, 구분: "거래처등록", 상태: "요청전" },
  ]);

  // 신규 프로젝트 템플릿: 부속합의서 + 프로토타입 지출기안
  const createProjectTemplate = (partner, proj) => createRows([
    { 제목: `[${proj}] 부속합의서`, 파트너사: partner, 프로젝트: proj, 구분: "부속합의서", 상태: "요청전" },
    { 제목: `[${proj}] 프로토타입 지출기안`, 파트너사: partner, 프로젝트: proj, 구분: "지출기안", 이터레이션구분: "프로토타입", 상태: "요청전" },
  ]);

  const openAdd = (구분, partner, project) => {
    setEditingId(null);
    setTitleTouched(false);
    setForm({ ...EMPTY_FORM, 구분, 파트너사: partner || "", 프로젝트: project || "", 제목: autoTitle(구분, partner, project) });
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setTitleTouched(true);
    const f = { ...EMPTY_FORM };
    Object.keys(EMPTY_FORM).forEach(k => {
      f[k] = item[k] ?? EMPTY_FORM[k];
      if (f[k] === null) f[k] = typeof EMPTY_FORM[k] === "boolean" ? false : "";
    });
    setForm(f);
    setShowForm(true);
  };

  const submit = async () => {
    if (!form.제목.trim() || !form.파트너사.trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, 제목: form.제목.trim(), 파트너사: form.파트너사.trim(), 프로젝트: form.프로젝트.trim() };
      const r = await fetch(`${API_BASE}/api/partner-admin`, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { pageId: editingId, ...payload } : payload),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const { item } = await r.json();
      setItems(prev => editingId ? prev.map(i => i.id === editingId ? item : i) : [item, ...prev]);
      setShowForm(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
    } catch (e) { alert(`저장 실패: ${e.message}`); }
    finally { setSaving(false); }
  };

  const input = { width: "100%", padding: "7px 10px", fontSize: 12, border: "1px solid var(--line)", borderRadius: 4, background: "var(--card)", color: "var(--text)", boxSizing: "border-box" };
  const label = { fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 4, display: "block" };
  const isContract = CONTRACT_KINDS.includes(form.구분);
  const isProjectLevel = PROJECT_LEVEL_KINDS.includes(form.구분);

  // ── 사이드바 파트너 항목 ──
  const renderSidebarPartner = (partner) => {
    const rows = byPartner[partner] || [];
    const done = rows.filter(i => i.상태 === "완료").length;
    const pct = rows.length === 0 ? 0 : Math.round((done / rows.length) * 100);
    const isActive = selected === partner;
    const projCount = new Set(rows.filter(i => i.프로젝트).map(i => i.프로젝트)).size;
    const warn = rows.some(i => {
      const d = dday(i.만료일);
      const docsMissing = (DOCS_BY_KIND[i.구분] || []).some(doc => !i[doc]) && i.상태 === "진행중";
      return docsMissing || (CONTRACT_KINDS.includes(i.구분) && d !== null && d >= 0 && d <= 30);
    });
    return (
      <div key={partner} style={{ borderBottom: "1px solid var(--line)" }}>
        <div onClick={() => setSelected(partner)}
          style={{
            padding: "10px 14px", cursor: "pointer",
            borderLeft: `2px solid ${isActive ? amber : "transparent"}`,
            background: isActive ? amberFaint : "transparent",
            transition: "background .1s",
          }}
          onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#F8F9FA"; }}
          onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
            <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{partner}</span>
            {warn && <span style={{ width: 6, height: 6, borderRadius: "50%", background: red, flexShrink: 0 }} />}
            {projCount > 0 && <span style={{ fontSize: 10, color: "var(--muted)", flexShrink: 0 }}>프로젝트 {projCount}</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ flex: 1, height: 2, background: "var(--line)", borderRadius: 1, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: done === rows.length && rows.length > 0 ? green : amber, borderRadius: 1, transition: "width .3s" }} />
            </div>
            <span style={{ fontSize: 9, color: "var(--muted)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{done}/{rows.length}</span>
          </div>
        </div>
      </div>
    );
  };

  // ── 행 렌더러 (행정 탭 스타일) ──
  const renderRow = (item, idx) => {
    const done = item.상태 === "완료";
    const inProgress = item.상태 === "진행중";
    const isBusy = !!busy[item.id];
    const docs = DOCS_BY_KIND[item.구분] || [];
    const docsDone = docs.filter(d => item[d]).length;
    const docsMissing = docs.filter(d => !item[d]);
    const d = dday(item.만료일);

    return (
      <div key={item.id} style={{
        display: "grid", gridTemplateColumns: "40px 1fr 76px 66px 70px 150px 28px",
        padding: "0 20px", height: 44, alignItems: "center", gap: 12,
        opacity: isBusy ? 0.5 : 1, background: "var(--card)",
        borderBottom: "1px solid var(--line)",
      }}
        onMouseEnter={e => { e.currentTarget.style.background = "#F8F9FA"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "var(--card)"; }}>
        {/* 체크 서클 — 클릭 시 상태 순환 */}
        <div onClick={() => !isBusy && cycleStatus(item)} title="클릭해서 상태 변경" style={{
          width: 22, height: 22, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 700, fontVariantNumeric: "tabular-nums",
          cursor: isBusy ? "wait" : "pointer",
          border: `1.5px solid ${done ? green : inProgress ? amber : "var(--line)"}`,
          background: done ? greenFaint : inProgress ? amberFaint : "transparent",
          color: done ? green : inProgress ? amber : "var(--muted)",
          transition: "all .15s", flexShrink: 0,
        }}>{done ? "✓" : idx + 1}</div>

        {/* 제목 */}
        <div style={{ minWidth: 0, overflow: "hidden" }}>
          <span onClick={() => openEdit(item)} title="클릭하여 상세 수정" style={{
            fontSize: 13, fontWeight: done ? 400 : 500, cursor: "pointer",
            color: done ? "var(--muted)" : "var(--text)",
            textDecoration: done ? "line-through" : "none",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block",
          }}>{item.제목}</span>
          {(item.메모 || (d !== null && d >= 0 && d <= 30)) && !done && (
            <span style={{ fontSize: 9, letterSpacing: ".03em", color: d !== null && d <= 30 && d >= 0 ? (d <= 7 ? red : "#C2410C") : "var(--muted)", fontWeight: 600, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {d !== null && d >= 0 && d <= 30 ? `만료 D-${d}${item.메모 ? " · " : ""}` : ""}{item.메모}
            </span>
          )}
        </div>

        {/* 구분 */}
        <span style={{ fontSize: 10.5, color: "var(--muted)", whiteSpace: "nowrap" }}>{item.구분}</span>

        {/* 상태 */}
        <StatusBadge 상태={item.상태 || "요청전"} />

        {/* 서류 */}
        {docs.length > 0 ? (
          <span title={docsMissing.length ? `미수령: ${docsMissing.join(", ")}` : "서류 완비"}
            style={{ fontSize: 10.5, fontVariantNumeric: "tabular-nums", color: docsMissing.length && inProgress ? "#C2410C" : "var(--muted)", fontWeight: docsMissing.length && inProgress ? 700 : 400, whiteSpace: "nowrap" }}>
            서류 {docsDone}/{docs.length}
          </span>
        ) : <span />}

        {/* 링크 */}
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          {item.계약서URL ? (
            <a href={item.계약서URL} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, fontWeight: 600, padding: "3px 7px", borderRadius: 3, background: blueFaint, color: blue, border: "1px solid rgba(0,120,212,.25)", textDecoration: "none", whiteSpace: "nowrap" }}>계약서 →</a>
          ) : CONTRACT_KINDS.includes(item.구분) ? (
            <button onClick={() => openEdit(item)} style={{ fontSize: 10, fontWeight: 500, padding: "3px 7px", borderRadius: 3, border: "1px dashed var(--line)", background: "transparent", color: "var(--muted)", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>+ 계약서</button>
          ) : null}
          {item.기안링크 ? (
            <a href={item.기안링크} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, fontWeight: 600, padding: "3px 7px", borderRadius: 3, background: greenFaint, color: green, border: "1px solid rgba(22,163,74,.25)", textDecoration: "none", whiteSpace: "nowrap" }}>기안 →</a>
          ) : item.구분 === "지출기안" ? (
            <button onClick={() => openEdit(item)} style={{ fontSize: 10, fontWeight: 500, padding: "3px 7px", borderRadius: 3, border: "1px dashed var(--line)", background: "transparent", color: "var(--muted)", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>+ 기안</button>
          ) : null}
        </div>

        {/* 삭제 */}
        {deleteConfirm === item.id ? (
          <button onClick={() => remove(item)} style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: red, border: "none", borderRadius: 3, padding: "2px 5px", cursor: "pointer" }}>확인</button>
        ) : (
          <button onClick={() => { setDeleteConfirm(item.id); setTimeout(() => setDeleteConfirm(c => c === item.id ? null : c), 3000); }}
            style={{ fontSize: 11, border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer", opacity: 0.35, fontFamily: "inherit" }} title="삭제">✕</button>
        )}
      </div>
    );
  };

  // 그룹 디바이더 (프로젝트 헤더)
  const renderDivider = (text, right) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 20px", background: "#F8F9FA", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--muted)" }}>{text}</span>
      <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
      {right}
    </div>
  );

  const selectedRows = selected ? (byPartner[selected] || []) : [];
  const commonRows = selectedRows.filter(i => PARTNER_LEVEL_KINDS.includes(i.구분));
  const projectNames = [...new Set(selectedRows.filter(i => PROJECT_LEVEL_KINDS.includes(i.구분)).map(i => i.프로젝트 || "(프로젝트 미지정)"))].sort();
  const sortByDone = list => [...list.filter(i => i.상태 !== "완료"), ...list.filter(i => i.상태 === "완료")];
  const doneCount = selectedRows.filter(i => i.상태 === "완료").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 500, border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden", background: "var(--card)" }}>
      <style>{`
        .slim-scroll { scrollbar-width: thin; scrollbar-color: transparent transparent; }
        .slim-scroll:hover { scrollbar-color: rgba(120,124,135,.35) transparent; }
        .slim-scroll::-webkit-scrollbar { width: 5px; }
        .slim-scroll::-webkit-scrollbar-track { background: transparent; }
        .slim-scroll::-webkit-scrollbar-thumb { background: transparent; border-radius: 10px; }
        .slim-scroll:hover::-webkit-scrollbar-thumb { background: rgba(120,124,135,.35); }
        .slim-scroll::-webkit-scrollbar-thumb:hover { background: rgba(120,124,135,.55); }
      `}</style>

      {/* ── Metrics strip ── */}
      <div style={{ display: "flex", alignItems: "center", padding: "12px 20px", borderBottom: "1px solid var(--line)", background: "var(--card)", flexWrap: "wrap", gap: 8 }}>
        {[
          { label: "파트너사", value: visiblePartnerList.length, color: "var(--text)" },
          { label: "진행중 항목", value: totalPending, color: amber },
          { label: "완료", value: totalDone, color: green },
        ].map(({ label: l, value, color }, i) => (
          <div key={l} style={{ display: "flex", alignItems: "baseline", gap: 6, padding: "0 20px", borderRight: i < 2 ? "1px solid var(--line)" : "none" }}>
            <span style={{ fontSize: 22, fontWeight: 700, color, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{value}</span>
            <span style={{ fontSize: 11, color: "var(--muted)", letterSpacing: ".04em" }}>{l}</span>
          </div>
        ))}
        {alerts.length > 0 && (
          <span style={{ fontSize: 11, color: "#C2410C", fontWeight: 600, marginLeft: 8 }} title={alerts.join("\n")}>⏰ 만료 임박 {alerts.length}건</span>
        )}
        <div style={{ marginLeft: "auto" }}>
          <a href={NOTION_DB_URL} target="_blank" rel="noopener noreferrer"
            style={{ padding: "7px 14px", borderRadius: 4, border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontSize: 12, fontWeight: 600, textDecoration: "none", letterSpacing: ".02em" }}>
            Notion DB ↗
          </a>
        </div>
      </div>

      {/* ── Body ── */}
      {loading ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 13, minHeight: 300 }}>노션 데이터 불러오는 중…</div>
      ) : error ? (
        <div style={{ margin: 20, padding: "12px 16px", fontSize: 13, color: red, background: "rgba(220,38,38,.06)", border: "1px solid rgba(220,38,38,.2)", borderRadius: 4 }}>
          데이터 로드 실패: {error} <button onClick={load} style={{ marginLeft: 8 }}>재시도</button>
        </div>
      ) : (
        <div style={{ display: "flex", flex: 1, overflow: "hidden", height: 560, maxHeight: "70vh" }}>

          {/* ── Left nav ── */}
          <div style={{ width: 210, flexShrink: 0, borderRight: "1px solid var(--line)", display: "flex", flexDirection: "column", background: "var(--card)" }}>
            <div style={{ padding: "10px 14px 8px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)", flex: 1 }}>파트너사</span>
              <button onClick={() => setAddingPartner(true)} title="파트너사 추가" style={{
                fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 3,
                border: `1px solid ${amber}`, color: amber, background: amberFaint, cursor: "pointer", fontFamily: "inherit",
              }}>+</button>
              <button onClick={load} title="새로고침" style={{
                fontSize: 11, padding: "2px 6px", borderRadius: 3,
                border: "1px solid var(--line)", color: "var(--muted)", background: "transparent", cursor: "pointer", fontFamily: "inherit",
              }}>↻</button>
            </div>

            {addingPartner && (
              <form style={{ padding: "8px 12px", borderBottom: "1px solid var(--line)" }}
                onSubmit={e => {
                  e.preventDefault();
                  const name = newPartnerName.trim();
                  if (!name) return;
                  setPartners(prev => prev.includes(name) ? prev : [...prev, name]);
                  setSelected(name);
                  setAddingPartner(false);
                  setNewPartnerName("");
                  if (!items.some(i => i.파트너사 === name)) {
                    createPartnerTemplate(name).then(() => setAddingProject(true));
                  }
                }}>
                <input autoFocus value={newPartnerName} onChange={e => setNewPartnerName(e.target.value)}
                  onBlur={() => { if (!newPartnerName.trim()) setAddingPartner(false); }}
                  placeholder="파트너사명 입력 후 Enter"
                  style={{ width: "100%", padding: "6px 9px", fontSize: 12, border: "1px solid var(--line)", borderRadius: 4, background: "var(--card)", color: "var(--text)", boxSizing: "border-box" }} />
              </form>
            )}

            <div className="slim-scroll" style={{ flex: 1, overflowY: "auto" }}>
              {visiblePartnerList.length === 0 && (
                <div style={{ padding: "24px 14px", fontSize: 12, color: "var(--muted)", textAlign: "center" }}>파트너사 없음</div>
              )}
              {visiblePartnerList.map(renderSidebarPartner)}
            </div>
          </div>

          {/* ── Right detail ── */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
            {!selected ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 13 }}>파트너사를 선택하세요</div>
            ) : (
              <>
                {/* Detail header */}
                <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "var(--card)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{selected}</span>
                    {projectNames.filter(p => p !== "(프로젝트 미지정)").length > 0 && (
                      <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 8 }}>
                        프로젝트 {projectNames.filter(p => p !== "(프로젝트 미지정)").length}개
                      </span>
                    )}
                  </div>
                  {addingProject ? (
                    <form onSubmit={e => {
                      e.preventDefault();
                      const name = newProjectName.trim();
                      if (!name) return;
                      setAddingProject(false);
                      setNewProjectName("");
                      createProjectTemplate(selected, name);
                    }}>
                      <input autoFocus value={newProjectName} onChange={e => setNewProjectName(e.target.value)}
                        onBlur={() => { if (!newProjectName.trim()) setAddingProject(false); }}
                        placeholder="프로젝트명 입력 후 Enter"
                        style={{ padding: "4px 9px", fontSize: 11, border: "1px solid var(--line)", borderRadius: 4, background: "var(--card)", color: "var(--text)", width: 160 }} />
                    </form>
                  ) : (
                    <button onClick={() => setAddingProject(true)} disabled={creatingTpl} style={{
                      padding: "4px 11px", borderRadius: 4, border: `1px solid ${amber}`, background: amberFaint,
                      color: amber, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: creatingTpl ? 0.5 : 1,
                    }}>{creatingTpl ? "생성 중…" : "+ 프로젝트"}</button>
                  )}
                  <button onClick={() => openAdd("파트너십계약", selected)} style={{
                    padding: "4px 11px", borderRadius: 4, border: "1px solid var(--line)", background: "transparent",
                    color: "var(--muted)", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  }}>+ 항목</button>
                  <span style={{ fontSize: 11, color: "var(--muted)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                    <span style={{ fontWeight: 700, color: green }}>{doneCount}</span>/{selectedRows.length} 완료
                  </span>
                </div>

                {/* Column headers */}
                <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 76px 66px 70px 150px 28px", padding: "0 20px", height: 32, alignItems: "center", borderBottom: "1px solid var(--line)", background: "#F8F9FA", gap: 12 }}>
                  {["#", "항목", "구분", "상태", "서류", "링크", ""].map((h, i) => (
                    <span key={i} style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--muted)" }}>{h}</span>
                  ))}
                </div>

                {/* Rows */}
                <div className="slim-scroll" style={{ flex: 1, overflowY: "auto" }}>
                  {selectedRows.length === 0 && (
                    <div style={{ padding: "30px 20px", fontSize: 12.5, color: "var(--muted)", textAlign: "center" }}>
                      아직 항목이 없습니다.
                      <button onClick={() => openAdd("파트너십계약", selected)} style={{ marginLeft: 8, fontSize: 11, padding: "2px 8px", border: "1px dashed var(--line)", borderRadius: 4, background: "transparent", color: "var(--muted)", cursor: "pointer" }}>+ 파트너십계약</button>
                    </div>
                  )}

                  {commonRows.length > 0 && (
                    <>
                      {renderDivider("파트너 공통")}
                      {sortByDone(commonRows).map((item, idx) => renderRow(item, idx))}
                    </>
                  )}

                  {projectNames.map(proj => {
                    const list = selectedRows.filter(i => PROJECT_LEVEL_KINDS.includes(i.구분) && (i.프로젝트 || "(프로젝트 미지정)") === proj);
                    return (
                      <div key={proj}>
                        {renderDivider(proj,
                          <button onClick={() => openAdd("지출기안", selected, proj === "(프로젝트 미지정)" ? "" : proj)}
                            style={{ fontSize: 9, fontWeight: 600, padding: "1px 7px", border: "1px dashed var(--line)", borderRadius: 3, background: "transparent", color: "var(--muted)", cursor: "pointer", fontFamily: "inherit" }}>
                            + 지출기안
                          </button>
                        )}
                        {sortByDone(list).map((item, idx) => renderRow(item, idx))}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 추가/수정 모달 */}
      {showForm && (
        <div onClick={() => !saving && setShowForm(false)}
          style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", overflowY: "auto", padding: "30px 0" }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: 460, maxWidth: "92vw", background: "var(--card)", borderRadius: 10, padding: 22, boxShadow: "0 8px 30px rgba(0,0,0,0.18)", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>
              {editingId ? "항목 수정" : "항목 추가"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <span style={label}>파트너사 *</span>
                  <input style={input} list="partner-list" value={form.파트너사}
                    onChange={e => setForm(f => ({ ...f, 파트너사: e.target.value }))} placeholder="선택 또는 신규 입력" />
                  <datalist id="partner-list">{allPartners.map(p => <option key={p} value={p} />)}</datalist>
                </div>
                <div>
                  <span style={label}>구분</span>
                  <select style={input} value={form.구분} onChange={e => setForm(f => ({ ...f, 구분: e.target.value }))}>
                    {ALL_KINDS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              {isProjectLevel && (
                <div>
                  <span style={label}>프로젝트 *</span>
                  <input style={input} list="project-list" value={form.프로젝트}
                    onChange={e => setForm(f => ({ ...f, 프로젝트: e.target.value }))} placeholder="예: Dice Battle" />
                  <datalist id="project-list">
                    {[...new Set(items.filter(i => i.파트너사 === form.파트너사 && i.프로젝트).map(i => i.프로젝트))].map(p => <option key={p} value={p} />)}
                  </datalist>
                </div>
              )}
              <div>
                <span style={label}>제목 *</span>
                <input style={input} value={form.제목} onChange={e => { setTitleTouched(true); setForm(f => ({ ...f, 제목: e.target.value })); }} placeholder="파트너사·구분 선택 시 자동 완성" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <span style={label}>상태</span>
                  <select style={input} value={form.상태} onChange={e => setForm(f => ({ ...f, 상태: e.target.value }))}>
                    {STATUS_ORDER.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                {form.구분 === "지출기안" && (
                  <div>
                    <span style={label}>이터레이션 구분</span>
                    <input style={input} value={form.이터레이션구분} onChange={e => setForm(f => ({ ...f, 이터레이션구분: e.target.value }))} placeholder="프로토타입 / 이터레이션1..." />
                  </div>
                )}
              </div>

              {isContract && (<>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {["체결일", "만료일"].map(field => (
                    <div key={field}>
                      <span style={label}>
                        {field}
                        {form[field] && (
                          <button onClick={() => setForm(f => ({ ...f, [field]: "" }))}
                            style={{ marginLeft: 6, fontSize: 10, padding: "0 5px", border: "1px solid var(--line)", borderRadius: 3, background: "transparent", color: "var(--muted)", cursor: "pointer" }}>없음</button>
                        )}
                      </span>
                      <input type="date" style={input} value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} />
                    </div>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end" }}>
                  <div>
                    <span style={label}>계약서 URL</span>
                    <input style={input} value={form.계약서URL} onChange={e => setForm(f => ({ ...f, 계약서URL: e.target.value }))} placeholder="https:// (원드라이브)" />
                  </div>
                  <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", paddingBottom: 8 }} title="자동갱신 조항이 있는 계약">
                    <input type="checkbox" checked={form.자동갱신} onChange={e => setForm(f => ({ ...f, 자동갱신: e.target.checked }))} />
                    자동갱신
                  </label>
                </div>
              </>)}

              {DOCS_BY_KIND[form.구분] && (
                <div>
                  <span style={label}>필요 서류</span>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", padding: "4px 0" }}>
                    {DOCS_BY_KIND[form.구분].map(doc => (
                      <label key={doc} style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                        <input type="checkbox" checked={form[doc]} onChange={e => setForm(f => ({ ...f, [doc]: e.target.checked }))} />
                        {doc}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {form.구분 === "거래처등록" && (
                <div>
                  <span style={{ ...label, marginTop: 4 }}>거래처 정보</span>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {VENDOR_FIELDS.map(([field, hint]) => (
                      <input key={field} style={input} value={form[field]} placeholder={field + (hint ? ` (${hint})` : "")}
                        onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} />
                    ))}
                  </div>
                </div>
              )}

              {form.구분 === "지출기안" && (<>
                <div>
                  <span style={label}>기안 링크</span>
                  <input style={input} value={form.기안링크} onChange={e => setForm(f => ({ ...f, 기안링크: e.target.value }))} placeholder="https:// (네이버웍스 기안)" />
                </div>
                <div>
                  <span style={{ ...label, marginTop: 4 }}>해외 송금 정보</span>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {BANK_FIELDS.map(field => (
                      <input key={field} style={input} value={form[field]} placeholder={field}
                        onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} />
                    ))}
                  </div>
                </div>
              </>)}

              <div>
                <span style={label}>메모</span>
                <input style={input} value={form.메모} onChange={e => setForm(f => ({ ...f, 메모: e.target.value }))} placeholder="특이사항" />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
              <button onClick={() => setShowForm(false)} disabled={saving}
                style={{ padding: "8px 16px", fontSize: 12.5, border: "1px solid var(--line)", borderRadius: 6, background: "var(--card)", color: "var(--text)", cursor: "pointer" }}>취소</button>
              <button onClick={submit} disabled={saving || !form.제목.trim() || !form.파트너사.trim() || (isProjectLevel && !form.프로젝트.trim())}
                style={{ padding: "8px 18px", fontSize: 12.5, fontWeight: 600, border: "none", borderRadius: 6, background: amber, color: "#1a1a1a", cursor: "pointer", opacity: saving || !form.제목.trim() || !form.파트너사.trim() || (isProjectLevel && !form.프로젝트.trim()) ? 0.5 : 1 }}>
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
