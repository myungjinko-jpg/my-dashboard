import { useCallback, useEffect, useMemo, useState } from "react";

const IS_DEV = import.meta.env.DEV;
const API_BASE = IS_DEV ? "http://localhost:5601" : "";

const STATUS_ORDER = ["협상중", "법무검토", "서명대기", "체결완료", "만료"];
const STATUS_COLOR = {
  협상중:   { fg: "#B45309", bg: "rgba(245,180,0,0.12)" },
  법무검토: { fg: "#C2410C", bg: "rgba(234,88,12,0.10)" },
  서명대기: { fg: "#0369A1", bg: "rgba(3,105,161,0.08)" },
  체결완료: { fg: "#16A34A", bg: "rgba(22,163,74,0.10)" },
  만료:     { fg: "#6B7280", bg: "rgba(107,114,128,0.10)" },
};
const TYPE_COLOR = {
  본계약:     { fg: "#1D4ED8", bg: "rgba(29,78,216,0.08)" },
  부속합의서: { fg: "#BE185D", bg: "rgba(190,24,93,0.08)" },
  NDA:        { fg: "#7C3AED", bg: "rgba(124,58,237,0.08)" },
  기타:       { fg: "#6B7280", bg: "rgba(107,114,128,0.08)" },
};

function Pill({ label, color }) {
  const c = color || TYPE_COLOR.기타;
  return (
    <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".03em", padding: "2px 7px", borderRadius: 3, background: c.bg, color: c.fg, whiteSpace: "nowrap" }}>
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

function DdayBadge({ 만료일, 상태 }) {
  const d = dday(만료일);
  if (d === null) return <span style={{ color: "var(--muted)", fontSize: 11 }}>—</span>;
  let fg = "var(--muted)", bg = "transparent", label = `D-${d}`;
  if (d < 0 || 상태 === "만료") { fg = "#6B7280"; bg = "rgba(107,114,128,0.10)"; label = "만료"; }
  else if (d <= 7)  { fg = "#DC2626"; bg = "rgba(220,38,38,0.10)"; }
  else if (d <= 30) { fg = "#C2410C"; bg = "rgba(234,88,12,0.10)"; }
  else return <span style={{ fontSize: 11, color: "var(--muted)" }}>D-{d}</span>;
  return <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 3, background: bg, color: fg }}>{label}</span>;
}

const EMPTY_FORM = { 계약명: "", 스튜디오: "", 계약유형: "본계약", 상태: "협상중", 체결일: "", 만료일: "", 자동갱신: false, 계약서링크: "", 메모: "", 상위계약: "" };

