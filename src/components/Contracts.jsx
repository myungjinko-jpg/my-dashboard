import { useCallback, useEffect, useMemo, useState } from "react";

const IS_DEV = import.meta.env.DEV;
const API_BASE = IS_DEV ? "http://localhost:5601" : "";

const NOTION_DB_URL = "https://app.notion.com/p/519164c16c9145679dafce69b6d9ab58";

const CONTRACT_KINDS = ["파트너십계약", "부속합의서", "NDA"];
const PARTNER_LEVEL_KINDS = ["파트너십계약", "NDA", "거래처등록"];
const PROJECT_LEVEL_KINDS = ["부속합의서", "지출기안"];
const ALL_KINDS = ["파트너십계약", "NDA", "거래처등록", "부속합의서", "지출기안"];
const STATUS_ORDER = ["요청전", "진행중", "완료"];
const STATUS_DOT = { 요청전: "#C9CDD4", 진행중: "#F5B400", 완료: "#16A34A" };

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

function StatusDot({ 상태, onClick, busy }) {
  const s = 상태 || "요청전";
  return (
    <button onClick={onClick} title="클릭해서 상태 변경" disabled={busy}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "none", background: "transparent", cursor: "pointer", padding: 0, fontSize: 11.5, color: "var(--muted)", whiteSpace: "nowrap", opacity: busy ? 0.5 : 1 }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: STATUS_DOT[s], flexShrink: 0 }} />
      {s}
    </button>
  );
}

function DocSummary({ item }) {
  const docs = DOCS_BY_KIND[item.구분] || [];
  if (!docs.length) return <span />;
  const done = docs.filter(d => item[d]).length;
  const missing = docs.filter(d => !item[d]);
  const complete = done === docs.length;
  return (
    <span title={complete ? "서류 완비" : `미수령: ${missing.join(", ")}`}
      style={{ fontSize: 11, fontVariantNumeric: "tabular-nums", color: complete ? "var(--muted)" : "#C2410C", fontWeight: complete ? 400 : 600, whiteSpace: "nowrap" }}>
      서류 {done}/{docs.length}
    </span>
  );
}

