import { useCallback, useEffect, useMemo, useState } from "react";

const IS_DEV = import.meta.env.DEV;
const API_BASE = IS_DEV ? "http://localhost:5601" : "";

const CONTRACT_KINDS = ["파트너십계약", "부속합의서", "NDA"];
const STATUS_ORDER = ["요청전", "진행중", "완료"];
const STATUS_COLOR = {
  요청전: { fg: "#6B7280", bg: "rgba(107,114,128,0.10)" },
  진행중: { fg: "#B45309", bg: "rgba(245,180,0,0.14)" },
  완료:   { fg: "#16A34A", bg: "rgba(22,163,74,0.10)" },
};
const KIND_COLOR = {
  파트너십계약: { fg: "#1D4ED8", bg: "rgba(29,78,216,0.08)" },
  부속합의서:   { fg: "#BE185D", bg: "rgba(190,24,93,0.08)" },
  NDA:          { fg: "#7C3AED", bg: "rgba(124,58,237,0.08)" },
  거래처등록:   { fg: "#B45309", bg: "rgba(245,180,0,0.12)" },
  지출기안:     { fg: "#0F766E", bg: "rgba(15,118,110,0.08)" },
};

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
  제목: "", 파트너사: "", 구분: "파트너십계약", 상태: "요청전", 메모: "",
  체결일: "", 만료일: "", 자동갱신: false, 계약서URL: "", 기안링크: "", 이터레이션구분: "",
  법인등록증: false, 법인통장: false, 부속합의서: false, 스펙내용: false, 인보이스: false,
  거래처식별번호: "", 거래처명: "", 거래처국가: "", 거래처주소: "", 거래처대표: "", 거래처담당자: "", 거래처Email: "",
  BankName: "", BranchName: "", BankAddress: "", BeneficiaryName: "", AccountNumber: "",
};

function Pill({ label, color, onClick, title }) {
  const c = color || { fg: "#6B7280", bg: "rgba(107,114,128,0.08)" };
  return (
    <span onClick={onClick} title={title}
      style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".03em", padding: "2px 7px", borderRadius: 3, background: c.bg, color: c.fg, whiteSpace: "nowrap", cursor: onClick ? "pointer" : "default", userSelect: "none" }}>
      {label}
    </span>
  );
}

function dday(만료일) {
  if (!만료일) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const exp = new Date(만료일); exp.setHours(0, 0, 0, 0);
  return Math.round((exp - today) / 86400000);
}

function DdayBadge({ 만료일 }) {
  const d = dday(만료일);
  if (d === null) return null;
  let fg = "var(--muted)", bg = "transparent", label = `D-${d}`;
  if (d < 0) { fg = "#6B7280"; bg = "rgba(107,114,128,0.10)"; label = "만료"; }
  else if (d <= 7)  { fg = "#DC2626"; bg = "rgba(220,38,38,0.10)"; }
  else if (d <= 30) { fg = "#C2410C"; bg = "rgba(234,88,12,0.10)"; }
  else return <span style={{ fontSize: 10.5, color: "var(--muted)" }}>D-{d}</span>;
  return <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 3, background: bg, color: fg }}>{label}</span>;
}