export default function Contracts() {
  const [items, setItems]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [selected, setSelected]   = useState("전체");
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [editingId, setEditingId] = useState(null); // 수정 모드일 때 pageId
  const [statusEdit, setStatusEdit] = useState(null); // pageId of open dropdown
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [busy, setBusy]           = useState({});

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await fetch(`${API_BASE}/api/contracts-notion`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const { items: data } = await r.json();
      setItems(data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const studios = useMemo(() => {
    const map = {};
    items.forEach(i => {
      const s = i.스튜디오 || "미지정";
      if (!map[s]) map[s] = { total: 0, alert: 0 };
      map[s].total += 1;
      const d = dday(i.만료일);
      if (d !== null && d <= 30 && i.상태 !== "만료") map[s].alert += 1;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

  const expiring = useMemo(() =>
    items.filter(i => { const d = dday(i.만료일); return d !== null && d <= 30 && d >= 0 && i.상태 !== "만료"; }),
  [items]);

  const visible = useMemo(() => {
    const list = selected === "전체" ? items : items.filter(i => (i.스튜디오 || "미지정") === selected);
    // 본계약 먼저, 그 아래 해당 부속합의서 묶음
    const mains = list.filter(i => i.계약유형 !== "부속합의서");
    const subs = list.filter(i => i.계약유형 === "부속합의서");
    const out = [];
    mains.forEach(m => {
      out.push(m);
      subs.filter(s => s.상위계약 && s.상위계약 === m.계약명).forEach(s => out.push({ ...s, _nested: true }));
    });
    subs.filter(s => !mains.some(m => m.계약명 === s.상위계약)).forEach(s => out.push(s));
    return out;
  }, [items, selected]);

  const patch = async (pageId, fields) => {
    setBusy(b => ({ ...b, [pageId]: true }));
    setItems(prev => prev.map(i => i.id === pageId ? { ...i, ...fields } : i));
    try {
      await fetch(`${API_BASE}/api/contracts-notion`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, ...fields }),
      });
    } catch { load(); }
    finally { setBusy(b => ({ ...b, [pageId]: false })); }
  };

  const remove = async (item) => {
    setBusy(b => ({ ...b, [item.id]: true }));
    try {
      await fetch(`${API_BASE}/api/contracts-notion`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: item.id }),
      });
      setItems(prev => prev.filter(i => i.id !== item.id));
    } finally {
      setBusy(b => ({ ...b, [item.id]: false }));
      setDeleteConfirm(null);
    }
  };

  const submit = async () => {
    if (!form.계약명.trim() || !form.스튜디오.trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, 계약명: form.계약명.trim(), 스튜디오: form.스튜디오.trim() };
      const r = await fetch(`${API_BASE}/api/contracts-notion`, {
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

  const openSubForm = (main) => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, 스튜디오: main.스튜디오, 계약유형: "부속합의서", 상위계약: main.계약명, 계약명: `${main.스튜디오} 부속합의서 ` });
    setShowForm(true);
  };

  const openEditForm = (item) => {
    setEditingId(item.id);
    setForm({
      계약명: item.계약명, 스튜디오: item.스튜디오, 계약유형: item.계약유형, 상태: item.상태,
      체결일: item.체결일 || "", 만료일: item.만료일 || "", 자동갱신: item.자동갱신,
      계약서링크: item.계약서링크 || "", 메모: item.메모 || "", 상위계약: item.상위계약 || "",
    });
    setShowForm(true);
  };

  const input = { width: "100%", padding: "7px 10px", fontSize: 12, border: "1px solid var(--line)", borderRadius: 4, background: "var(--card)", color: "var(--text)", boxSizing: "border-box" };
  const label = { fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 4, display: "block" };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>계약 데이터 불러오는 중...</div>;
  if (error) return <div style={{ padding: 40, textAlign: "center", color: "#DC2626", fontSize: 13 }}>로드 실패: {error} <button onClick={load} style={{ marginLeft: 8 }}>재시도</button></div>;

  return (
    <div style={{ display: "flex", gap: 0, border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden", background: "var(--card)", minHeight: 420 }}>
      {/* 사이드바 */}
      <div style={{ width: 200, flexShrink: 0, borderRight: "1px solid var(--line)", background: "var(--card)", padding: "12px 0" }}>
        <div style={{ padding: "0 14px 10px", fontSize: 10, fontWeight: 700, letterSpacing: ".08em", color: "var(--muted)", textTransform: "uppercase" }}>스튜디오</div>
        {[["전체", { total: items.length, alert: expiring.length }], ...studios].map(([name, info]) => (
          <button key={name} onClick={() => setSelected(name)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
              padding: "8px 14px", border: "none", cursor: "pointer", textAlign: "left", fontSize: 12.5,
              background: selected === name ? "#F8F9FA" : "transparent",
              borderLeft: selected === name ? "3px solid #F5B400" : "3px solid transparent",
              color: "var(--text)", fontWeight: selected === name ? 600 : 400,
            }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
            <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
              {info.alert > 0 && <span style={{ fontSize: 9, fontWeight: 700, color: "#DC2626", background: "rgba(220,38,38,0.10)", padding: "1px 5px", borderRadius: 8 }}>{info.alert}</span>}
              <span style={{ fontSize: 10, color: "var(--muted)" }}>{info.total}</span>
            </span>
          </button>
        ))}
        <div style={{ padding: "12px 14px 0" }}>
          <button onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setShowForm(true); }}
            style={{ width: "100%", padding: "7px 0", fontSize: 12, fontWeight: 600, border: "1px dashed var(--line)", borderRadius: 5, background: "transparent", color: "var(--muted)", cursor: "pointer" }}>
            + 계약 추가
          </button>
        </div>
      </div>

      {/* 메인 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* 만료 임박 배너 */}
        {expiring.length > 0 && (
          <div style={{ margin: 14, marginBottom: 0, padding: "9px 14px", borderRadius: 6, background: "rgba(234,88,12,0.07)", border: "1px solid rgba(234,88,12,0.25)", fontSize: 12, color: "#C2410C", fontWeight: 500 }}>
            ⏰ 30일 내 만료 예정 계약 {expiring.length}건: {expiring.map(i => `${i.계약명}(D-${dday(i.만료일)})`).join(", ")}
          </div>
        )}

        {/* 테이블 헤더 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 84px 90px 90px 72px 60px 40px", gap: 8, padding: "10px 16px", margin: "14px 14px 0", background: "#F8F9FA", borderRadius: "6px 6px 0 0", fontSize: 10, fontWeight: 700, letterSpacing: ".05em", color: "var(--muted)", textTransform: "uppercase", alignItems: "center" }}>
          <span>계약명</span><span>유형</span><span>상태</span><span>체결일</span><span>만료일</span><span>D-Day</span><span>문서</span><span></span>
        </div>

        <div style={{ margin: "0 14px 14px", border: "1px solid var(--line)", borderTop: "none", borderRadius: "0 0 6px 6px" }}>
          {visible.length === 0 && (
            <div style={{ padding: 36, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>등록된 계약이 없습니다. 좌측 "+ 계약 추가"로 시작하세요.</div>
          )}
          {visible.map((item) => (
            <div key={item.id} style={{ display: "grid", gridTemplateColumns: "1fr 90px 84px 90px 90px 72px 60px 40px", gap: 8, padding: "10px 16px", borderTop: "1px solid var(--line)", fontSize: 12.5, alignItems: "center", opacity: busy[item.id] ? 0.5 : 1, background: "var(--card)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                {item._nested && <span style={{ color: "var(--muted)", flexShrink: 0 }}>└</span>}
                <span onClick={() => openEditForm(item)}
                  style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: item._nested ? 400 : 500, cursor: "pointer" }}
                  title={`클릭하여 수정${item.메모 ? ` — ${item.메모}` : ""}`}>
                  {item.계약명}
                </span>
                {selected === "전체" && !item._nested && <span style={{ fontSize: 10, color: "var(--muted)", flexShrink: 0 }}>{item.스튜디오}</span>}
                {item.계약유형 === "본계약" && (
                  <button onClick={() => openSubForm(item)} title="부속합의서 추가"
                    style={{ fontSize: 10, padding: "1px 6px", border: "1px dashed var(--line)", borderRadius: 3, background: "transparent", color: "var(--muted)", cursor: "pointer", flexShrink: 0 }}>
                    + 부속
                  </button>
                )}
              </span>
              <span><Pill label={item.계약유형} color={TYPE_COLOR[item.계약유형]} /></span>
              <span style={{ position: "relative" }}>
                <button onClick={() => setStatusEdit(statusEdit === item.id ? null : item.id)}
                  style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer" }}>
                  <Pill label={item.상태} color={STATUS_COLOR[item.상태]} />
                </button>
                {statusEdit === item.id && (
                  <div style={{ position: "absolute", top: "110%", left: 0, zIndex: 10, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 6, boxShadow: "0 4px 12px rgba(0,0,0,0.10)", padding: 4, display: "flex", flexDirection: "column", gap: 2 }}>
                    {STATUS_ORDER.map(s => (
                      <button key={s} onClick={() => { setStatusEdit(null); if (s !== item.상태) patch(item.id, { 상태: s }); }}
                        style={{ border: "none", background: s === item.상태 ? "#F8F9FA" : "transparent", padding: "4px 10px", borderRadius: 4, cursor: "pointer", textAlign: "left" }}>
                        <Pill label={s} color={STATUS_COLOR[s]} />
                      </button>
                    ))}
                  </div>
                )}
              </span>
              <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{item.체결일 || "—"}</span>
              <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
                {item.만료일 || "—"}{item.자동갱신 && <span title="자동갱신" style={{ marginLeft: 3 }}>🔄</span>}
              </span>
              <span><DdayBadge 만료일={item.만료일} 상태={item.상태} /></span>
              <span>
                {item.계약서링크 ? (
                  <a href={item.계약서링크} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#0078D4", textDecoration: "none", fontWeight: 600 }}>열기 ↗</a>
                ) : (
                  <button onClick={() => { const url = window.prompt("계약서 링크 (드라이브 URL):"); if (url) patch(item.id, { 계약서링크: url }); }}
                    style={{ fontSize: 10, padding: "1px 6px", border: "1px dashed var(--line)", borderRadius: 3, background: "transparent", color: "var(--muted)", cursor: "pointer" }}>
                    + 링크
                  </button>
                )}
              </span>
              <span>
                {deleteConfirm === item.id ? (
                  <button onClick={() => remove(item)} style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: "#DC2626", border: "none", borderRadius: 3, padding: "2px 6px", cursor: "pointer" }}>확인</button>
                ) : (
                  <button onClick={() => { setDeleteConfirm(item.id); setTimeout(() => setDeleteConfirm(c => c === item.id ? null : c), 3000); }}
                    style={{ fontSize: 12, border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer", opacity: 0.5 }} title="삭제">✕</button>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 계약 추가 모달 */}
      {showForm && (
        <div onClick={() => !saving && setShowForm(false)}
          style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: 420, maxWidth: "92vw", background: "var(--card)", borderRadius: 10, padding: 22, boxShadow: "0 8px 30px rgba(0,0,0,0.18)" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>
              {editingId ? `계약 수정 — ${form.계약명}` : form.계약유형 === "부속합의서" && form.상위계약 ? `부속합의서 추가 — ${form.상위계약}` : "계약 추가"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <span style={label}>계약명 *</span>
                <input style={input} value={form.계약명} onChange={e => setForm(f => ({ ...f, 계약명: e.target.value }))} placeholder="예: MMC 파트너십 계약" autoFocus />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <span style={label}>스튜디오 *</span>
                  <input style={input} value={form.스튜디오} onChange={e => setForm(f => ({ ...f, 스튜디오: e.target.value }))} placeholder="예: MMC" />
                </div>
                <div>
                  <span style={label}>계약유형</span>
                  <select style={input} value={form.계약유형} onChange={e => setForm(f => ({ ...f, 계약유형: e.target.value }))}>
                    {Object.keys(TYPE_COLOR).map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <span style={label}>상태</span>
                  <select style={input} value={form.상태} onChange={e => setForm(f => ({ ...f, 상태: e.target.value }))}>
                    {STATUS_ORDER.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 8 }}>
                  <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input type="checkbox" checked={form.자동갱신} onChange={e => setForm(f => ({ ...f, 자동갱신: e.target.checked }))} />
                    자동갱신
                  </label>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <span style={label}>체결일</span>
                  <input type="date" style={input} value={form.체결일} onChange={e => setForm(f => ({ ...f, 체결일: e.target.value }))} />
                </div>
                <div>
                  <span style={label}>만료일</span>
                  <input type="date" style={input} value={form.만료일} onChange={e => setForm(f => ({ ...f, 만료일: e.target.value }))} />
                </div>
              </div>
              <div>
                <span style={label}>계약서 링크</span>
                <input style={input} value={form.계약서링크} onChange={e => setForm(f => ({ ...f, 계약서링크: e.target.value }))} placeholder="https:// (원드라이브)" />
              </div>
              <div>
                <span style={label}>메모</span>
                <input style={input} value={form.메모} onChange={e => setForm(f => ({ ...f, 메모: e.target.value }))} placeholder="특이사항" />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
              <button onClick={() => setShowForm(false)} disabled={saving}
                style={{ padding: "8px 16px", fontSize: 12.5, border: "1px solid var(--line)", borderRadius: 6, background: "var(--card)", color: "var(--text)", cursor: "pointer" }}>취소</button>
              <button onClick={submit} disabled={saving || !form.계약명.trim() || !form.스튜디오.trim()}
                style={{ padding: "8px 18px", fontSize: 12.5, fontWeight: 600, border: "none", borderRadius: 6, background: "#F5B400", color: "#1a1a1a", cursor: "pointer", opacity: saving || !form.계약명.trim() || !form.스튜디오.trim() ? 0.5 : 1 }}>
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
