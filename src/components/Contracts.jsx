import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

// 현재까지 등록된 국가 (드롭다운 상단 고정) — 표기: "Country (KST±N)". 신규 국가는 자유 입력
const KNOWN_COUNTRIES = [
  "Korea (KST+0)", "China (KST-1)", "Vietnam (KST-2)", "Bangladesh (KST-3)", "India (KST-3)",
  "Turkey (KST-6)", "Brazil (KST-12)", "Estonia (KST-6)", "Ukraine (KST-6)",
];

// 국가명 → ISO 코드 (국기 이미지용). 이모지 국기는 Windows에서 안 그려져서 flagcdn 이미지 사용
const COUNTRY_CODES = {
  korea: "kr", 한국: "kr", 대한민국: "kr", china: "cn", 중국: "cn", vietnam: "vn", 베트남: "vn",
  bangladesh: "bd", 방글라데시: "bd", india: "in", 인도: "in", turkey: "tr", 튀르키예: "tr", 터키: "tr",
  brazil: "br", 브라질: "br", estonia: "ee", 에스토니아: "ee", ukraine: "ua", 우크라이나: "ua",
  japan: "jp", 일본: "jp", taiwan: "tw", 대만: "tw", hongkong: "hk", 홍콩: "hk", usa: "us", 미국: "us",
  uk: "gb", 영국: "gb", germany: "de", 독일: "de", france: "fr", 프랑스: "fr", canada: "ca", 캐나다: "ca",
  australia: "au", 호주: "au", singapore: "sg", 싱가포르: "sg", thailand: "th", 태국: "th",
  indonesia: "id", 인도네시아: "id", philippines: "ph", 필리핀: "ph", malaysia: "my", 말레이시아: "my",
};
function countryCode(c) {
  if (!c) return null;
  const key = c.replace(/\(.*?\)/g, "").trim().toLowerCase().replace(/\s+/g, "");
  return COUNTRY_CODES[key] || null;
}
function Flag({ country, size = 15 }) {
  const code = countryCode(country);
  if (!code) return null;
  return <img src={`https://flagcdn.com/w20/${code}.png`} alt="" width={size} style={{ borderRadius: 2, flexShrink: 0, display: "inline-block", verticalAlign: "-1px" }} />;
}

// 사이드바 팔레트 — 쿨 그레이 패널 (밝은 캔버스보다 한 단계 진한 중립 회색)
const SB_BG = "#C8CFD9";
const SB_TEXT = "#1a1d23";
const SB_MUTED = "#5b6270";
const SB_LINE = "#b3bac6";
const SB_HOVER = "rgba(255,255,255,.35)";
const SB_GRP_BG = "rgba(0,0,0,.05)";
const SB_ACTIVE = "rgba(245,180,0,.22)";

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
  ["거래처국가", "법인 등록국"],
  ["거래처주소", "주소 / 도시 / 우편번호"],
  ["거래처대표", ""],
  ["거래처Email", ""],
  ["거래처계좌번호", "법인통장 기재"],
];
// 거래처담당자(내부 담당 PM)는 거래처 정보에서 입력하지 않는다 — 파트너사에 설정된 '담당자'로 자동 관리(상세 헤더 칩).
const BANK_FIELDS = ["BankName", "BranchName", "BankAddress", "BeneficiaryName", "AccountNumber"];