function DocChips({ item, onToggle, busy }) {
  const docs = DOCS_BY_KIND[item.구분] || [];
  if (!docs.length) return null;
  return (
    <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
      {docs.map(doc => (
        <span key={doc} onClick={() => !busy && onToggle(item, doc)}
          title={`${doc} ${item[doc] ? "수령 완료" : "미수령"} — 클릭해서 토글`}
          style={{
            fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 3, cursor: "pointer", userSelect: "none",
            background: item[doc] ? "rgba(22,163,74,0.10)" : "rgba(220,38,38,0.07)",
            color: item[doc] ? "#16A34A" : "#DC2626",
            border: `1px solid ${item[doc] ? "rgba(22,163,74,0.25)" : "rgba(220,38,38,0.2)"}`,
            opacity: busy ? 0.5 : 1,
          }}>
          {item[doc] ? "✓" : "✕"} {doc}
        </span>
      ))}
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

  // 파트너별 파이프라인 요약: 계약 → 거래처등록 → 지출기안
  const pipeline = useCallback((rows) => {
    const contract = rows.filter(i => CONTRACT_KINDS.includes(i.구분));
    const vendor = rows.find(i => i.구분 === "거래처등록");
    const expenses = rows.filter(i => i.구분 === "지출기안");
    const mainContract = rows.find(i => i.구분 === "파트너십계약");
    const missingDocs = rows.reduce((n, i) => n + (DOCS_BY_KIND[i.구분] || []).filter(d => !i[d] && i.상태 !== "요청전").length, 0);
    const expiring = contract.some(i => { const d = dday(i.만료일); return d !== null && d >= 0 && d <= 30; });
    return { contract, mainContract, vendor, expenses, missingDocs, expiring };
  }, []);

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

  const toggleDoc = (item, doc) => patch(item.id, { [doc]: !item[doc] });

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

  const openAdd = (구분, partner) => {
    setEditingId(null);
    let 제목 = "";
    if (partner) {
      if (구분 === "지출기안") {
        const n = (byPartner[partner] || []).filter(i => i.구분 === "지출기안").length;
        제목 = `[${partner}] ${n === 0 ? "프로토타입" : `이터레이션#${n}`} 지출기안`;
      } else 제목 = `[${partner}] ${구분}`;
    }
    setForm({ ...EMPTY_FORM, 구분, 파트너사: partner || "", 제목, 이터레이션구분: 구분 === "지출기안" ? "" : "" });
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    const f = { ...EMPTY_FORM };
    Object.keys(EMPTY_FORM).forEach(k => { f[k] = item[k] ?? EMPTY_FORM[k]; if (f[k] === null) f[k] = typeof EMPTY_FORM[k] === "boolean" ? false : ""; });
    setForm(f);
    setShowForm(true);
  };

  const submit = async () => {
    if (!form.제목.trim() || !form.파트너사.trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, 제목: form.제목.trim(), 파트너사: form.파트너사.trim() };
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

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>데이터 불러오는 중...</div>;
  if (error) return <div style={{ padding: 40, textAlign: "center", color: "#DC2626", fontSize: 13 }}>로드 실패: {error} <button onClick={load} style={{ marginLeft: 8 }}>재시도</button></div>;

  const visiblePartners = selected === "전체" ? allPartners : [selected];

  return (
    <div style={{ display: "flex", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden", background: "var(--card)", minHeight: 460 }}>
      {/* 사이드바 */}
      <div style={{ width: 210, flexShrink: 0, borderRight: "1px solid var(--line)", padding: "12px 0" }}>
        <div style={{ padding: "0 14px 10px", fontSize: 10, fontWeight: 700, letterSpacing: ".08em", color: "var(--muted)", textTransform: "uppercase" }}>파트너사</div>
        {["전체", ...allPartners].map(name => {
          const rows = name === "전체" ? items : (byPartner[name] || []);
          const pl = pipeline(rows);
          const warn = pl.missingDocs > 0 || pl.expiring;
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
              <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {name !== "전체" && warn && <span style={{ fontSize: 9, fontWeight: 700, color: "#DC2626" }}>●</span>}
                <span style={{ fontSize: 10, color: "var(--muted)" }}>{rows.length}</span>
              </span>
            </button>
          );
        })}
        <div style={{ padding: "12px 14px 0" }}>
          <button onClick={() => openAdd("파트너십계약", selected !== "전체" ? selected : "")}
            style={{ width: "100%", padding: "7px 0", fontSize: 12, fontWeight: 600, border: "1px dashed var(--line)", borderRadius: 5, background: "transparent", color: "var(--muted)", cursor: "pointer" }}>
            + 항목 추가
          </button>
        </div>
      </div>

      {/* 메인 */}
      <div style={{ flex: 1, minWidth: 0, padding: 14 }}>
        {alerts.length > 0 && (
          <div style={{ marginBottom: 12, padding: "9px 14px", borderRadius: 6, background: "rgba(234,88,12,0.07)", border: "1px solid rgba(234,88,12,0.25)", fontSize: 12, color: "#C2410C", fontWeight: 500 }}>
            ⏰ {alerts.join(" · ")}
          </div>
        )}

        {visiblePartners.length === 0 && (
          <div style={{ padding: 36, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>등록된 파트너가 없습니다. "+ 항목 추가"로 시작하세요.</div>
        )}

        {visiblePartners.map(partner => {
          const rows = byPartner[partner] || [];
          const pl = pipeline(rows);
          const contractDone = pl.mainContract?.상태 === "완료";
          const vendorDone = pl.vendor?.상태 === "완료";
          const groups = [
            ["계약", rows.filter(i => CONTRACT_KINDS.includes(i.구분))],
            ["거래처 등록", rows.filter(i => i.구분 === "거래처등록")],
            ["지출기안", rows.filter(i => i.구분 === "지출기안")],
          ];
          return (
            <div key={partner} style={{ border: "1px solid var(--line)", borderRadius: 8, marginBottom: 12, overflow: "hidden" }}>
              {/* 파트너 헤더 + 파이프라인 */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "#F8F9FA", flexWrap: "wrap" }}>
                <span style={{ fontSize: 13.5, fontWeight: 700 }}>{partner}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--muted)" }}>
                  <Pill label={`계약 ${pl.mainContract ? (contractDone ? "✓" : pl.mainContract.상태) : "—"}`} color={contractDone ? STATUS_COLOR.완료 : pl.mainContract ? STATUS_COLOR[pl.mainContract.상태] : undefined} />
                  <span>→</span>
                  <Pill label={`거래처 ${pl.vendor ? (vendorDone ? "✓" : pl.vendor.상태) : "—"}`} color={vendorDone ? STATUS_COLOR.완료 : pl.vendor ? STATUS_COLOR[pl.vendor.상태] : undefined} />
                  <span>→</span>
                  <Pill label={`지출기안 ${pl.expenses.filter(e => e.상태 === "완료").length}/${pl.expenses.length}`} color={pl.expenses.length && pl.expenses.every(e => e.상태 === "완료") ? STATUS_COLOR.완료 : pl.expenses.length ? STATUS_COLOR.진행중 : undefined} />
                </span>
                {pl.missingDocs > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#DC2626" }}>서류 누락 {pl.missingDocs}</span>}
                <span style={{ flex: 1 }} />
                <button onClick={() => openAdd("지출기안", partner)}
                  style={{ fontSize: 10.5, padding: "2px 8px", border: "1px dashed var(--line)", borderRadius: 4, background: "transparent", color: "var(--muted)", cursor: "pointer" }}>
                  + 지출기안
                </button>
              </div>

              {groups.map(([title, list]) => list.length > 0 && (
                <div key={title}>
                  <div style={{ padding: "7px 16px 3px", fontSize: 10, fontWeight: 700, letterSpacing: ".06em", color: "var(--muted)", textTransform: "uppercase" }}>{title}</div>
                  {list.map(item => (
                    <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", borderTop: "1px solid var(--line)", fontSize: 12.5, opacity: busy[item.id] ? 0.5 : 1, flexWrap: "wrap" }}>
                      <Pill label={item.구분} color={KIND_COLOR[item.구분]} />
                      <span onClick={() => openEdit(item)} title="클릭하여 상세 수정"
                        style={{ fontWeight: 500, cursor: "pointer", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.제목}
                      </span>
                      {item.이터레이션구분 && <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{item.이터레이션구분}</span>}
                      <Pill label={item.상태 || "요청전"} color={STATUS_COLOR[item.상태 || "요청전"]}
                        onClick={() => cycleStatus(item)} title="클릭해서 상태 변경" />
                      <DocChips item={item} onToggle={toggleDoc} busy={busy[item.id]} />
                      <span style={{ flex: 1 }} />
                      {CONTRACT_KINDS.includes(item.구분) && item.만료일 && <DdayBadge 만료일={item.만료일} />}
                      {item.체결일 && <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{item.체결일}{item.자동갱신 ? " 🔄" : ""}</span>}
                      {item.계약서URL && <a href={item.계약서URL} target="_blank" rel="noreferrer" style={{ fontSize: 10.5, color: "#0078D4", textDecoration: "none", fontWeight: 600 }}>계약서 ↗</a>}
                      {item.기안링크 && <a href={item.기안링크} target="_blank" rel="noreferrer" style={{ fontSize: 10.5, color: "#0078D4", textDecoration: "none", fontWeight: 600 }}>기안 ↗</a>}
                      {deleteConfirm === item.id ? (
                        <button onClick={() => remove(item)} style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: "#DC2626", border: "none", borderRadius: 3, padding: "2px 6px", cursor: "pointer" }}>확인</button>
                      ) : (
                        <button onClick={() => { setDeleteConfirm(item.id); setTimeout(() => setDeleteConfirm(c => c === item.id ? null : c), 3000); }}
                          style={{ fontSize: 12, border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer", opacity: 0.5 }} title="삭제">✕</button>
                      )}
                    </div>
                  ))}
                </div>
              ))}
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
                    {Object.keys(KIND_COLOR).map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <span style={label}>제목 *</span>
                <input style={input} value={form.제목} onChange={e => setForm(f => ({ ...f, 제목: e.target.value }))} placeholder="예: [MMC] 파트너십계약" />
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
              <button onClick={submit} disabled={saving || !form.제목.trim() || !form.파트너사.trim()}
                style={{ padding: "8px 18px", fontSize: 12.5, fontWeight: 600, border: "none", borderRadius: 6, background: "#F5B400", color: "#1a1a1a", cursor: "pointer", opacity: saving || !form.제목.trim() || !form.파트너사.trim() ? 0.5 : 1 }}>
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
