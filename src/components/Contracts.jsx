import { useCallback, useEffect, useMemo, useState } from "react";

const IS_DEV = import.meta.env.DEV;
const API_BASE = IS_DEV ? "http://localhost:5601" : "";

const NOTION_DB_URL = "https://app.notion.com/p/519164c16c9145679dafce69b6d9ab58";

const CONTRACT_KINDS = ["파트너십계약", "부속합의서", "NDA"];
const PARTNER_LEVEL_KINDS = ["파트너십계약", "NDA", "거래처등록"];
const PROJECT_LEVEL_KINDS = ["부속합의서", "지출기안"];
const ALL_KINDS = ["파트너십계약", "NDA", "거래처등록", "부속합의서", "지출기안"];
const STATUS_ORDER = ["요청전", "진행중", "완료"];

// 순차 흐름 정렬 순서 (그룹 내에서 이 순서로 진행)
const KIND_ORDER = { 파트너십계약: 1, NDA: 2, 거래처등록: 3, 부속합의서: 1, 지출기안: 2 };

// 파트너 공통 서류 — 거래처등록에서 한 번 등록하면 지출기안 등에선 연동만 표시
const PARTNER_DOCS = ["법인등록증", "법인통장"];

// 국가 표기(국문 통일) → 국기. 매핑 없는 국가는 텍스트만 표시
const COUNTRY_FLAGS = {
  한국: "🇰🇷", 대한민국: "🇰🇷", 일본: "🇯🇵", 중국: "🇨🇳", 대만: "🇹🇼", 홍콩: "🇭🇰",
  미국: "🇺🇸", 캐나다: "🇨🇦", 영국: "🇬🇧", 독일: "🇩🇪", 프랑스: "🇫🇷", 튀르키예: "🇹🇷", 터키: "🇹🇷",
  베트남: "🇻🇳", 태국: "🇹🇭", 인도네시아: "🇮🇩", 필리핀: "🇵🇭", 싱가포르: "🇸🇬", 말레이시아: "🇲🇾", 인도: "🇮🇳", 호주: "🇦🇺",
};
const countryLabel = (c) => (COUNTRY_FLAGS[c] ? `${COUNTRY_FLAGS[c]} ${c}` : c);

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

// 항목별 가이드 (무엇을 어떻게)
const KIND_GUIDE = {
  파트너십계약: {
    desc: "BD에게 파트너십 계약 진행을 요청하고, 체결까지 상태를 추적합니다.",
    steps: ["BD에게 파트너십 계약 요청", "법무/경영지원 검토 및 서명", "계약서 최종본을 원드라이브에 업로드 후 계약서 URL 등록"],
  },
  NDA: {
    desc: "비밀유지계약(NDA)을 체결합니다.",
    steps: ["NDA 초안 확보 및 검토", "양사 서명", "계약서 URL 등록"],
  },
  거래처등록: {
    desc: "경영지원팀에 거래처(파트너사) 등록을 요청합니다.",
    steps: [
      "필요 문서 확보: 법인등록증 · 법인통장(법인명=예금주명 동일)",
      "필요 정보 확보: 거래처 식별번호·거래처명(법인등록증 기재) / 국가 / 주소·도시·우편번호 / 대표·담당자·Email",
      "파트너십 계약 URL과 함께 경영지원팀에 등록 요청",
    ],
  },
  부속합의서: {
    desc: "기존 파트너십 계약에 프로젝트별 부속합의서를 추가합니다.",
    steps: ["기존 계약 조건 기반 부속합의서 초안 작성", "법무/경영지원 검토", "최종본 원드라이브 업로드 후 계약서 URL 등록"],
  },
  지출기안: {
    desc: "네이버웍스에서 프로토타입/이터레이션 비용 지급 기안을 상신합니다.",
    steps: [
      "필요 문서 확보: 법인등록증 · 법인통장 · 프로젝트 부속합의서 · 스펙 내용 · 인보이스",
      "해외 송금 정보 확보: Bank Name / Branch Name / Bank Address / Beneficiary Name / Account Number",
      "기안 상신 후 결재 완료 시 기안 링크 등록",
    ],
  },
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
  체결일: "", 만료일: "", 자동갱신: false, 계약서URL: "", 기안링크: "", 이터레이션구분: "", 파트너십계약포함: false,
  법인등록증: false, 법인통장: false, 부속합의서: false, 스펙내용: false, 인보이스: false,
  법인등록증링크: "", 법인통장링크: "", 부속합의서링크: "", 스펙내용링크: "", 인보이스링크: "",
  거래처식별번호: "", 거래처명: "", 거래처국가: "", 거래처주소: "", 거래처대표: "", 거래처담당자: "", 거래처Email: "",
  BankName: "", BranchName: "", BankAddress: "", BeneficiaryName: "", AccountNumber: "",
};

// 항목 → 폼 값 객체
function itemToForm(item) {
  const f = { ...EMPTY_FORM };
  Object.keys(EMPTY_FORM).forEach(k => {
    f[k] = item[k] ?? EMPTY_FORM[k];
    if (f[k] === null) f[k] = typeof EMPTY_FORM[k] === "boolean" ? false : "";
  });
  return f;
}

function dday(만료일) {
  if (!만료일) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const exp = new Date(만료일); exp.setHours(0, 0, 0, 0);
  return Math.round((exp - today) / 86400000);
}