export default function Contracts() {
  const [items, setItems]         = useState([]);
  const [partners, setPartners]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [selected, setSelected]   = useState("전체");
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving]       = useState(false);
  const [busy, setBusy]           = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [addingPartner, setAddingPartner] = useState(false);
  const [newPartnerName, setNewPartnerName] = useState("");
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

  // 추가 모드에서 파트너사/구분/프로젝트 변경 시 제목 자동 완성 (직접 수정 전까지)
  useEffect(() => {
    if (!showForm || editingId || titleTouched) return;
    const t = autoTitle(form.구분, form.파트너사.trim(), form.프로젝트.trim());
    setForm(f => f.제목 === t ? f : { ...f, 제목: t });
  }, [showForm, editingId, titleTouched, form.구분, form.파트너사, form.프로젝트, autoTitle]); // eslint-disable-line

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

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>데이터 불러오는 중...</div>;
  if (error) return <div style={{ padding: 40, textAlign: "center", color: "#DC2626", fontSize: 13 }}>로드 실패: {error} <button onClick={load} style={{ marginLeft: 8 }}>재시도</button></div>;

  const visiblePartners = selected === "전체" ? allPartners : [selected];

  // 공통 행 렌더러 — 정갈한 그리드 행
  const Row = ({ item, indent }) => {
    const d = dday(item.만료일);
    const dateInfo = CONTRACT_KINDS.includes(item.구분)
      ? (item.만료일
          ? (d < 0 ? "만료" : `~${item.만료일.slice(2)}`)
          : item.체결일 ? item.체결일.slice(2) : "")
      : "";
    const dateColor = d !== null && d >= 0 && d <= 30 ? (d <= 7 ? "#DC2626" : "#C2410C") : "var(--muted)";
    return (
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 64px 70px 76px 70px 24px", gap: 10, alignItems: "center", padding: `7px 16px 7px ${indent ? 34 : 16}px`, borderTop: "1px solid var(--line)", fontSize: 12.5 }}>
        <span onClick={() => openEdit(item)} title={`클릭하여 상세 수정${item.메모 ? ` — ${item.메모}` : ""}`}
          style={{ cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text)" }}>
          {item.제목}
          {item.자동갱신 && <span title="자동갱신" style={{ marginLeft: 4, fontSize: 10, color: "var(--muted)" }}>갱신</span>}
        </span>
        <StatusDot 상태={item.상태} onClick={() => cycleStatus(item)} busy={busy[item.id]} />
        <DocSummary item={item} />
        <span style={{ fontSize: 11, color: dateColor, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
          {dateInfo}{d !== null && d >= 0 && d <= 30 ? ` (D-${d})` : ""}
        </span>
        <span style={{ display: "flex", gap: 8 }}>
          {item.계약서URL && <a href={item.계약서URL} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "var(--muted)", textDecoration: "none" }}>문서 ↗</a>}
          {item.기안링크 && <a href={item.기안링크} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "var(--muted)", textDecoration: "none" }}>기안 ↗</a>}
        </span>
        {deleteConfirm === item.id ? (
          <button onClick={() => remove(item)} style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: "#DC2626", border: "none", borderRadius: 3, padding: "2px 5px", cursor: "pointer" }}>확인</button>
        ) : (
          <button onClick={() => { setDeleteConfirm(item.id); setTimeout(() => setDeleteConfirm(c => c === item.id ? null : c), 3000); }}
            style={{ fontSize: 11, border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer", opacity: 0.35 }} title="삭제">✕</button>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden", background: "var(--card)", minHeight: 460 }}>
      {/* 사이드바 */}
      <div style={{ width: 210, flexShrink: 0, borderRight: "1px solid var(--line)", padding: "12px 0" }}>
        <div style={{ padding: "0 14px 10px", fontSize: 10, fontWeight: 700, letterSpacing: ".08em", color: "var(--muted)", textTransform: "uppercase" }}>파트너사</div>
        {["전체", ...allPartners].map(name => {
          const rows = name === "전체" ? items : (byPartner[name] || []);
          const warn = name !== "전체" && rows.some(i => {
            const d = dday(i.만료일);
            const docsMissing = (DOCS_BY_KIND[i.구분] || []).some(doc => !i[doc]) && i.상태 !== "요청전" && i.상태 !== "완료";
            return docsMissing || (CONTRACT_KINDS.includes(i.구분) && d !== null && d >= 0 && d <= 30);
          });
          const projCount = name !== "전체" ? new Set(rows.filter(i => i.프로젝트).map(i => i.프로젝트)).size : 0;
          return (
            <button key={name} onClick={() => setSelected(name)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
                padding: "7px 14px", border: "none", cursor: "pointer", textAlign: "left", fontSize: 12.5,
                background: selected === name ? "#F8F9FA" : "transparent",
                borderLeft: selected === name ? "3px solid #F5B400" : "3px solid transparent",
                color: "var(--text)", fontWeight: selected === name ? 600 : 400,
              }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
              <span style={{ display: "flex", gap: 5, alignItems: "center" }}>
                {warn && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#DC2626" }} />}
                {name !== "전체" && projCount > 0 && <span style={{ fontSize: 10, color: "var(--muted)" }}>{projCount}</span>}
                {name === "전체" && <span style={{ fontSize: 10, color: "var(--muted)" }}>{items.length}</span>}
              </span>
            </button>
          );
        })}
        <div style={{ padding: "12px 14px 0" }}>
          {addingPartner ? (
            <form onSubmit={e => {
              e.preventDefault();
              const name = newPartnerName.trim();
              if (!name) return;
              setPartners(prev => prev.includes(name) ? prev : [...prev, name]);
              setSelected(name);
              setAddingPartner(false);
              setNewPartnerName("");
            }}>
              <input autoFocus value={newPartnerName} onChange={e => setNewPartnerName(e.target.value)}
                onBlur={() => { if (!newPartnerName.trim()) setAddingPartner(false); }}
                placeholder="파트너사명 입력 후 Enter"
                style={{ width: "100%", padding: "6px 9px", fontSize: 12, border: "1px solid var(--line)", borderRadius: 5, background: "var(--card)", color: "var(--text)", boxSizing: "border-box" }} />
            </form>
          ) : (
            <button onClick={() => setAddingPartner(true)}
              style={{ width: "100%", padding: "7px 0", fontSize: 12, fontWeight: 600, border: "1px dashed var(--line)", borderRadius: 5, background: "transparent", color: "var(--muted)", cursor: "pointer" }}>
              + 파트너사 추가
            </button>
          )}
        </div>
      </div>

      {/* 메인 */}
      <div style={{ flex: 1, minWidth: 0, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <a href={NOTION_DB_URL} target="_blank" rel="noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: "var(--muted)", textDecoration: "none", padding: "4px 10px", border: "1px solid var(--line)", borderRadius: 5 }}>
            Notion DB 열기 ↗
          </a>
        </div>
        {alerts.length > 0 && (
          <div style={{ marginBottom: 12, padding: "8px 14px", borderRadius: 6, border: "1px solid var(--line)", borderLeft: "3px solid #C2410C", fontSize: 12, color: "var(--text)" }}>
            <span style={{ fontWeight: 600, color: "#C2410C" }}>만료 임박</span>
            <span style={{ color: "var(--muted)", marginLeft: 8 }}>{alerts.join(" · ")}</span>
          </div>
        )}

        {visiblePartners.length === 0 && (
          <div style={{ padding: 36, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>등록된 파트너가 없습니다. "+ 항목 추가"로 시작하세요.</div>
        )}

        {visiblePartners.map(partner => {
          const rows = byPartner[partner] || [];
          const common = rows.filter(i => PARTNER_LEVEL_KINDS.includes(i.구분));
          const projectRows = rows.filter(i => PROJECT_LEVEL_KINDS.includes(i.구분));
          const projects = [...new Set(projectRows.map(i => i.프로젝트 || "(프로젝트 미지정)"))].sort();
          return (
            <div key={partner} style={{ border: "1px solid var(--line)", borderRadius: 8, marginBottom: 12, overflow: "hidden" }}>
              {/* 파트너 헤더 */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", background: "#F8F9FA" }}>
                <span style={{ fontSize: 13.5, fontWeight: 700 }}>{partner}</span>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>
                  프로젝트 {projects.filter(p => p !== "(프로젝트 미지정)").length} · 항목 {rows.length}
                </span>
                <span style={{ flex: 1 }} />
                <button onClick={() => openAdd("부속합의서", partner)}
                  style={{ fontSize: 10.5, padding: "2px 8px", border: "1px solid var(--line)", borderRadius: 4, background: "var(--card)", color: "var(--muted)", cursor: "pointer" }}>
                  + 프로젝트 항목
                </button>
              </div>

              {/* 파트너 공통 */}
              {common.length > 0 && (
                <div>
                  <div style={{ padding: "8px 16px 4px", fontSize: 10, fontWeight: 700, letterSpacing: ".06em", color: "var(--muted)", textTransform: "uppercase" }}>파트너 공통</div>
                  {common.map(item => <Row key={item.id} item={item} />)}
                </div>
              )}

              {/* 프로젝트별 */}
              {projects.map(proj => {
                const list = projectRows.filter(i => (i.프로젝트 || "(프로젝트 미지정)") === proj);
                return (
                  <div key={proj}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px 4px", borderTop: "1px solid var(--line)" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{proj}</span>
                      <span style={{ fontSize: 10.5, color: "var(--muted)" }}>
                        지출기안 {list.filter(i => i.구분 === "지출기안" && i.상태 === "완료").length}/{list.filter(i => i.구분 === "지출기안").length}
                      </span>
                      <span style={{ flex: 1 }} />
                      <button onClick={() => openAdd("지출기안", partner, proj === "(프로젝트 미지정)" ? "" : proj)}
                        style={{ fontSize: 10, padding: "1px 7px", border: "1px dashed var(--line)", borderRadius: 3, background: "transparent", color: "var(--muted)", cursor: "pointer" }}>
                        + 지출기안
                      </button>
                    </div>
                    {list.map(item => <Row key={item.id} item={item} indent />)}
                  </div>
                );
              })}

              {rows.length === 0 && (
                <div style={{ padding: "14px 16px", fontSize: 12, color: "var(--muted)" }}>
                  아직 항목이 없습니다.
                  <button onClick={() => openAdd("파트너십계약", partner)} style={{ marginLeft: 8, fontSize: 11, padding: "2px 8px", border: "1px dashed var(--line)", borderRadius: 4, background: "transparent", color: "var(--muted)", cursor: "pointer" }}>+ 파트너십계약</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

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
                  <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", paddingBottom: 8 }}>
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
                style={{ padding: "8px 18px", fontSize: 12.5, fontWeight: 600, border: "none", borderRadius: 6, background: "#F5B400", color: "#1a1a1a", cursor: "pointer", opacity: saving || !form.제목.trim() || !form.파트너사.trim() || (isProjectLevel && !form.프로젝트.trim()) ? 0.5 : 1 }}>
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