const EMPTY_FORM = {
  제목: "", 파트너사: "", 프로젝트: "", 구분: "파트너십계약", 상태: "요청전", 메모: "", 담당자: "", 개발소재지: "", 프로젝트상태: "",
  체결일: "", 만료일: "", 자동갱신: false, 계약서URL: "", 기안링크: "", 이터레이션구분: "", 파트너십계약포함: false,
  법인등록증: false, 법인통장: false, 부속합의서: false, 스펙내용: false, 인보이스: false,
  법인등록증링크: "", 법인통장링크: "", 부속합의서링크: "", 스펙내용링크: "", 인보이스링크: "",
  거래처식별번호: "", 거래처명: "", 거래처국가: "", 거래처주소: "", 거래처대표: "", 거래처담당자: "", 거래처Email: "", 거래처계좌번호: "",
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

// 정체 감지 — 최종업데이트일 기준 경과 일수 (PROCESS.md 알림 규칙)
const STALE_DAYS = 7;
function staleDaysOf(item) {
  if (!item.최종업데이트일) return null;
  const d = dday(item.최종업데이트일);
  return d === null ? null : -d;
}

// 완료 조건 검사 — 완료인데 필수 데이터 없으면 경고 문구 반환 (PROCESS.md 단계별 완료 조건)
// 완료 조건 미충족 시 사유 반환(상태 무관). 완료 저장 차단·완료 항목 경고 공용.
function missingForComplete(i) {
  if ((i.구분 === "파트너십계약" || i.구분 === "NDA") && !i.계약서URL) return "계약서 파일 URL(서명본) 미등록";
  if (i.구분 === "부속합의서" && !i.파트너십계약포함 && !i.계약서URL) return "계약서 파일 URL 미등록";
  if (i.구분 === "지출기안" && !i.기안링크) return "기안 링크 미등록";
  if (i.구분 === "거래처등록") {
    const docsMissing = (DOCS_BY_KIND.거래처등록 || []).some(doc => !i[doc] && !i[`${doc}링크`]);
    if (docsMissing || !i.거래처식별번호 || !i.거래처명) return "서류/거래처 정보 미비";
  }
  return null;
}
function doneWarning(i) {
  if (i.상태 !== "완료") return null;
  return missingForComplete(i);
}

// 그룹 내 순서 정렬 (지출기안 여러 건은 기존 순서 유지)
function orderGroup(rows) {
  return [...rows].sort((a, b) => (KIND_ORDER[a.구분] || 9) - (KIND_ORDER[b.구분] || 9));
}

function LinkOpen({ href }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      style={{ fontSize: 10, fontWeight: 600, padding: "6px 9px", borderRadius: 4, background: blueFaint, color: blue, border: "1px solid rgba(0,120,212,.25)", textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0 }}>
      열기 →
    </a>
  );
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
  const [newPartnerOwner, setNewPartnerOwner] = useState("");
  const [ownerFilter, setOwnerFilter] = useState(null);   // 담당자 필터 (null=전체)
  const [queueFilter, setQueueFilter] = useState(null);   // 큐 종류 필터 (null=전체)
  const [queueOpen, setQueueOpen] = useState(true);       // 큐 패널 접기
  const [renamingPartner, setRenamingPartner] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [partnerBusy, setPartnerBusy] = useState(false);
  const [editingHeaderField, setEditingHeaderField] = useState(null); // "거래처국가" | "담당자"
  const [headerFieldValue, setHeaderFieldValue] = useState("");
  const [addingProject, setAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [guideModal, setGuideModal] = useState(null); // 가이드 모달 (구분명)
  const [sending, setSending] = useState(false);
  const [sentMsg, setSentMsg] = useState("");
  const [creatingTpl, setCreatingTpl] = useState(false);
  const [titleTouched, setTitleTouched] = useState(false);

  // 아코디언 순차 흐름 상태
  const [openId, setOpenId] = useState(null);  // null=자동(첫 미완료), ""=전체 접힘, id=해당 항목
  const [editingStep, setEditingStep] = useState(null);  // 완료 항목 편집 잠금 해제된 id
  const [draft, setDraft] = useState(null);    // 인라인 편집 중인 값
  const [copiedId, setCopiedId] = useState(null);  // 링크 복사 피드백
  const deepLinkDone = useRef(false);

  const copyItemLink = (id) => {
    const url = `${window.location.origin}${window.location.pathname}?tab=contracts&item=${id}`;
    navigator.clipboard?.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(c => c === id ? null : c), 2000);
  };

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

  // 등록된 담당자 목록 (필터 칩용)
  const owners = useMemo(() => {
    const set = new Set();
    items.forEach(i => { if (i.담당자) set.add(i.담당자); });
    return [...set].sort();
  }, [items]);

  // 항목 있는 파트너 먼저, 빈 파트너(DB select 등록만 된 곳)는 아래에. 담당자 필터 적용
  const visiblePartnerList = useMemo(() => {
    const ownerOf = (p) => {
      const v = items.find(i => i.파트너사 === p && i.구분 === "거래처등록" && i.담당자);
      if (v) return v.담당자;
      const any = items.find(i => i.파트너사 === p && i.담당자);
      return any ? any.담당자 : "";
    };
    let list = ownerFilter ? allPartners.filter(p => ownerOf(p) === ownerFilter) : allPartners;
    const has = list.filter(p => items.some(i => i.파트너사 === p));
    const empty = list.filter(p => !items.some(i => i.파트너사 === p));
    return [...has, ...empty];
  }, [allPartners, items, ownerFilter]);

  // 초기 파트너 선택 — 딥링크(?item=)가 있으면 그 항목의 파트너 우선, 없으면 첫 파트너.
  // 단일 이펙트로 처리해 자동선택과 딥링크가 경쟁하지 않도록 함.
  useEffect(() => {
    if (selected || visiblePartnerList.length === 0) return;
    const itemId = new URLSearchParams(window.location.search).get("item");
    if (itemId && !deepLinkDone.current) {
      const target = items.find(i => i.id === itemId);
      if (target) {
        deepLinkDone.current = true;
        pendingOpen.current = itemId;  // [selected] 이펙트가 이 항목을 펼침
        setSelected(target.파트너사);
        setTimeout(() => document.getElementById(`step-${itemId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 400);
        return;
      }
      if (!items.length) return;   // 아직 로딩 중 → 대기
      deepLinkDone.current = true; // 로드됐는데 못 찾음 → 폴백 허용
    }
    setSelected(visiblePartnerList[0]);
  }, [visiblePartnerList, selected, items]);

  const byPartner = useMemo(() => {
    const map = {};
    allPartners.forEach(p => { map[p] = items.filter(i => i.파트너사 === p); });
    return map;
  }, [items, allPartners]);

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
    if (next === "완료") {
      const reason = missingForComplete(item);
      if (reason) { alert(`완료할 수 없습니다 — ${reason}.\n항목을 열어 조건을 채운 뒤 완료해주세요.`); return; }
    }
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

  // 신규 파트너 템플릿: 파트너십계약 + 거래처등록 (국가·담당자는 거래처등록에 저장)
  const createPartnerTemplate = (partner, country, owner) => createRows([
    { 제목: `[${partner}] 파트너십계약`, 파트너사: partner, 구분: "파트너십계약", 상태: "요청전", ...(owner ? { 담당자: owner } : {}) },
    { 제목: `[${partner}] 거래처등록`, 파트너사: partner, 구분: "거래처등록", 상태: "요청전", ...(country ? { 개발소재지: country } : {}), ...(owner ? { 담당자: owner } : {}) },
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
    border: `1px solid ${accent ? amber : "#c7ccd4"}`,
    background: accent ? amberFaint : "var(--card)",
    color: accent ? "#B45309" : "var(--text)",
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  });

  // 파트너의 거래처등록 항목 (파트너 공통 서류의 원본)
  const partnerVendor = (partner) => items.find(i => i.파트너사 === partner && i.구분 === "거래처등록") || null;
  // 파트너의 파트너십계약 계약서 URL (첫 프로젝트 부속합의서가 여기 포함됨)
  const partnerMaster = (partner) => items.find(i => i.파트너사 === partner && i.구분 === "파트너십계약") || null;
  const partnerMasterUrl = (partner) => { const m = partnerMaster(partner); return m ? (m.계약서URL || "") : ""; };
  // 거래처국가 = 법인 등록국(법인등록증 기준). 거래처 정보/지급용.
  const partnerCountry = (partner) => {
    const v = partnerVendor(partner);
    return v ? (v.거래처국가 || "").trim() : "";
  };
  // 개발소재지 = 우리가 인지하는 개발 스튜디오 위치. 사이드바 그룹·국기·KST 기준. 없으면 법인 등록국으로 폴백(레거시).
  const partnerDevLocation = (partner) => {
    const v = partnerVendor(partner);
    const dev = v ? (v.개발소재지 || "").trim() : "";
    return dev || partnerCountry(partner);
  };
  // 파트너 담당자 — 어느 항목이든 담당자가 있으면 사용 (거래처등록 우선)
  const partnerOwner = (partner) => {
    const v = partnerVendor(partner);
    if (v && v.담당자) return v.담당자;
    const any = items.find(i => i.파트너사 === partner && i.담당자);
    return any ? any.담당자 : "";
  };
  // 서류 수령 여부 — 파트너 공통 서류는 거래처등록 상태를 따름
  const docReceived = (item, doc) => {
    if (item.구분 !== "거래처등록" && PARTNER_DOCS.includes(doc)) {
      const v = partnerVendor(item.파트너사);
      return v ? (!!v[doc] || !!v[`${doc}링크`]) : false;
    }
    // 지출기안의 부속합의서 서류 → 같은 프로젝트 부속합의서 항목에서 연동
    if (item.구분 === "지출기안" && doc === "부속합의서") {
      const add = items.find(i => i.파트너사 === item.파트너사 && (i.프로젝트 || "") === (item.프로젝트 || "") && i.구분 === "부속합의서");
      if (!add) return false;
      return add.상태 === "완료" || !!add.계약서URL || (add.파트너십계약포함 && !!partnerMasterUrl(item.파트너사));
    }
    return !!item[doc];
  };

  // 프로젝트 상태 (진행중/종료/드랍) — 프로젝트 단위 행에 저장, 아무 행에서나 읽음. 기본 진행중
  const projectStatusOf = (partner, proj) => {
    const rows = items.filter(i => i.파트너사 === partner && PROJECT_LEVEL_KINDS.includes(i.구분) && (i.프로젝트 || "(프로젝트 미지정)") === proj);
    const withStatus = rows.find(r => r.프로젝트상태);
    return withStatus ? withStatus.프로젝트상태 : "진행중";
  };
  const projectMuted = (partner, proj) => projectStatusOf(partner, proj) !== "진행중"; // 종료·드랍 = 알림/큐 제외
  const itemMuted = (i) => PROJECT_LEVEL_KINDS.includes(i.구분) && projectMuted(i.파트너사, i.프로젝트 || "(프로젝트 미지정)");
  const setProjectStatus = async (partner, proj, status) => {
    const rows = items.filter(i => i.파트너사 === partner && PROJECT_LEVEL_KINDS.includes(i.구분) && (i.프로젝트 || "(프로젝트 미지정)") === proj);
    setItems(list => list.map(i => rows.some(r => r.id === i.id) ? { ...i, 프로젝트상태: status } : i));
    await Promise.all(rows.map(r => fetch(`${API_BASE}/api/partner-admin`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId: r.id, 프로젝트상태: status }),
    }).catch(() => {})));
  };

  // ── 선택 파트너의 순차 그룹 구성 ──
  const selectedRows = selected ? (byPartner[selected] || []) : [];
  const commonRows = orderGroup(selectedRows.filter(i => PARTNER_LEVEL_KINDS.includes(i.구분)));
  const projectNames = [...new Set(selectedRows.filter(i => PROJECT_LEVEL_KINDS.includes(i.구분)).map(i => i.프로젝트 || "(프로젝트 미지정)"))].sort();
  const projectRows = (proj) => orderGroup(selectedRows.filter(i => PROJECT_LEVEL_KINDS.includes(i.구분) && (i.프로젝트 || "(프로젝트 미지정)") === proj));
  const activeRows = selectedRows.filter(i => !itemMuted(i)); // 종료·드랍 프로젝트 제외
  const doneCount = activeRows.filter(i => i.상태 === "완료").length;

  // ── 지금 할 일 큐 (PROCESS.md 백로그 1~5: 다음 단계·완료 경고·정체·이터레이션·헬스체크) ──
  const todoQueue = useMemo(() => {
    const out = [];
    allPartners.forEach(p => {
      const rows = items.filter(i => i.파트너사 === p);
      if (rows.length === 0) return;
      const pushNext = (item) => {
        const s = staleDaysOf(item);
        const docs = DOCS_BY_KIND[item.구분] || [];
        const missing = docs.filter(doc => !docReceived(item, doc));
        out.push({
          key: `next-${item.id}`, kind: "next", partner: p, item, label: item.제목,
          reason: item.상태 === "진행중" ? (missing.length ? `서류 미비: ${missing.join("·")}` : "진행중 — 마무리") : "다음 단계 시작",
          stale: s !== null && s >= STALE_DAYS ? s : null,
          prio: item.상태 === "진행중" ? 1 : 2,
        });
      };
      const common = orderGroup(rows.filter(i => PARTNER_LEVEL_KINDS.includes(i.구분)));
      const nc = common.find(i => i.상태 !== "완료");
      if (nc) pushNext(nc);
      const projs = [...new Set(rows.filter(i => PROJECT_LEVEL_KINDS.includes(i.구분)).map(i => i.프로젝트 || "(프로젝트 미지정)"))];
      projs.forEach(proj => {
        if (projectMuted(p, proj)) return; // 종료·드랍 프로젝트는 큐에서 제외
        const plist = orderGroup(rows.filter(i => PROJECT_LEVEL_KINDS.includes(i.구분) && (i.프로젝트 || "(프로젝트 미지정)") === proj));
        const np = plist.find(i => i.상태 !== "완료");
        if (np) pushNext(np);
        // 이터레이션은 사업 판단이라 자동 재촉하지 않음 — 다음 이터는 "+ 지출기안"으로 수동 추가
        // 헬스체크: 프로젝트에 부속합의서 단계 자체가 없음 (구버전 템플릿)
        if (!plist.some(i => i.구분 === "부속합의서")) {
          out.push({ key: `heal-${p}-${proj}`, kind: "heal", partner: p, proj, label: `[${proj}] 부속합의서 단계 누락`, reason: "클릭해서 단계 생성", prio: 4, firstProject: projs.length === 1 });
        }
      });
      // 완료 조건 경고 (종료·드랍 프로젝트 제외)
      rows.forEach(i => {
        if (itemMuted(i)) return;
        const w = doneWarning(i);
        if (w) out.push({ key: `warn-${i.id}`, kind: "warn", partner: p, item: i, label: i.제목, reason: `완료인데 ${w}`, prio: 3 });
      });
      // 만료 임박 (자동갱신·종료·드랍 제외)
      rows.forEach(i => {
        if (itemMuted(i)) return;
        const d = dday(i.만료일);
        if (CONTRACT_KINDS.includes(i.구분) && !i.자동갱신 && d !== null && d >= 0 && d <= 30) {
          out.push({ key: `exp-${i.id}`, kind: "expire", partner: p, item: i, label: i.제목, reason: d === 0 ? "오늘 만료" : `D-${d} 만료`, prio: 0 });
        }
      });
    });
    return out.sort((a, b) => (a.prio - b.prio) || ((b.stale || 0) - (a.stale || 0)));
  }, [items, allPartners]); // eslint-disable-line

  // 알림 종류별 카운트 (상단 칩)
  const alertCounts = useMemo(() => ({
    expire: todoQueue.filter(a => a.kind === "expire").length,
    warn: todoQueue.filter(a => a.kind === "warn").length,
    stale: todoQueue.filter(a => a.stale).length,
    heal: todoQueue.filter(a => a.kind === "heal").length,
  }), [todoQueue]);

  // 담당자·종류 필터 적용된 큐
  const filteredQueue = useMemo(() => todoQueue.filter(a => {
    if (ownerFilter && partnerOwner(a.partner) !== ownerFilter) return false;
    if (queueFilter === "stale") return !!a.stale;
    if (queueFilter) return a.kind === queueFilter;
    return true;
  }), [todoQueue, ownerFilter, queueFilter]); // eslint-disable-line

  // 누락된 부속합의서 단계 생성 — 유일 프로젝트면 첫 프로젝트로 보고 파트너십계약 포함(완료) 처리
  const healProject = (a) => {
    const projField = a.proj === "(프로젝트 미지정)" ? {} : { 프로젝트: a.proj };
    createRows([a.firstProject
      ? { 제목: `[${a.proj}] 부속합의서`, 파트너사: a.partner, ...projField, 구분: "부속합의서", 상태: "완료", 파트너십계약포함: true }
      : { 제목: `[${a.proj}] 부속합의서`, 파트너사: a.partner, ...projField, 구분: "부속합의서", 상태: "요청전" }]);
  };

  // 파트너 삭제 — 항목 전체 아카이브 + 노션 select 옵션 제거 (빈/유령 파트너도 정리 가능)
  const deletePartner = async () => {
    const n = (byPartner[selected] || []).length;
    if (!window.confirm(`파트너사 "${selected}"${n ? `와 항목 ${n}건이` : "가"} 모두 삭제됩니다. 계속할까요?`)) return;
    setPartnerBusy(true);
    try {
      const r = await fetch(`${API_BASE}/api/partner-admin`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partner: selected }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const gone = selected;
      setItems(prev => prev.filter(i => i.파트너사 !== gone));
      setPartners(prev => prev.filter(p => p !== gone));
      setSelected(null);
    } catch (e) { alert(`삭제 실패: ${e.message}`); }
    finally { setPartnerBusy(false); }
  };

  // 파트너 이름 변경 — 모든 항목의 파트너사·제목 갱신
  const renamePartner = async (to) => {
    const name = to.trim();
    if (!name || name === selected) { setRenamingPartner(false); return; }
    setPartnerBusy(true);
    try {
      const r = await fetch(`${API_BASE}/api/partner-admin`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ renameFrom: selected, renameTo: name }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const from = selected;
      setItems(prev => prev.map(i => i.파트너사 === from
        ? { ...i, 파트너사: name, 제목: (i.제목 || "").split(`[${from}]`).join(`[${name}]`) }
        : i));
      setPartners(prev => prev.map(p => p === from ? name : p));
      setSelected(name);
      setRenamingPartner(false);
    } catch (e) { alert(`이름 변경 실패: ${e.message}`); }
    finally { setPartnerBusy(false); }
  };

  // 파트너 국가·담당자를 거래처등록(원본)에 직접 저장 — 상세 헤더 인라인 편집용
  const saveHeaderField = async (partner, field, raw) => {
    const value = (raw || "").trim();
    setEditingHeaderField(null);
    const anchor = partnerVendor(partner) || items.find(i => i.파트너사 === partner);
    if (!anchor) return;
    const cur = (anchor[field] || "");
    if (value === cur) return;
    await patch(anchor.id, { [field]: value || null });
  };

  const actOn = (a) => {
    if (a.kind === "heal") { setSelected(a.partner); healProject(a); return; }
    if (a.kind === "iter") { setSelected(a.partner); openAdd("지출기안", a.partner, a.proj === "(프로젝트 미지정)" ? "" : a.proj); return; }
    pendingOpen.current = a.item.id;
    setSelected(a.partner);
    setOpenId(a.item.id);
  };

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

  // 파트너 전환 시 아코디언 초기화 (자동 = 첫 미완료). 큐 클릭으로 넘어온 경우엔 지정 항목을 연다
  const pendingOpen = useRef(null);
  useEffect(() => { setOpenId(pendingOpen.current); pendingOpen.current = null; }, [selected]);

  // 열린 스텝이 바뀌면 draft 로드
  useEffect(() => {
    if (!effectiveOpen) { setDraft(null); return; }
    const item = items.find(i => i.id === effectiveOpen);
    setDraft(item ? itemToForm(item) : null);
  }, [effectiveOpen]); // eslint-disable-line

  const openStep = (item) => { setOpenId(item.id); setEditingStep(null); };
  const collapseStep = () => { setOpenId(""); setEditingStep(null); };

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
    // 완료 상태가 되려면 완료 조건을 충족해야 함
    const reason = missingForComplete(fields);
    if (complete) {
      // 명시적 완료 시도 — 조건 미충족이면 차단
      if (reason) { alert(`완료할 수 없습니다 — ${reason}.\n조건을 채운 뒤 완료해주세요.`); return; }
      fields.상태 = "완료";
    } else if (item.상태 === "완료") {
      // 완료 항목 수정 저장 — 조건 미충족이면 진행중으로 자동 강등(모순 방지)
      fields.상태 = reason ? "진행중" : "완료";
    } else {
      fields.상태 = "진행중";
    }
    const next = complete ? nextIncompleteInGroup(item) : null;
    await patch(item.id, fields);
    setEditingStep(null);
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
            <div>
              <span style={label}>담당자</span>
              <input style={input} list="owner-list-form" value={vals.담당자} onChange={e => upd(f => ({ ...f, 담당자: e.target.value }))} placeholder="파트너 담당자" />
              <datalist id="owner-list-form">{owners.map(o => <option key={o} value={o} />)}</datalist>
            </div>
          </>
        )}

        {!identity && vals.구분 === "지출기안" && (
          <div>
            <span style={label}>이터레이션 구분</span>
            <input style={input} value={vals.이터레이션구분} onChange={e => upd(f => ({ ...f, 이터레이션구분: e.target.value }))} placeholder="프로토타입 / 이터레이션1..." />
          </div>
        )}

        {vals.구분 === "부속합의서" && (
          <div>
            <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input type="checkbox" checked={!!vals.파트너십계약포함} onChange={e => upd(f => ({ ...f, 파트너십계약포함: e.target.checked }))} />
              파트너십계약 포함 (첫 프로젝트 — 본계약에 종속)
            </label>
            {vals.파트너십계약포함 && (
              <div style={{ fontSize: 11, color: "#B45309", background: amberFaint, border: "1px solid rgba(245,180,0,.3)", borderRadius: 5, padding: "6px 10px", marginTop: 6 }}>
                이 부속합의서는 파트너십계약(본계약)에 포함됩니다. 별도 체결 없이 파트너십계약서로 갈음합니다.
              </div>
            )}
          </div>
        )}

        {isContract && (<>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {["체결일", "만료일"].map(field => {
              const master = coveredForm ? partnerMaster(vals.파트너사) : null;
              const linkedVal = master ? (master[field] || "") : "";
              if (coveredForm) {
                return (
                  <div key={field}>
                    <span style={label}>{field} <span style={{ fontWeight: 400, color: "var(--muted)" }}>· 파트너십계약 연동</span></span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 33 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".03em", color: "#B45309", background: amberFaint, border: "1px solid rgba(245,180,0,.3)", borderRadius: 3, padding: "1px 6px", flexShrink: 0 }}>본계약</span>
                      <span style={{ fontSize: 12, color: linkedVal ? "var(--text)" : "var(--muted)" }}>{linkedVal || "본계약에 날짜 미등록"}</span>
                    </div>
                  </div>
                );
              }
              return (
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
            );})}
          </div>
          {/* 계약서 기안 URL — 네이버웍스 */}
          {!coveredForm && (
            <div>
              <span style={label}>계약서 기안 URL <span style={{ fontWeight: 400, color: "var(--muted)" }}>· 네이버웍스</span></span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input style={{ ...input, flex: 1 }} value={vals.기안링크} onChange={e => upd(f => ({ ...f, 기안링크: e.target.value }))} placeholder="https:// (네이버웍스 기안)" />
                {vals.기안링크 && <LinkOpen href={vals.기안링크} />}
              </div>
            </div>
          )}
          {/* 계약서 파일 URL — 원드라이브 최종 서명본 */}
          <div>
            <span style={label}>계약서 파일 URL <span style={{ fontWeight: 400, color: "var(--muted)" }}>· 원드라이브 서명본</span></span>
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
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input style={{ ...input, flex: 1 }} value={vals.계약서URL} onChange={e => upd(f => ({ ...f, 계약서URL: e.target.value }))} placeholder="https:// (원드라이브 최종 전자서명본)" />
                {vals.계약서URL && <LinkOpen href={vals.계약서URL} />}
              </div>
            )}
          </div>
        </>)}

        {DOCS_BY_KIND[vals.구분] && (
          <div>
            <span style={label}>필요 서류 · 구글드라이브 링크</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "4px 0" }}>
              {DOCS_BY_KIND[vals.구분].map(doc => {
                const linkKey = `${doc}링크`;
                // 지출기안의 '부속합의서' 서류 → 같은 프로젝트의 부속합의서 항목에서 연동 (읽기 전용)
                if (vals.구분 === "지출기안" && doc === "부속합의서") {
                  const add = items.find(i => i.파트너사 === vals.파트너사 && (i.프로젝트 || "") === (vals.프로젝트 || "") && i.구분 === "부속합의서");
                  const addUrl = add ? (add.파트너십계약포함 ? partnerMasterUrl(vals.파트너사) : (add.계약서URL || "")) : "";
                  const addOk = add ? (add.상태 === "완료" || !!addUrl) : false;
                  const covered = add?.파트너십계약포함;
                  return (
                    <div key={doc} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input type="checkbox" checked={addOk} disabled title="부속합의서 항목에서 연동됨"
                        style={{ accentColor: green, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, width: 82, flexShrink: 0, color: "var(--text)" }}>{doc}</span>
                      <span style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--muted)" }}>
                        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".03em", border: "1px solid var(--line)", borderRadius: 3, padding: "1px 5px", flexShrink: 0 }}>{covered ? "파트너십계약 포함" : "부속합의서 연동"}</span>
                        {!add && "부속합의서 항목 없음"}
                        {add && !addUrl && !covered && "계약서 링크 미등록"}
                      </span>
                      {addUrl && (
                        <a href={addUrl} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 10, fontWeight: 600, padding: "5px 8px", borderRadius: 4, background: blueFaint, color: blue, border: "1px solid rgba(0,120,212,.25)", textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0 }}>열기 →</a>
                      )}
                    </div>
                  );
                }
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

        {vals.구분 === "거래처등록" && (<>
          <div>
            <span style={{ ...label, marginTop: 4 }}>거래처 정보</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {VENDOR_FIELDS.map(([field, hint]) => (
                <input key={field} style={input} value={vals[field]} placeholder={field + (hint ? ` (${hint})` : "")}
                  onChange={e => upd(f => ({ ...f, [field]: e.target.value }))} />
              ))}
            </div>
          </div>
          <div>
            <span style={{ ...label, marginTop: 4 }}>해외 송금 정보 <span style={{ fontWeight: 400, color: "var(--muted)" }}>· 지출기안에 연동됨</span></span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {BANK_FIELDS.map(field => (
                <input key={field} style={input} value={vals[field]} placeholder={field}
                  onChange={e => upd(f => ({ ...f, [field]: e.target.value }))} />
              ))}
            </div>
          </div>
        </>)}

        {vals.구분 === "지출기안" && (<>
          <div>
            <span style={label}>기안 링크</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input style={{ ...input, flex: 1 }} value={vals.기안링크} onChange={e => upd(f => ({ ...f, 기안링크: e.target.value }))} placeholder="https:// (네이버웍스 기안)" />
              {vals.기안링크 && <LinkOpen href={vals.기안링크} />}
            </div>
          </div>
          <div>
            <span style={{ ...label, marginTop: 4 }}>해외 송금 정보 <span style={{ fontWeight: 400, color: "var(--muted)" }}>· 거래처등록 연동 (읽기 전용)</span></span>
            {(() => {
              const v = partnerVendor(vals.파트너사);
              const filled = v && BANK_FIELDS.some(f => (v[f] || "").trim());
              if (!filled) {
                return <div style={{ fontSize: 11.5, color: "var(--muted)", padding: "6px 0" }}>거래처등록에서 해외 송금 정보를 먼저 입력하세요.</div>;
              }
              return (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {BANK_FIELDS.map(field => (
                    <div key={field} style={{ ...input, background: "var(--card-bg-subtle)", display: "flex", flexDirection: "column", gap: 1, minHeight: 34, justifyContent: "center" }}>
                      <span style={{ fontSize: 9, color: "var(--muted)" }}>{field}</span>
                      <span style={{ fontSize: 12, color: (v[field] || "").trim() ? "var(--text)" : "var(--muted)" }}>{(v[field] || "").trim() || "—"}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </>)}

        <div>
          <span style={label}>메모</span>
          <textarea rows={4} style={{ ...input, resize: "vertical", minHeight: 72, lineHeight: 1.5, fontFamily: "inherit" }} value={vals.메모} onChange={e => upd(f => ({ ...f, 메모: e.target.value }))} placeholder="특이사항 (여러 줄 입력 가능)" />
        </div>
      </div>
    );
  };

  // ── 사이드바 파트너 항목 ──
  const renderSidebarPartner = (partner) => {
    const allRows = byPartner[partner] || [];
    // 진행률·경고는 종료·드랍 프로젝트 항목 제외 (활성 항목만)
    const rows = allRows.filter(i => !itemMuted(i));
    const done = rows.filter(i => i.상태 === "완료").length;
    const pct = rows.length === 0 ? 0 : Math.round((done / rows.length) * 100);
    const isActive = selected === partner;
    const projCount = new Set(allRows.filter(i => i.프로젝트).map(i => i.프로젝트)).size;
    const warn = rows.some(i => {
      const d = dday(i.만료일);
      const docsMissing = (DOCS_BY_KIND[i.구분] || []).some(doc => !docReceived(i, doc)) && i.상태 === "진행중";
      return docsMissing || (CONTRACT_KINDS.includes(i.구분) && !i.자동갱신 && d !== null && d >= 0 && d <= 30);
    });
    return (
      <div key={partner} style={{ borderBottom: `1px solid ${SB_LINE}` }}>
        <div onClick={() => setSelected(partner)}
          style={{
            padding: "10px 14px", cursor: "pointer",
            borderLeft: `2px solid ${isActive ? amber : "transparent"}`,
            background: isActive ? SB_ACTIVE : "transparent",
            transition: "background .1s",
          }}
          onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = SB_HOVER; }}
          onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
            <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, color: SB_TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{partner}</span>
            {warn && <span style={{ width: 6, height: 6, borderRadius: "50%", background: red, flexShrink: 0 }} />}
            {projCount > 0 && <span style={{ fontSize: 10, color: SB_MUTED, flexShrink: 0 }}>프로젝트 {projCount}</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ flex: 1, height: 2, background: "rgba(0,0,0,.14)", borderRadius: 1, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: done === rows.length && rows.length > 0 ? green : amber, borderRadius: 1, transition: "width .3s" }} />
            </div>
            <span style={{ fontSize: 9, color: SB_MUTED, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{done}/{rows.length}</span>
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
    const warn = doneWarning(item); // 완료인데 필수 데이터 없음
    const dim = !isOpen && !done && !reached; // 대기 단계
    const locked = done && editingStep !== item.id; // 완료 항목은 '수정' 전까지 읽기 전용

    const accent = done ? green : inProgress ? amber : reached ? blue : "var(--line)";
    const headBg = isOpen ? "var(--card)" : done ? greenFaint : "var(--card)";

    return (
      <div key={item.id} id={`step-${item.id}`} style={{
        border: `${isOpen ? 2 : 1}px solid ${isOpen ? blue : done ? "rgba(22,163,74,.3)" : "var(--line)"}`,
        borderRadius: 8, marginBottom: 8, overflow: "hidden",
        background: "var(--card)", opacity: dim ? 0.6 : (isBusy ? 0.5 : 1),
        transition: "opacity .15s",
      }}>
        {/* 헤더 */}
        <div onClick={() => (isOpen ? collapseStep() : openStep(item))}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", cursor: "pointer", background: headBg, borderBottom: isOpen ? "1px solid var(--line)" : "none" }}>
          {/* 순번/완료 서클 — 클릭 시 상태 순환 (완료 항목은 수정 모드에서만) */}
          <div onClick={e => { e.stopPropagation(); if (!isBusy && !locked) cycleStatus(item); }}
            title={locked ? "완료 항목 — '수정'을 눌러야 변경 가능" : "클릭해서 상태 변경"}
            style={{
              width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 700, fontVariantNumeric: "tabular-nums",
              cursor: isBusy ? "wait" : locked ? "default" : "pointer",
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
              {warn && <span style={{ fontSize: 10, fontWeight: 700, color: red }}>⚠ {warn}</span>}
              {docs.length > 0 && <span style={{ fontSize: 10, color: docsDone < docs.length && inProgress ? "#C2410C" : "var(--muted)", fontWeight: docsDone < docs.length && inProgress ? 700 : 400 }}>서류 {docsDone}/{docs.length}</span>}
              {d !== null && d >= 0 && d <= 30 && !done && (
                item.자동갱신
                  ? <span style={{ fontSize: 10, fontWeight: 600, color: "var(--muted)" }} title="자동갱신 조항 — 통지 없으면 자동 연장">↻ D-{d} 자동갱신</span>
                  : <span style={{ fontSize: 10, fontWeight: 700, color: d <= 7 ? red : "#C2410C" }}>만료 D-{d}</span>
              )}
              {item.메모 && !done && <span style={{ fontSize: 10, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.메모}</span>}
            </div>
          </div>

          {/* 우측 링크/펼침 — 상태는 좌측 체크서클로 표현. 계약서 라벨은 구분에 맞게 (혼동 방지) */}
          {(() => {
            const docLabel = item.구분 === "NDA" ? "NDA"
              : item.구분 === "부속합의서" ? (item.파트너십계약포함 ? "파트너십계약서" : "부속합의서")
              : "파트너십계약서"; // 파트너십계약
            const pill = { fontSize: 10, fontWeight: 600, padding: "3px 7px", borderRadius: 3, textDecoration: "none", whiteSpace: "nowrap" };
            const bluePill = { ...pill, background: blueFaint, color: blue, border: "1px solid rgba(0,120,212,.25)" };
            return !isOpen && (<>
              {item.계약서URL && <a href={item.계약서URL} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={bluePill}>{docLabel} →</a>}
              {covered && !item.계약서URL && masterUrl && <a href={masterUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={bluePill}>파트너십계약서 →</a>}
              {item.기안링크 && <a href={item.기안링크} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ ...pill, background: greenFaint, color: green, border: "1px solid rgba(22,163,74,.25)" }}>기안 →</a>}
            </>);
          })()}
          <button onClick={e => { e.stopPropagation(); copyItemLink(item.id); }}
            title="이 항목으로 바로 가는 링크 복사"
            style={{ fontSize: 10, fontWeight: 600, padding: "3px 7px", borderRadius: 3, whiteSpace: "nowrap", fontFamily: "inherit", cursor: "pointer",
              background: copiedId === item.id ? greenFaint : "var(--card)",
              color: copiedId === item.id ? green : "var(--text)",
              border: `1px solid ${copiedId === item.id ? "rgba(22,163,74,.25)" : "#c7ccd4"}`,
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
            {copiedId === item.id ? "✓ 복사됨" : "링크복사"}
          </button>
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
            {locked && (
              <div style={{ fontSize: 11, color: "var(--muted)", background: greenFaint, border: "1px solid rgba(22,163,74,.25)", borderRadius: 5, padding: "6px 10px", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: green, fontWeight: 700 }}>✓ 완료된 항목</span> — 읽기 전용입니다. 내용을 바꾸려면 "수정"을 누르세요.
              </div>
            )}
            <fieldset disabled={locked} style={{ border: "none", margin: 0, padding: 0, minWidth: 0 }}>
              {renderFields(draft, setDraft, false)}
            </fieldset>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16 }}>
              <button onClick={() => openEdit(item)} style={{ fontSize: 11, border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer", fontFamily: "inherit", marginRight: "auto" }}>전체 편집 창 ↗</button>
              <button onClick={collapseStep} disabled={isBusy}
                style={{ padding: "8px 14px", fontSize: 12, border: "1px solid var(--line)", borderRadius: 6, background: "var(--card)", color: "var(--text)", cursor: "pointer", fontFamily: "inherit" }}>접기</button>
              {locked ? (
                <button onClick={() => setEditingStep(item.id)} disabled={isBusy}
                  style={{ padding: "8px 16px", fontSize: 12, fontWeight: 600, border: `1px solid ${green}`, borderRadius: 6, background: greenFaint, color: green, cursor: "pointer", fontFamily: "inherit" }}>✎ 수정</button>
              ) : (<>
                {(() => { const cb = missingForComplete(draft); return (<>
                  {!done && cb && (
                    <span style={{ fontSize: 10.5, color: "#C2410C", marginRight: 4 }} title={cb}>완료 조건: {cb}</span>
                  )}
                  {!done && (
                    <button onClick={() => saveStep(item, false)} disabled={isBusy}
                      style={{ padding: "8px 14px", fontSize: 12, fontWeight: 600, border: `1px solid ${amber}`, borderRadius: 6, background: amberFaint, color: "#B45309", cursor: "pointer", fontFamily: "inherit" }}>저장 (진행중)</button>
                  )}
                  <button onClick={() => saveStep(item, !done)} disabled={isBusy || (!done && !!cb)}
                    title={!done && cb ? `완료하려면: ${cb}` : ""}
                    style={{ padding: "8px 16px", fontSize: 12, fontWeight: 600, border: "none", borderRadius: 6, background: done ? green : amber, color: done ? "#fff" : "#1a1a1a", cursor: (!done && cb) ? "not-allowed" : "pointer", opacity: (!done && cb) ? 0.5 : 1, fontFamily: "inherit" }}>
                    {done ? "저장" : "완료하고 다음 단계 →"}
                  </button>
                </>); })()}
              </>)}
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
    <div style={{ display: "flex", flexDirection: "column", minHeight: 500, background: "var(--zone)", borderRadius: 10, padding: 12, gap: 10 }}>
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

      {/* 전역 자동완성 목록 (국가·담당자) */}
      <datalist id="country-list">
        {[...KNOWN_COUNTRIES, ...[...new Set(items.flatMap(i => [(i.거래처국가 || "").trim(), (i.개발소재지 || "").trim()]).filter(Boolean))].filter(c => !KNOWN_COUNTRIES.includes(c))].map(c => <option key={c} value={c} />)}
      </datalist>
      <datalist id="owner-list">{owners.map(o => <option key={o} value={o} />)}</datalist>

      {/* ── ① 확인 존: 담당자 필터 · 상태 카운트 · 알림 칩 · 액션 ── */}
      <div style={{ padding: "10px 18px 12px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
        <span>확인</span><span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>오늘 주의할 것</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px 12px" }}>
        {owners.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, letterSpacing: ".05em" }}>담당자</span>
            {["전체", ...owners].map(o => {
              const active = (o === "전체" && !ownerFilter) || ownerFilter === o;
              return (
                <button key={o} onClick={() => setOwnerFilter(o === "전체" ? null : o)}
                  style={{ fontSize: 11, padding: "4px 10px", borderRadius: 99, border: `1px solid ${active ? amber : "var(--line)"}`, background: active ? amberFaint : "transparent", color: active ? "#B45309" : "var(--muted)", cursor: "pointer", fontFamily: "inherit", fontWeight: active ? 700 : 400 }}>{o}</button>
              );
            })}
            <span style={{ width: 1, height: 16, background: "var(--line)", margin: "0 2px" }} />
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, color: "var(--muted)" }}>
          <span><b style={{ color: amber, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{totalActive}</b> 진행중</span>
          <span><b style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--text)" }}>{totalWaiting}</b> 대기</span>
          <span><b style={{ color: green, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{totalDone}</b> 완료</span>
        </div>

        {[
          { k: "expire", t: "만료", n: alertCounts.expire, c: "#DC2626", bg: "rgba(220,38,38,.08)" },
          { k: "warn", t: "경고", n: alertCounts.warn, c: "#C2410C", bg: "rgba(194,65,29,.10)" },
          { k: "stale", t: "정체", n: alertCounts.stale, c: blue, bg: blueFaint },
          { k: "heal", t: "누락", n: alertCounts.heal, c: "#B45309", bg: amberFaint },
        ].filter(a => a.n > 0).map(a => {
          const active = queueFilter === a.k;
          return (
            <button key={a.k} onClick={() => { setQueueFilter(active ? null : a.k); setQueueOpen(true); }}
              title="클릭 시 큐 필터" style={{ fontSize: 11, fontWeight: 700, padding: "4px 11px", borderRadius: 99, border: `1px solid ${active ? a.c : "transparent"}`, background: a.bg, color: a.c, cursor: "pointer", fontFamily: "inherit" }}>
              {a.t} {a.n}
            </button>
          );
        })}

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {sentMsg && <span style={{ fontSize: 11, color: green, fontWeight: 600 }}>{sentMsg}</span>}
          <button onClick={sendAlert} disabled={sending}
            style={{ padding: "8px 13px", borderRadius: 7, border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontSize: 12, fontWeight: 600, cursor: sending ? "not-allowed" : "pointer", opacity: sending ? 0.6 : 1, fontFamily: "inherit" }}>
            {sending ? "발송 중…" : "Slack 알림"}
          </button>
          <a className="m-notion" href={NOTION_DB_URL} target="_blank" rel="noopener noreferrer"
            style={{ padding: "8px 15px", borderRadius: 7, fontSize: 12, fontWeight: 600, textDecoration: "none", letterSpacing: ".02em", display: "inline-block" }}>
            Notion DB ↗
          </a>
        </div>
      </div>
      </div>

      {/* ── ② 지금 할 일 존 (접이식) ── */}
      {!loading && !error && todoQueue.length > 0 && (
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderLeft: `3px solid ${amber}`, borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.05)", padding: "8px 18px" }}>
          <div onClick={() => setQueueOpen(o => !o)} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: queueOpen ? 6 : 0, cursor: "pointer" }}>
            <span style={{ fontSize: 12, color: "var(--muted)", transform: queueOpen ? "none" : "rotate(-90deg)", transition: "transform .15s" }}>▾</span>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "#B45309" }}>지금 할 일</span>
            <span style={{ fontSize: 10, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
              {filteredQueue.length}{filteredQueue.length !== todoQueue.length ? `/${todoQueue.length}` : ""}건
            </span>
            {queueOpen && !queueFilter && !ownerFilter && <span style={{ fontSize: 10, color: "var(--muted)" }}>· 여기서 시작</span>}
            {(queueFilter || ownerFilter) && (
              <button onClick={e => { e.stopPropagation(); setQueueFilter(null); setOwnerFilter(null); }}
                style={{ fontSize: 10, color: blue, border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit" }}>필터 해제</button>
            )}
          </div>
          {queueOpen && (
            <div className="slim-scroll" style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 132, overflowY: "auto" }}>
              {filteredQueue.length === 0 ? (
                <div style={{ fontSize: 11, color: "var(--muted)", padding: "6px 2px" }}>해당 항목 없음</div>
              ) : filteredQueue.map(a => {
                const chip = a.kind === "expire" ? { t: "만료", c: "#DC2626", bg: "rgba(220,38,38,.08)" }
                  : a.kind === "warn" ? { t: "경고", c: "#C2410C", bg: "rgba(194,65,29,.10)" }
                  : a.kind === "heal" ? { t: "누락", c: "#B45309", bg: amberFaint }
                  : a.kind === "iter" ? { t: "정산", c: "var(--muted)", bg: "transparent" }
                  : { t: "다음", c: blue, bg: blueFaint };
                return (
                  <button key={a.key} onClick={() => actOn(a)}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", borderRadius: 5, border: "1px solid var(--line)", background: "var(--card)", cursor: "pointer", fontFamily: "inherit", textAlign: "left", minWidth: 0 }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(120,124,135,.10)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "var(--card)"; }}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".04em", color: chip.c, background: chip.bg, border: `1px solid ${chip.c === "var(--muted)" ? "var(--line)" : "transparent"}`, borderRadius: 3, padding: "1px 6px", flexShrink: 0 }}>{chip.t}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", flexShrink: 0 }}>{a.partner}</span>
                    {partnerOwner(a.partner) && <span style={{ fontSize: 10, color: "var(--muted)", flexShrink: 0 }}>· {partnerOwner(a.partner)}</span>}
                    <span style={{ fontSize: 12, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.label}</span>
                    <span style={{ marginLeft: "auto", fontSize: 10.5, color: a.stale ? "#C2410C" : "var(--muted)", flexShrink: 0, fontWeight: a.stale ? 700 : 400 }}>
                      {a.stale ? `${a.stale}일 정체 · ` : ""}{a.reason}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Body ── */}
      {loading ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 13, minHeight: 300 }}>노션 데이터 불러오는 중…</div>
      ) : error ? (
        <div style={{ margin: 20, padding: "12px 16px", fontSize: 13, color: red, background: "rgba(220,38,38,.06)", border: "1px solid rgba(220,38,38,.2)", borderRadius: 4 }}>
          데이터 로드 실패: {error} <button onClick={load} style={{ marginLeft: 8 }}>재시도</button>
        </div>
      ) : (
        <div style={{ display: "flex", flex: 1, overflow: "hidden", height: 620, maxHeight: "74vh", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>

          {/* ── 작업 존 · 왼쪽 nav (파트너사) ── */}
          <div style={{ width: 210, flexShrink: 0, borderRight: `1px solid ${SB_LINE}`, display: "flex", flexDirection: "column", background: SB_BG }}>
            <div style={{ padding: "10px 14px 8px", borderBottom: `1px solid ${SB_LINE}`, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: SB_MUTED, flex: 1 }}>파트너사 · 선택</span>
              <button onClick={load} title="새로고침" style={{
                fontSize: 11, padding: "2px 6px", borderRadius: 3,
                border: `1px solid ${SB_LINE}`, color: SB_MUTED, background: "transparent", cursor: "pointer", fontFamily: "inherit",
              }}>↻</button>
            </div>

            <div className="slim-scroll" style={{ flex: 1, overflowY: "auto" }}>
              {visiblePartnerList.length === 0 && (
                <div style={{ padding: "24px 14px", fontSize: 12, color: SB_MUTED, textAlign: "center" }}>파트너사 없음</div>
              )}
              {(() => {
                // 개발소재지별 그룹 (없는 파트너는 '미지정'으로 맨 아래)
                const groups = new Map();
                visiblePartnerList.forEach(p => {
                  const c = partnerDevLocation(p) || "미지정";
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
                    <div style={{ padding: "7px 14px 4px", fontSize: 9, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: SB_MUTED, background: SB_GRP_BG, borderBottom: `1px solid ${SB_LINE}`, display: "flex", alignItems: "center", gap: 5 }}>
                      {country !== "미지정" && <Flag country={country} size={14} />}
                      <span>{country === "미지정" ? "국가 미지정" : country}</span>
                      <span style={{ fontWeight: 400 }}>· {list.length}</span>
                    </div>
                    {list.map(renderSidebarPartner)}
                  </div>
                ));
              })()}
            </div>

            <div style={{ padding: 8, borderTop: `1px solid ${SB_LINE}` }}>
              {addingPartner ? (
                <form style={{ display: "flex", flexDirection: "column", gap: 6 }}
                  onSubmit={e => {
                    e.preventDefault();
                    const name = newPartnerName.trim();
                    const proj = newPartnerProject.trim();
                    const country = newPartnerCountry.trim();
                    const owner = newPartnerOwner.trim();
                    if (!name) return;
                    setPartners(prev => prev.includes(name) ? prev : [...prev, name]);
                    setSelected(name);
                    setAddingPartner(false);
                    setNewPartnerName("");
                    setNewPartnerProject("");
                    setNewPartnerCountry("");
                    setNewPartnerOwner("");
                    if (!items.some(i => i.파트너사 === name)) {
                      const ownerF = owner ? { 담당자: owner } : {};
                      if (proj) {
                        // 파트너십계약 → 거래처등록 → 부속합의서(파트너십계약 포함) → 프로토타입 지출기안 한 번에 생성
                        createRows([
                          { 제목: `[${name}] 파트너십계약`, 파트너사: name, 구분: "파트너십계약", 상태: "요청전", ...ownerF },
                          { 제목: `[${name}] 거래처등록`, 파트너사: name, 구분: "거래처등록", 상태: "요청전", ...(country ? { 개발소재지: country } : {}), ...ownerF },
                          { 제목: `[${proj}] 부속합의서`, 파트너사: name, 프로젝트: proj, 구분: "부속합의서", 상태: "완료", 파트너십계약포함: true, ...ownerF },
                          { 제목: `[${proj}] 프로토타입 지출기안`, 파트너사: name, 프로젝트: proj, 구분: "지출기안", 이터레이션구분: "프로토타입", 상태: "요청전", ...ownerF },
                        ]);
                      } else {
                        createPartnerTemplate(name, country, owner).then(() => setAddingProject(true));
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
                      placeholder="개발 소재지 (예: Vietnam)"
                      style={{ flex: 0.8, padding: "6px 9px", fontSize: 12, border: "1px solid var(--line)", borderRadius: 4, background: "var(--card)", color: "var(--text)", boxSizing: "border-box", minWidth: 0 }} />
                  </div>
                  <input value={newPartnerOwner} onChange={e => setNewPartnerOwner(e.target.value)} list="owner-list"
                    placeholder="담당자 (선택)"
                    style={{ width: "100%", padding: "6px 9px", fontSize: 12, border: "1px solid var(--line)", borderRadius: 4, background: "var(--card)", color: "var(--text)", boxSizing: "border-box" }} />
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
                  <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
                    {renamingPartner ? (
                      <form onSubmit={e => { e.preventDefault(); renamePartner(renameValue); }}>
                        <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                          onBlur={() => setRenamingPartner(false)}
                          onKeyDown={e => { if (e.key === "Escape") setRenamingPartner(false); }}
                          placeholder="새 파트너사명 입력 후 Enter"
                          style={{ padding: "4px 9px", fontSize: 13, fontWeight: 700, border: "1px solid var(--line)", borderRadius: 4, background: "var(--card)", color: "var(--text)", width: 180 }} />
                      </form>
                    ) : (
                      <>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{selected}</span>

                        {/* 개발 소재지 — 사이드바·국기·KST 기준 (클릭 인라인 편집) */}
                        {editingHeaderField === "개발소재지" ? (
                          <input autoFocus list="country-list" value={headerFieldValue}
                            onChange={e => setHeaderFieldValue(e.target.value)}
                            onBlur={() => saveHeaderField(selected, "개발소재지", headerFieldValue)}
                            onKeyDown={e => { if (e.key === "Enter") saveHeaderField(selected, "개발소재지", headerFieldValue); if (e.key === "Escape") setEditingHeaderField(null); }}
                            placeholder="개발 소재지 (예: Vietnam (KST-2))"
                            style={{ fontSize: 11, padding: "2px 7px", border: "1px solid var(--line)", borderRadius: 3, background: "var(--card)", color: "var(--text)", width: 170 }} />
                        ) : (
                          <button onClick={() => { setHeaderFieldValue(partnerDevLocation(selected)); setEditingHeaderField("개발소재지"); }}
                            title="개발 소재지 지정/변경 — 사이드바·시차 기준"
                            style={{ fontSize: 10, fontWeight: 600, color: partnerDevLocation(selected) ? "var(--muted)" : blue, border: `1px ${partnerDevLocation(selected) ? "solid" : "dashed"} var(--line)`, borderRadius: 3, padding: "1px 6px", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4, background: "transparent", cursor: "pointer", fontFamily: "inherit" }}>
                            {partnerDevLocation(selected) ? <><Flag country={partnerDevLocation(selected)} size={13} />{partnerDevLocation(selected)}</> : "+ 개발 소재지"}
                          </button>
                        )}

                        {/* 법인 등록국 — 거래처 정보/지급 기준 (개발소재지와 다를 때 특히 중요) */}
                        {editingHeaderField === "거래처국가" ? (
                          <input autoFocus list="country-list" value={headerFieldValue}
                            onChange={e => setHeaderFieldValue(e.target.value)}
                            onBlur={() => saveHeaderField(selected, "거래처국가", headerFieldValue)}
                            onKeyDown={e => { if (e.key === "Enter") saveHeaderField(selected, "거래처국가", headerFieldValue); if (e.key === "Escape") setEditingHeaderField(null); }}
                            placeholder="법인 등록국 (예: Hong Kong (KST-1))"
                            style={{ fontSize: 11, padding: "2px 7px", border: "1px solid var(--line)", borderRadius: 3, background: "var(--card)", color: "var(--text)", width: 170 }} />
                        ) : (
                          <button onClick={() => { setHeaderFieldValue(partnerCountry(selected)); setEditingHeaderField("거래처국가"); }}
                            title="법인 등록국 지정/변경 — 거래처 정보·지급 기준"
                            style={{ fontSize: 10, fontWeight: 600, color: partnerCountry(selected) ? "var(--muted)" : blue, border: `1px ${partnerCountry(selected) ? "solid" : "dashed"} var(--line)`, borderRadius: 3, padding: "1px 6px", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4, background: "transparent", cursor: "pointer", fontFamily: "inherit" }}>
                            {partnerCountry(selected) ? <>🏛 {partnerCountry(selected)}</> : "+ 법인 등록국"}
                          </button>
                        )}

                        {/* 담당자 — 클릭해서 인라인 편집 */}
                        {editingHeaderField === "담당자" ? (
                          <input autoFocus list="owner-list" value={headerFieldValue}
                            onChange={e => setHeaderFieldValue(e.target.value)}
                            onBlur={() => saveHeaderField(selected, "담당자", headerFieldValue)}
                            onKeyDown={e => { if (e.key === "Enter") saveHeaderField(selected, "담당자", headerFieldValue); if (e.key === "Escape") setEditingHeaderField(null); }}
                            placeholder="담당자"
                            style={{ fontSize: 11, padding: "2px 7px", border: "1px solid var(--line)", borderRadius: 3, background: "var(--card)", color: "var(--text)", width: 110 }} />
                        ) : (
                          <button onClick={() => { setHeaderFieldValue(partnerOwner(selected)); setEditingHeaderField("담당자"); }}
                            title="담당자 지정/변경"
                            style={{ fontSize: 10, fontWeight: 600, color: partnerOwner(selected) ? "var(--muted)" : blue, border: `1px ${partnerOwner(selected) ? "solid" : "dashed"} var(--line)`, borderRadius: 3, padding: "1px 6px", whiteSpace: "nowrap", background: "transparent", cursor: "pointer", fontFamily: "inherit" }}>
                            {partnerOwner(selected) ? `담당 ${partnerOwner(selected)}` : "+ 담당자"}
                          </button>
                        )}
                        <button onMouseDown={e => e.preventDefault()} onClick={() => { setRenameValue(selected); setRenamingPartner(true); }} disabled={partnerBusy}
                          title="파트너사명 변경" style={{ fontSize: 11, border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer", padding: 2, opacity: 0.6, fontFamily: "inherit" }}>✎</button>
                        <button onClick={deletePartner} disabled={partnerBusy}
                          title="파트너사 삭제 (항목 전체)" style={{ fontSize: 11, border: "none", background: "transparent", color: red, cursor: "pointer", padding: 2, opacity: 0.5, fontFamily: "inherit" }}>
                          {partnerBusy ? "…" : "🗑"}
                        </button>
                      </>
                    )}
                    {projectNames.filter(p => p !== "(프로젝트 미지정)").length > 0 && (
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>
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
                    <span style={{ fontWeight: 700, color: green }}>{doneCount}</span>/{activeRows.length} 완료
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

                  {projectNames.map(proj => {
                    const pstatus = projectStatusOf(selected, proj);
                    const muted = pstatus !== "진행중";
                    const statusStyle = pstatus === "드랍"
                      ? { color: "#DC2626", background: "rgba(220,38,38,.08)", border: "1px solid rgba(220,38,38,.25)" }
                      : { color: "var(--muted)", background: "var(--card-bg-subtle)", border: "1px solid var(--line)" };
                    return (
                    <div key={proj}>
                      {renderDivider(
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                          <span style={{ textDecoration: muted ? "line-through" : "none" }}>{proj}</span>
                          <select value={pstatus} onChange={e => setProjectStatus(selected, proj, e.target.value)}
                            title="프로젝트 상태" onClick={e => e.stopPropagation()}
                            style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".03em", borderRadius: 3, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit", ...statusStyle }}>
                            {["진행중", "종료", "드랍"].map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </span>,
                        !muted && (
                          <button onClick={() => openAdd("지출기안", selected, proj === "(프로젝트 미지정)" ? "" : proj)}
                            style={{ ...addBtn(false), padding: "3px 9px", fontSize: 11 }}>
                            + 항목
                          </button>
                        )
                      )}
                      <div style={{ opacity: muted ? 0.55 : 1 }}>
                        {renderGroup(projectRows(proj))}
                      </div>
                    </div>
                    );
                  })}
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