// 그룹 내 순서 정렬 (지출기안 여러 건은 기존 순서 유지)
function orderGroup(rows) {
  return [...rows].sort((a, b) => (KIND_ORDER[a.구분] || 9) - (KIND_ORDER[b.구분] || 9));
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
  const [newPartnerProject, setNewPartnerProject] = useState("");
  const [newPartnerCountry, setNewPartnerCountry] = useState("");
  const [addingProject, setAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [guideModal, setGuideModal] = useState(null); // 가이드 모달 (구분명)
  const [sending, setSending] = useState(false);
  const [sentMsg, setSentMsg] = useState("");
  const [creatingTpl, setCreatingTpl] = useState(false);
  const [titleTouched, setTitleTouched] = useState(false);

  // 아코디언 순차 흐름 상태
  const [openId, setOpenId] = useState(null);  // null=자동(첫 미완료), ""=전체 접힘, id=해당 항목
  const [draft, setDraft] = useState(null);    // 인라인 편집 중인 값

  const sendAlert = async () => {
    setSending(true); setSentMsg("");
    try {
      const r = await fetch(`${API_BASE}/api/contracts-alert`, { method: "POST" });
      const data = await r.json();
      setSentMsg(data.sent ? `${data.sent}건 발송됨` : (data.message || "발송 완료"));
    } catch { setSentMsg("발송 실패"); }
    finally { setSending(false); setTimeout(() => setSentMsg(""), 4000); }
  };

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
      if (CONTRACT_KINDS.includes(i.구분) && !i.자동갱신 && d !== null && d >= 0 && d <= 30) out.push(`${i.제목} 만료 D-${d}`);
    });
    return out;
  }, [items]);

  const totalDone     = items.filter(i => i.상태 === "완료").length;
  const totalActive   = items.filter(i => i.상태 === "진행중").length;
  const totalWaiting  = items.filter(i => (i.상태 || "요청전") === "요청전").length;

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

  // 신규 파트너 템플릿: 파트너십계약 + 거래처등록 (국가는 거래처등록에 저장)
  const createPartnerTemplate = (partner, country) => createRows([
    { 제목: `[${partner}] 파트너십계약`, 파트너사: partner, 구분: "파트너십계약", 상태: "요청전" },
    { 제목: `[${partner}] 거래처등록`, 파트너사: partner, 구분: "거래처등록", 상태: "요청전", ...(country ? { 거래처국가: country } : {}) },
  ]);

  // 신규 프로젝트 템플릿 — 부속합의서 → 프로토타입 지출기안 순서
  // 첫 프로젝트: 부속합의서가 파트너십계약에 포함 → 완료 상태 + '파트너십계약 포함' 표시
  // 두 번째부터: 부속합의서는 별도 체결(요청전)
  const createProjectTemplate = (partner, proj) => {
    const isFirst = !items.some(i => i.파트너사 === partner && PROJECT_LEVEL_KINDS.includes(i.구분));
    const 부속 = isFirst
      ? { 제목: `[${proj}] 부속합의서`, 파트너사: partner, 프로젝트: proj, 구분: "부속합의서", 상태: "완료", 파트너십계약포함: true }
      : { 제목: `[${proj}] 부속합의서`, 파트너사: partner, 프로젝트: proj, 구분: "부속합의서", 상태: "요청전" };
    return createRows([
      부속,
      { 제목: `[${proj}] 프로토타입 지출기안`, 파트너사: partner, 프로젝트: proj, 구분: "지출기안", 이터레이션구분: "프로토타입", 상태: "요청전" },
    ]);
  };

  const openAdd = (구분, partner, project) => {
    setEditingId(null);
    setTitleTouched(false);
    setForm({ ...EMPTY_FORM, 구분, 파트너사: partner || "", 프로젝트: project || "", 제목: autoTitle(구분, partner, project) });
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setTitleTouched(true);
    setForm(itemToForm(item));
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

  // 공용 "추가" 버튼 스타일 — 전부 동일, accent(맥락상 유도할 하나)만 앰버 강조
  const addBtn = (accent) => ({
    padding: "5px 11px", borderRadius: 6, fontSize: 12, fontWeight: 600,
    cursor: "pointer", fontFamily: "inherit", lineHeight: 1, whiteSpace: "nowrap",
    border: `1px solid ${accent ? amber : "var(--line)"}`,
    background: accent ? amberFaint : "transparent",
    color: accent ? "#B45309" : "var(--muted)",
  });

  // 파트너의 거래처등록 항목 (파트너 공통 서류의 원본)
  const partnerVendor = (partner) => items.find(i => i.파트너사 === partner && i.구분 === "거래처등록") || null;
  // 파트너의 파트너십계약 계약서 URL (첫 프로젝트 부속합의서가 여기 포함됨)
  const partnerMasterUrl = (partner) => {
    const m = items.find(i => i.파트너사 === partner && i.구분 === "파트너십계약");
    return m ? (m.계약서URL || "") : "";
  };
  // 파트너 국가 — 거래처등록의 거래처국가 필드가 원본 (PROCESS.md 참고)
  const partnerCountry = (partner) => {
    const v = partnerVendor(partner);
    return v ? (v.거래처국가 || "").trim() : "";
  };
  // 서류 수령 여부 — 파트너 공통 서류는 거래처등록 상태를 따름
  const docReceived = (item, doc) => {
    if (item.구분 !== "거래처등록" && PARTNER_DOCS.includes(doc)) {
      const v = partnerVendor(item.파트너사);
      return v ? (!!v[doc] || !!v[`${doc}링크`]) : false;
    }
    return !!item[doc];
  };

  // ── 선택 파트너의 순차 그룹 구성 ──
  const selectedRows = selected ? (byPartner[selected] || []) : [];
  const commonRows = orderGroup(selectedRows.filter(i => PARTNER_LEVEL_KINDS.includes(i.구분)));
  const projectNames = [...new Set(selectedRows.filter(i => PROJECT_LEVEL_KINDS.includes(i.구분)).map(i => i.프로젝트 || "(프로젝트 미지정)"))].sort();
  const projectRows = (proj) => orderGroup(selectedRows.filter(i => PROJECT_LEVEL_KINDS.includes(i.구분) && (i.프로젝트 || "(프로젝트 미지정)") === proj));
  const doneCount = selectedRows.filter(i => i.상태 === "완료").length;

  // 강조 대상 판정 (맥락상 "지금 유도할 다음 액션" 하나만 앰버)
  const partnerIsPrimary = visiblePartnerList.length === 0;                              // 파트너 자체가 없을 때
  const hasRealProject = projectNames.some(p => p !== "(프로젝트 미지정)");
  const projectIsPrimary = selectedRows.length > 0 && !hasRealProject;                   // 공통 항목은 있는데 프로젝트가 아직 없을 때

  // 문서 순서대로 나열된 전체 스텝 (공통 → 프로젝트별)
  const orderedSteps = useMemo(() => {
    const list = [...commonRows];
    projectNames.forEach(p => list.push(...projectRows(p)));
    return list;
  }, [selectedRows]); // eslint-disable-line

  const firstIncompleteId = useMemo(() => (orderedSteps.find(i => i.상태 !== "완료") || {}).id || null, [orderedSteps]);
  const effectiveOpen = openId === null ? firstIncompleteId : openId;

  // 파트너 전환 시 아코디언 초기화 (자동 = 첫 미완료)
  useEffect(() => { setOpenId(null); }, [selected]);

  // 열린 스텝이 바뀌면 draft 로드
  useEffect(() => {
    if (!effectiveOpen) { setDraft(null); return; }
    const item = items.find(i => i.id === effectiveOpen);
    setDraft(item ? itemToForm(item) : null);
  }, [effectiveOpen]); // eslint-disable-line

  const openStep = (item) => setOpenId(item.id);
  const collapseStep = () => setOpenId("");

  // 그룹 내 다음 미완료 스텝
  const nextIncompleteInGroup = (item) => {
    const group = PARTNER_LEVEL_KINDS.includes(item.구분)
      ? commonRows
      : projectRows(item.프로젝트 || "(프로젝트 미지정)");
    return group.find(r => r.id !== item.id && r.상태 !== "완료") || null;
  };

  // 인라인 저장 (complete=true → 완료 처리 후 다음 단계로)
  const saveStep = async (item, complete) => {
    if (!draft) return;
    const fields = { ...draft, 제목: (draft.제목 || "").trim(), 파트너사: (draft.파트너사 || item.파트너사).trim(), 프로젝트: (draft.프로젝트 || "").trim() };
    fields.상태 = complete ? "완료" : (item.상태 === "완료" ? "완료" : "진행중");
    const next = complete ? nextIncompleteInGroup(item) : null;
    await patch(item.id, fields);
    if (complete) { if (next) openStep(next); else collapseStep(); }
  };

  // ── 공용 입력 필드 (모달 + 인라인 아코디언 공유) ──
  // vals: 값 객체, upd: setState 형태 업데이터, identity: 파트너사/구분/제목 등 식별 필드 표시 여부
  const renderFields = (vals, upd, identity) => {
    const isContract = CONTRACT_KINDS.includes(vals.구분);
    const isProjectLevel = PROJECT_LEVEL_KINDS.includes(vals.구분);
    const coveredForm = vals.구분 === "부속합의서" && vals.파트너십계약포함;  // 파트너십계약 포함 부속합의서
    const masterUrlForm = coveredForm ? partnerMasterUrl(vals.파트너사) : "";
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {identity && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <span style={label}>파트너사 *</span>
                <input style={input} list="partner-list" value={vals.파트너사}
                  onChange={e => upd(f => ({ ...f, 파트너사: e.target.value }))} placeholder="선택 또는 신규 입력" />
                <datalist id="partner-list">{allPartners.map(p => <option key={p} value={p} />)}</datalist>
              </div>
              <div>
                <span style={label}>구분</span>
                <select style={input} value={vals.구분} onChange={e => upd(f => ({ ...f, 구분: e.target.value }))}>
                  {ALL_KINDS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            {isProjectLevel && (
              <div>
                <span style={label}>프로젝트 *</span>
                <input style={input} list="project-list" value={vals.프로젝트}
                  onChange={e => upd(f => ({ ...f, 프로젝트: e.target.value }))} placeholder="예: Dice Battle" />
                <datalist id="project-list">
                  {[...new Set(items.filter(i => i.파트너사 === vals.파트너사 && i.프로젝트).map(i => i.프로젝트))].map(p => <option key={p} value={p} />)}
                </datalist>
              </div>
            )}
            <div>
              <span style={label}>제목 *</span>
              <input style={input} value={vals.제목} onChange={e => { setTitleTouched(true); upd(f => ({ ...f, 제목: e.target.value })); }} placeholder="파트너사·구분 선택 시 자동 완성" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <span style={label}>상태</span>
                <select style={input} value={vals.상태} onChange={e => upd(f => ({ ...f, 상태: e.target.value }))}>
                  {STATUS_ORDER.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              {vals.구분 === "지출기안" && (
                <div>
                  <span style={label}>이터레이션 구분</span>
                  <input style={input} value={vals.이터레이션구분} onChange={e => upd(f => ({ ...f, 이터레이션구분: e.target.value }))} placeholder="프로토타입 / 이터레이션1..." />
                </div>
              )}
            </div>
          </>
        )}

        {!identity && vals.구분 === "지출기안" && (
          <div>
            <span style={label}>이터레이션 구분</span>
            <input style={input} value={vals.이터레이션구분} onChange={e => upd(f => ({ ...f, 이터레이션구분: e.target.value }))} placeholder="프로토타입 / 이터레이션1..." />
          </div>
        )}

        {vals.구분 === "부속합의서" && vals.파트너십계약포함 && (
          <div style={{ fontSize: 11, color: "#B45309", background: amberFaint, border: "1px solid rgba(245,180,0,.3)", borderRadius: 5, padding: "6px 10px" }}>
            이 부속합의서는 파트너십계약(본계약)에 포함됩니다. 별도 체결 없이 파트너십계약서로 갈음합니다.
          </div>
        )}

        {isContract && (<>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {["체결일", "만료일"].map(field => (
              <div key={field}>
                <span style={label}>
                  {field}
                  {vals[field] && (
                    <button onClick={() => upd(f => ({ ...f, [field]: "" }))}
                      style={{ marginLeft: 6, fontSize: 10, padding: "0 5px", border: "1px solid var(--line)", borderRadius: 3, background: "transparent", color: "var(--muted)", cursor: "pointer" }}>없음</button>
                  )}
                </span>
                <input type="date" style={input} value={vals[field]} onChange={e => upd(f => ({ ...f, [field]: e.target.value }))} />
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end" }}>
            <div>
              <span style={label}>계약서 URL</span>
              {coveredForm ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 33 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".03em", color: "#B45309", background: amberFaint, border: "1px solid rgba(245,180,0,.3)", borderRadius: 3, padding: "1px 6px", flexShrink: 0 }}>파트너십계약 연동</span>
                  {masterUrlForm ? (
                    <a href={masterUrlForm} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: blue, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{masterUrlForm} ↗</a>
                  ) : (
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>파트너십계약서 링크 미등록</span>
                  )}
                </div>
              ) : (
                <input style={input} value={vals.계약서URL} onChange={e => upd(f => ({ ...f, 계약서URL: e.target.value }))} placeholder="https:// (원드라이브)" />
              )}
            </div>
            {!coveredForm && (
              <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", paddingBottom: 8 }} title="자동갱신 조항이 있는 계약">
                <input type="checkbox" checked={vals.자동갱신} onChange={e => upd(f => ({ ...f, 자동갱신: e.target.checked }))} />
                자동갱신
              </label>
            )}
          </div>
        </>)}

        {DOCS_BY_KIND[vals.구분] && (
          <div>
            <span style={label}>필요 서류 · 구글드라이브 링크</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "4px 0" }}>
              {DOCS_BY_KIND[vals.구분].map(doc => {
                const linkKey = `${doc}링크`;
                // 파트너 공통 서류 & 거래처등록이 아닌 항목 → 거래처등록에서 연동 (읽기 전용)
                const inherited = vals.구분 !== "거래처등록" && PARTNER_DOCS.includes(doc);
                if (inherited) {
                  const v = partnerVendor(vals.파트너사);
                  const inLink = v ? (v[linkKey] || "") : "";
                  const ok = v ? (!!v[doc] || !!inLink) : false;
                  return (
                    <div key={doc} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input type="checkbox" checked={ok} disabled title="거래처등록에서 연동됨"
                        style={{ accentColor: green, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, width: 82, flexShrink: 0, color: "var(--text)" }}>{doc}</span>
                      <span style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--muted)" }}>
                        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".03em", border: "1px solid var(--line)", borderRadius: 3, padding: "1px 5px", flexShrink: 0 }}>거래처등록 연동</span>
                        {!v && "거래처등록 항목 없음"}
                        {v && !inLink && "링크 미등록"}
                      </span>
                      {inLink && (
                        <a href={inLink} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 10, fontWeight: 600, padding: "5px 8px", borderRadius: 4, background: blueFaint, color: blue, border: "1px solid rgba(0,120,212,.25)", textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0 }}>열기 →</a>
                      )}
                    </div>
                  );
                }
                const linkVal = vals[linkKey] || "";
                return (
                  <div key={doc} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="checkbox" checked={vals[doc]} title="받음 표시"
                      onChange={e => upd(f => ({ ...f, [doc]: e.target.checked }))}
                      style={{ accentColor: green, cursor: "pointer", flexShrink: 0 }} />
                    <span style={{ fontSize: 12, width: 82, flexShrink: 0, color: "var(--text)" }}>{doc}</span>
                    <input style={{ ...input, flex: 1 }} value={linkVal} placeholder="구글드라이브 링크 붙여넣기"
                      onChange={e => { const v = e.target.value; upd(f => ({ ...f, [linkKey]: v, ...(v ? { [doc]: true } : {}) })); }} />
                    {linkVal && (
                      <a href={linkVal} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 10, fontWeight: 600, padding: "5px 8px", borderRadius: 4, background: blueFaint, color: blue, border: "1px solid rgba(0,120,212,.25)", textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0 }}>열기 →</a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {vals.구분 === "거래처등록" && (
          <div>
            <span style={{ ...label, marginTop: 4 }}>거래처 정보</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {VENDOR_FIELDS.map(([field, hint]) => (
                <input key={field} style={input} value={vals[field]} placeholder={field + (hint ? ` (${hint})` : "")}
                  onChange={e => upd(f => ({ ...f, [field]: e.target.value }))} />
              ))}
            </div>
          </div>
        )}

        {vals.구분 === "지출기안" && (<>
          <div>
            <span style={label}>기안 링크</span>
            <input style={input} value={vals.기안링크} onChange={e => upd(f => ({ ...f, 기안링크: e.target.value }))} placeholder="https:// (네이버웍스 기안)" />
          </div>
          <div>
            <span style={{ ...label, marginTop: 4 }}>해외 송금 정보</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {BANK_FIELDS.map(field => (
                <input key={field} style={input} value={vals[field]} placeholder={field}
                  onChange={e => upd(f => ({ ...f, [field]: e.target.value }))} />
              ))}
            </div>
          </div>
        </>)}

        <div>
          <span style={label}>메모</span>
          <input style={input} value={vals.메모} onChange={e => upd(f => ({ ...f, 메모: e.target.value }))} placeholder="특이사항" />
        </div>
      </div>
    );
  };

  // ── 사이드바 파트너 항목 ──
  const renderSidebarPartner = (partner) => {
    const rows = byPartner[partner] || [];
    const done = rows.filter(i => i.상태 === "완료").length;
    const pct = rows.length === 0 ? 0 : Math.round((done / rows.length) * 100);
    const isActive = selected === partner;
    const projCount = new Set(rows.filter(i => i.프로젝트).map(i => i.프로젝트)).size;
    const warn = rows.some(i => {
      const d = dday(i.만료일);
      const docsMissing = (DOCS_BY_KIND[i.구분] || []).some(doc => !docReceived(i, doc)) && i.상태 === "진행중";
      return docsMissing || (CONTRACT_KINDS.includes(i.구분) && !i.자동갱신 && d !== null && d >= 0 && d <= 30);
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

  // ── 아코디언 스텝 렌더러 ──
  // seq: 그룹 내 순번(1-base), reached: 이 스텝까지 순차 도달했는지(이전 단계 완료). 미도달=대기(흐림)
  const renderStep = (item, seq, reached) => {
    const done = item.상태 === "완료";
    const inProgress = item.상태 === "진행중";
    const isBusy = !!busy[item.id];
    const isOpen = effectiveOpen === item.id;
    const docs = DOCS_BY_KIND[item.구분] || [];
    const docsDone = docs.filter(d => docReceived(item, d)).length;
    const d = dday(item.만료일);
    const covered = item.구분 === "부속합의서" && item.파트너십계약포함;  // 파트너십계약에 포함된 첫 프로젝트 부속합의서
    const masterUrl = covered ? partnerMasterUrl(item.파트너사) : "";
    const dim = !isOpen && !done && !reached; // 대기 단계

    const accent = done ? green : inProgress ? amber : reached ? blue : "var(--line)";
    const headBg = isOpen ? "var(--card)" : done ? greenFaint : "var(--card)";

    return (
      <div key={item.id} style={{
        border: `${isOpen ? 2 : 1}px solid ${isOpen ? blue : done ? "rgba(22,163,74,.3)" : "var(--line)"}`,
        borderRadius: 8, marginBottom: 8, overflow: "hidden",
        background: "var(--card)", opacity: dim ? 0.6 : (isBusy ? 0.5 : 1),
        transition: "opacity .15s",
      }}>
        {/* 헤더 */}
        <div onClick={() => (isOpen ? collapseStep() : openStep(item))}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", cursor: "pointer", background: headBg, borderBottom: isOpen ? "1px solid var(--line)" : "none" }}>
          {/* 순번/완료 서클 — 클릭 시 상태 순환 */}
          <div onClick={e => { e.stopPropagation(); if (!isBusy) cycleStatus(item); }} title="클릭해서 상태 변경"
            style={{
              width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 700, fontVariantNumeric: "tabular-nums",
              cursor: isBusy ? "wait" : "pointer",
              border: `1.5px solid ${accent === "var(--line)" ? "var(--line)" : accent}`,
              background: done ? greenFaint : inProgress ? amberFaint : "transparent",
              color: done ? green : inProgress ? amber : "var(--muted)",
            }}>{done ? "✓" : seq}</div>

          {/* 제목 + 구분 */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{
                fontSize: 13, fontWeight: done ? 400 : 500,
                color: done ? "var(--muted)" : "var(--text)",
                textDecoration: done ? "line-through" : "none",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{item.제목}</span>
              {KIND_GUIDE[item.구분] && (
                <button onClick={e => { e.stopPropagation(); setGuideModal(item.구분); }} title="처리 가이드"
                  style={{ width: 15, height: 15, borderRadius: "50%", border: "1px solid var(--line)", background: "transparent", color: "var(--muted)", fontSize: 9, fontWeight: 700, cursor: "pointer", lineHeight: 1, padding: 0, flexShrink: 0 }}>?</button>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
              <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{item.구분}</span>
              {covered && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".03em", color: "#B45309", background: amberFaint, border: "1px solid rgba(245,180,0,.3)", borderRadius: 3, padding: "1px 6px" }}>파트너십계약 포함</span>}
              {docs.length > 0 && <span style={{ fontSize: 10, color: docsDone < docs.length && inProgress ? "#C2410C" : "var(--muted)", fontWeight: docsDone < docs.length && inProgress ? 700 : 400 }}>서류 {docsDone}/{docs.length}</span>}
              {d !== null && d >= 0 && d <= 30 && !done && (
                item.자동갱신
                  ? <span style={{ fontSize: 10, fontWeight: 600, color: "var(--muted)" }} title="자동갱신 조항 — 통지 없으면 자동 연장">↻ D-{d} 자동갱신</span>
                  : <span style={{ fontSize: 10, fontWeight: 700, color: d <= 7 ? red : "#C2410C" }}>만료 D-{d}</span>
              )}
              {item.메모 && !done && <span style={{ fontSize: 10, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.메모}</span>}
            </div>
          </div>

          {/* 우측 상태/링크/펼침 */}
          {isOpen ? null : <StatusBadge 상태={item.상태 || "요청전"} />}
          {!isOpen && item.계약서URL && <a href={item.계약서URL} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 10, fontWeight: 600, padding: "3px 7px", borderRadius: 3, background: blueFaint, color: blue, border: "1px solid rgba(0,120,212,.25)", textDecoration: "none", whiteSpace: "nowrap" }}>계약서 →</a>}
          {!isOpen && covered && !item.계약서URL && masterUrl && <a href={masterUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 10, fontWeight: 600, padding: "3px 7px", borderRadius: 3, background: blueFaint, color: blue, border: "1px solid rgba(0,120,212,.25)", textDecoration: "none", whiteSpace: "nowrap" }}>파트너십계약서 →</a>}
          {!isOpen && item.기안링크 && <a href={item.기안링크} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 10, fontWeight: 600, padding: "3px 7px", borderRadius: 3, background: greenFaint, color: green, border: "1px solid rgba(22,163,74,.25)", textDecoration: "none", whiteSpace: "nowrap" }}>기안 →</a>}
          {done && !isOpen && (
            <button onClick={e => { e.stopPropagation(); openEdit(item); }} title="수정" style={{ fontSize: 11, border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer", padding: 2 }}>✎</button>
          )}
          <span style={{ fontSize: 12, color: "var(--muted)", flexShrink: 0, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }}>▾</span>
        </div>

        {/* 펼침 본문 — 인라인 편집 */}
        {isOpen && draft && (
          <div style={{ padding: "14px 16px" }}>
            {dim && (
              <div style={{ fontSize: 11, color: "#C2410C", background: "rgba(245,180,0,.08)", border: "1px solid rgba(245,180,0,.25)", borderRadius: 5, padding: "6px 10px", marginBottom: 12 }}>
                이전 단계가 아직 완료되지 않았어요. 순서대로 진행을 권장하지만, 필요하면 지금 처리해도 됩니다.
              </div>
            )}
            {renderFields(draft, setDraft, false)}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16 }}>
              <button onClick={() => openEdit(item)} style={{ fontSize: 11, border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer", fontFamily: "inherit", marginRight: "auto" }}>전체 편집 창 ↗</button>
              <button onClick={collapseStep} disabled={isBusy}
                style={{ padding: "8px 14px", fontSize: 12, border: "1px solid var(--line)", borderRadius: 6, background: "var(--card)", color: "var(--text)", cursor: "pointer", fontFamily: "inherit" }}>접기</button>
              {!done && (
                <button onClick={() => saveStep(item, false)} disabled={isBusy}
                  style={{ padding: "8px 14px", fontSize: 12, fontWeight: 600, border: `1px solid ${amber}`, borderRadius: 6, background: amberFaint, color: "#B45309", cursor: "pointer", fontFamily: "inherit" }}>저장 (진행중)</button>
              )}
              <button onClick={() => saveStep(item, !done)} disabled={isBusy}
                style={{ padding: "8px 16px", fontSize: 12, fontWeight: 600, border: "none", borderRadius: 6, background: done ? green : amber, color: done ? "#fff" : "#1a1a1a", cursor: "pointer", fontFamily: "inherit" }}>
                {done ? "저장" : "완료하고 다음 단계 →"}
              </button>
              {deleteConfirm === item.id ? (
                <button onClick={() => remove(item)} style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: red, border: "none", borderRadius: 4, padding: "6px 9px", cursor: "pointer" }}>삭제 확인</button>
              ) : (
                <button onClick={() => { setDeleteConfirm(item.id); setTimeout(() => setDeleteConfirm(c => c === item.id ? null : c), 3000); }}
                  style={{ fontSize: 12, border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer", opacity: 0.4, fontFamily: "inherit" }} title="삭제">✕</button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // 그룹 디바이더 (프로젝트 헤더)
  const renderDivider = (text, right) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 4px 6px" }}>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--muted)" }}>{text}</span>
      <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
      {right}
    </div>
  );

  // 그룹을 순차 렌더 (앞 단계 완료 여부로 reached 계산)
  const renderGroup = (rows) => {
    let reached = true; // 첫 단계는 항상 도달
    return rows.map((item, idx) => {
      const el = renderStep(item, idx + 1, reached);
      if (item.상태 !== "완료") reached = false; // 미완료 만나면 이후는 대기
      return el;
    });
  };

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
        .m-notion { background: #2B2D3A; color: #fff; transition: background .12s; }
        .m-notion:hover { background: #1C1D26; }
      `}</style>

      {/* ── Metrics strip ── */}
      <div style={{ display: "flex", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid var(--line)", background: "var(--card)", flexWrap: "wrap", gap: 10 }}>
        {[
          { label: "파트너사", value: visiblePartnerList.length, color: "var(--text)", accent: "var(--line)" },
          { label: "진행중", value: totalActive, color: amber, accent: amber },
          { label: "대기", value: totalWaiting, color: "var(--muted)", accent: "var(--line)" },
          { label: "완료", value: totalDone, color: green, accent: green },
        ].map(({ label: l, value, color, accent }) => (
          <div key={l} style={{
            display: "flex", alignItems: "baseline", gap: 7, padding: "9px 16px",
            border: "1px solid var(--line)", borderLeft: `3px solid ${accent}`, borderRadius: 7,
            background: "var(--card)", minWidth: 92,
          }}>
            <span style={{ fontSize: 22, fontWeight: 700, color, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{value}</span>
            <span style={{ fontSize: 11, color: "var(--muted)", letterSpacing: ".04em" }}>{l}</span>
          </div>
        ))}
        {alerts.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", padding: "9px 14px", border: "1px solid rgba(220,38,38,.25)", borderLeft: "3px solid #DC2626", borderRadius: 7, background: "rgba(220,38,38,.04)", fontSize: 11, color: "#C2410C", fontWeight: 600 }}
            title={alerts.join("\n")}>⏰ 만료 임박 {alerts.length}</div>
        )}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {sentMsg && <span style={{ fontSize: 11, color: green, fontWeight: 600 }}>{sentMsg}</span>}
          <button onClick={sendAlert} disabled={sending}
            style={{ padding: "9px 14px", borderRadius: 7, border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontSize: 12, fontWeight: 600, cursor: sending ? "not-allowed" : "pointer", opacity: sending ? 0.6 : 1, fontFamily: "inherit" }}>
            {sending ? "발송 중…" : "Slack 알림"}
          </button>
          <a className="m-notion" href={NOTION_DB_URL} target="_blank" rel="noopener noreferrer"
            style={{ padding: "9px 16px", borderRadius: 7, fontSize: 12, fontWeight: 600, textDecoration: "none", letterSpacing: ".02em", display: "inline-block" }}>
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
        <div style={{ display: "flex", flex: 1, overflow: "hidden", height: 620, maxHeight: "74vh" }}>

          {/* ── Left nav ── */}
          <div style={{ width: 210, flexShrink: 0, borderRight: "1px solid var(--line)", display: "flex", flexDirection: "column", background: "var(--card)" }}>
            <div style={{ padding: "10px 14px 8px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)", flex: 1 }}>파트너사</span>
              <button onClick={load} title="새로고침" style={{
                fontSize: 11, padding: "2px 6px", borderRadius: 3,
                border: "1px solid var(--line)", color: "var(--muted)", background: "transparent", cursor: "pointer", fontFamily: "inherit",
              }}>↻</button>
            </div>

            <div className="slim-scroll" style={{ flex: 1, overflowY: "auto" }}>
              {visiblePartnerList.length === 0 && (
                <div style={{ padding: "24px 14px", fontSize: 12, color: "var(--muted)", textAlign: "center" }}>파트너사 없음</div>
              )}
              {(() => {
                // 국가별 그룹 (국가 없는 파트너는 '미지정'으로 맨 아래)
                const groups = new Map();
                visiblePartnerList.forEach(p => {
                  const c = partnerCountry(p) || "미지정";
                  if (!groups.has(c)) groups.set(c, []);
                  groups.get(c).push(p);
                });
                const sorted = [...groups.entries()].sort((a, b) => {
                  if (a[0] === "미지정") return 1;
                  if (b[0] === "미지정") return -1;
                  return a[0].localeCompare(b[0], "ko");
                });
                // 전부 미지정이면 그룹 헤더 없이 평평하게
                if (sorted.length === 1 && sorted[0][0] === "미지정") return sorted[0][1].map(renderSidebarPartner);
                return sorted.map(([country, list]) => (
                  <div key={country}>
                    <div style={{ padding: "7px 14px 4px", fontSize: 9, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--muted)", background: "#F8F9FA", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 5 }}>
                      <span>{country === "미지정" ? "국가 미지정" : countryLabel(country)}</span>
                      <span style={{ fontWeight: 400 }}>· {list.length}</span>
                    </div>
                    {list.map(renderSidebarPartner)}
                  </div>
                ));
              })()}
            </div>

            <div style={{ padding: 8, borderTop: "1px solid var(--line)" }}>
              {addingPartner ? (
                <form style={{ display: "flex", flexDirection: "column", gap: 6 }}
                  onSubmit={e => {
                    e.preventDefault();
                    const name = newPartnerName.trim();
                    const proj = newPartnerProject.trim();
                    const country = newPartnerCountry.trim();
                    if (!name) return;
                    setPartners(prev => prev.includes(name) ? prev : [...prev, name]);
                    setSelected(name);
                    setAddingPartner(false);
                    setNewPartnerName("");
                    setNewPartnerProject("");
                    setNewPartnerCountry("");
                    if (!items.some(i => i.파트너사 === name)) {
                      if (proj) {
                        // 파트너십계약 → 거래처등록 → 부속합의서(파트너십계약 포함) → 프로토타입 지출기안 한 번에 생성
                        createRows([
                          { 제목: `[${name}] 파트너십계약`, 파트너사: name, 구분: "파트너십계약", 상태: "요청전" },
                          { 제목: `[${name}] 거래처등록`, 파트너사: name, 구분: "거래처등록", 상태: "요청전", ...(country ? { 거래처국가: country } : {}) },
                          { 제목: `[${proj}] 부속합의서`, 파트너사: name, 프로젝트: proj, 구분: "부속합의서", 상태: "완료", 파트너십계약포함: true },
                          { 제목: `[${proj}] 프로토타입 지출기안`, 파트너사: name, 프로젝트: proj, 구분: "지출기안", 이터레이션구분: "프로토타입", 상태: "요청전" },
                        ]);
                      } else {
                        createPartnerTemplate(name, country).then(() => setAddingProject(true));
                      }
                    }
                  }}>
                  <input autoFocus value={newPartnerName} onChange={e => setNewPartnerName(e.target.value)}
                    placeholder="파트너사명"
                    style={{ width: "100%", padding: "6px 9px", fontSize: 12, border: "1px solid var(--line)", borderRadius: 4, background: "var(--card)", color: "var(--text)", boxSizing: "border-box" }} />
                  <div style={{ display: "flex", gap: 6 }}>
                    <input value={newPartnerProject} onChange={e => setNewPartnerProject(e.target.value)}
                      placeholder="첫 프로젝트명 (선택)"
                      style={{ flex: 1.2, padding: "6px 9px", fontSize: 12, border: "1px solid var(--line)", borderRadius: 4, background: "var(--card)", color: "var(--text)", boxSizing: "border-box", minWidth: 0 }} />
                    <input value={newPartnerCountry} onChange={e => setNewPartnerCountry(e.target.value)} list="country-list"
                      placeholder="국가"
                      style={{ flex: 0.8, padding: "6px 9px", fontSize: 12, border: "1px solid var(--line)", borderRadius: 4, background: "var(--card)", color: "var(--text)", boxSizing: "border-box", minWidth: 0 }} />
                    <datalist id="country-list">{Object.keys(COUNTRY_FLAGS).map(c => <option key={c} value={c} />)}</datalist>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button type="button" onClick={() => { setAddingPartner(false); setNewPartnerName(""); setNewPartnerProject(""); }}
                      style={{ ...addBtn(false), flex: 1, textAlign: "center" }}>취소</button>
                    <button type="submit" disabled={!newPartnerName.trim() || creatingTpl}
                      style={{ ...addBtn(true), flex: 2, textAlign: "center", opacity: !newPartnerName.trim() || creatingTpl ? 0.5 : 1 }}>
                      {creatingTpl ? "생성 중…" : "생성 (Enter)"}
                    </button>
                  </div>
                </form>
              ) : (
                <button onClick={() => setAddingPartner(true)} style={{ ...addBtn(partnerIsPrimary), width: "100%", textAlign: "center" }}>+ 파트너사</button>
              )}
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
                    {partnerCountry(selected) && (
                      <span style={{ fontSize: 10, fontWeight: 600, color: "var(--muted)", border: "1px solid var(--line)", borderRadius: 3, padding: "1px 6px", marginLeft: 8, whiteSpace: "nowrap" }}>
                        {countryLabel(partnerCountry(selected))}
                      </span>
                    )}
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
                    <button onClick={() => setAddingProject(true)} disabled={creatingTpl} style={{ ...addBtn(projectIsPrimary), opacity: creatingTpl ? 0.5 : 1 }}>{creatingTpl ? "생성 중…" : "+ 프로젝트"}</button>
                  )}
                  <button onClick={() => openAdd("파트너십계약", selected)} style={addBtn(false)}>+ 항목</button>
                  <span style={{ fontSize: 11, color: "var(--muted)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                    <span style={{ fontWeight: 700, color: green }}>{doneCount}</span>/{selectedRows.length} 완료
                  </span>
                </div>

                {/* 순차 아코디언 */}
                <div className="slim-scroll" style={{ flex: 1, overflowY: "auto", padding: "8px 20px 20px" }}>
                  {selectedRows.length === 0 && (
                    <div style={{ padding: "30px 20px", fontSize: 12.5, color: "var(--muted)", textAlign: "center" }}>
                      아직 항목이 없습니다.
                      <button onClick={() => openAdd("파트너십계약", selected)} style={{ ...addBtn(true), marginLeft: 8 }}>+ 파트너십계약</button>
                    </div>
                  )}

                  {commonRows.length > 0 && (
                    <>
                      {renderDivider("파트너 공통")}
                      {renderGroup(commonRows)}
                    </>
                  )}

                  {projectNames.map(proj => (
                    <div key={proj}>
                      {renderDivider(proj,
                        <button onClick={() => openAdd("지출기안", selected, proj === "(프로젝트 미지정)" ? "" : proj)}
                          style={{ ...addBtn(false), padding: "3px 9px", fontSize: 11 }}>
                          + 지출기안
                        </button>
                      )}
                      {renderGroup(projectRows(proj))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 가이드 모달 */}
      {guideModal && KIND_GUIDE[guideModal] && (
        <div onClick={() => setGuideModal(null)}
          style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: 400, maxWidth: "92vw", background: "var(--card)", borderRadius: 10, padding: 22, boxShadow: "0 8px 30px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{guideModal}</span>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".05em", color: amber, textTransform: "uppercase" }}>처리 가이드</span>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 16px", lineHeight: 1.5 }}>{KIND_GUIDE[guideModal].desc}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {KIND_GUIDE[guideModal].steps.map((step, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: "50%", background: amberFaint, color: "#B45309", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                  <span style={{ fontSize: 12.5, color: "var(--text)", lineHeight: 1.5, paddingTop: 1 }}>{step}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
              <button onClick={() => setGuideModal(null)}
                style={{ padding: "7px 16px", fontSize: 12.5, fontWeight: 600, border: "1px solid var(--line)", borderRadius: 6, background: "var(--card)", color: "var(--text)", cursor: "pointer" }}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 추가/수정 모달 (신규 추가 · 완료 항목 재편집용) */}
      {showForm && (
        <div onClick={() => !saving && setShowForm(false)}
          style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", overflowY: "auto", padding: "30px 0" }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: 460, maxWidth: "92vw", background: "var(--card)", borderRadius: 10, padding: 22, boxShadow: "0 8px 30px rgba(0,0,0,0.18)", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>
              {editingId ? "항목 수정" : "항목 추가"}
            </div>
            {renderFields(form, setForm, true)}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
              <button onClick={() => setShowForm(false)} disabled={saving}
                style={{ padding: "8px 16px", fontSize: 12.5, border: "1px solid var(--line)", borderRadius: 6, background: "var(--card)", color: "var(--text)", cursor: "pointer" }}>취소</button>
              <button onClick={submit} disabled={saving || !form.제목.trim() || !form.파트너사.trim() || (PROJECT_LEVEL_KINDS.includes(form.구분) && !form.프로젝트.trim())}
                style={{ padding: "8px 18px", fontSize: 12.5, fontWeight: 600, border: "none", borderRadius: 6, background: amber, color: "#1a1a1a", cursor: "pointer", opacity: saving || !form.제목.trim() || !form.파트너사.trim() || (PROJECT_LEVEL_KINDS.includes(form.구분) && !form.프로젝트.trim()) ? 0.5 : 1 }}>
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
