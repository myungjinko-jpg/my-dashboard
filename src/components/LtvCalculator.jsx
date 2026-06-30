import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler } from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

// Apps Script 배포 후 URL을 여기에 입력
const APPS_SCRIPT_URL = import.meta.env.VITE_LTV_SCRIPT_URL || "";

const MONTH_LABELS = ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9", "M10", "M11", "M12"];
const DAY_GOALS = { 1: 0.4, 7: 0.17, 14: 0.07, 30: 0.025 };

function pct(v) { return (v * 100).toFixed(1) + "%"; }
function usd(v) { return "$" + v.toFixed(2); }
function usd4(v) { return "$" + v.toFixed(4); }
function kLabel(k) {
  if (k >= -0.45) return { text: "완만", color: "#10b981" };
  if (k >= -0.85) return { text: "보통", color: "#f59e0b" };
  return { text: "급격", color: "#f43f5e" };
}
function ratio(iapPct) {
  const iap = Math.round(iapPct * 10);
  const iaa = 10 - iap;
  return `IAP ${iap} : IAA ${iaa}`;
}

function HelpTip({ text }) {
  const [pos, setPos] = useState(null);
  const iconRef = useRef(null);

  const show = useCallback(() => {
    const r = iconRef.current?.getBoundingClientRect();
    if (r) setPos({ x: r.left + r.width / 2, y: r.top - 8 });
  }, []);

  const hide = useCallback(() => setPos(null), []);

  return (
    <span className="ltv-helptip-wrap" onMouseEnter={show} onMouseLeave={hide}>
      <span ref={iconRef} className="ltv-helptip-icon">?</span>
      {pos && (
        <span
          className="ltv-helptip-box"
          style={{ left: pos.x, top: pos.y, transform: "translate(-50%, -100%)" }}
        >
          {text}
        </span>
      )}
    </span>
  );
}

function SliderInput({ label, value, onChange, min, max, step, display, children }) {
  return (
    <div className="ltv-input-group">
      <div className="ltv-input-label">
        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>{label}</span>
        <span className="ltv-input-value">{display(value)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="ltv-slider"
      />
      {children}
    </div>
  );
}

function ArpdauInput({ value, onChange }) {
  return (
    <div className="ltv-input-group">
      <div className="ltv-input-label">
        <span>ARPDAU</span>
        <span className="ltv-input-value">{usd4(value)}</span>
      </div>
      <input
        type="range" min={0.01} max={1.0} step={0.01} value={Math.min(value, 1.0)}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="ltv-slider"
      />
      <div style={{ display: "flex", gap: "6px", marginTop: "6px", alignItems: "center" }}>
        <span style={{ fontSize: "11px", color: "var(--muted)", whiteSpace: "nowrap" }}>직접 입력</span>
        <input
          type="number" min={0.001} max={50} step={0.001} value={value}
          onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) onChange(v); }}
          className="ltv-number-input"
        />
      </div>
    </div>
  );
}

function gasGet(params) {
  const url = APPS_SCRIPT_URL + "?" + new URLSearchParams(params).toString();
  return fetch(url).then(r => r.json());
}

function parseCSVLine(line) {
  const result = [];
  let cur = "", inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { result.push(cur); cur = ""; }
    else { cur += ch; }
  }
  result.push(cur);
  return result;
}

function parseAppMagicCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = parseCSVLine(lines[0]);
  const idx = (n) => headers.findIndex(h => h.trim() === n);
  const iApp = idx("application"), iPub = idx("publisher"), iGenre = idx("tagsGames");
  const iD1 = idx("retention_1"), iD7 = idx("retention_7"), iD14 = idx("retention_14");
  const iRpd = idx("cumulative_rpd"), iSpend = idx("ad_spend"), iDl = idx("downloads");

  const map = {};
  lines.slice(1).forEach(line => {
    const c = parseCSVLine(line);
    const app = c[iApp]?.trim();
    if (!app) return;
    if (!map[app]) map[app] = { app, publisher: c[iPub]?.trim() || "", genre: (c[iGenre]?.trim() || "").split(",")[0].trim(), d1s: [], d7s: [], d14s: [], rpds: [], spend: 0, dl: 0, months: 0 };
    const m = map[app];
    m.months++;
    const d1 = parseFloat(c[iD1]); if (!isNaN(d1) && d1 > 0) m.d1s.push(d1);
    const d7 = parseFloat(c[iD7]); if (!isNaN(d7) && d7 > 0) m.d7s.push(d7);
    const d14 = parseFloat(c[iD14]); if (!isNaN(d14) && d14 > 0) m.d14s.push(d14);
    const rpd = parseFloat(c[iRpd]); if (!isNaN(rpd) && rpd > 0) m.rpds.push(rpd);
    const sp = parseFloat(c[iSpend]); if (!isNaN(sp)) m.spend += sp;
    const dl = parseFloat(c[iDl]); if (!isNaN(dl)) m.dl += dl;
  });

  const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  return Object.values(map).map(m => {
    const d1 = avg(m.d1s), d7 = avg(m.d7s), d14 = avg(m.d14s), cumRpd = avg(m.rpds);
    const k = d1 && d7 ? +(Math.log(d7 / d1) / Math.log(7)).toFixed(3) : null;
    const cpi = m.dl > 0 && m.spend > 0 ? +(m.spend / m.dl).toFixed(3) : null;
    return { app: m.app, publisher: m.publisher, genre: m.genre, d1: d1 ? +(d1 / 100).toFixed(4) : null, d7: d7 ? +(d7 / 100).toFixed(4) : null, d14: d14 ? +(d14 / 100).toFixed(4) : null, k, cumRpd, cpi, months: m.months };
  }).filter(a => a.d1 && a.k);
}

const DEFAULTS = { d1: 0.4, k: -0.66, arpdau: 0.10, iapPct: 0.1, cpi: 1.0, installs: 10000 };

export default function LtvCalculator({ isDark }) {
  const [d1, setD1] = useState(DEFAULTS.d1);
  const [k, setK] = useState(DEFAULTS.k);
  const [arpdau, setArpdau] = useState(DEFAULTS.arpdau);
  const [iapPct, setIapPct] = useState(DEFAULTS.iapPct);
  const [cpi, setCpi] = useState(DEFAULTS.cpi);
  const [installs, setInstalls] = useState(DEFAULTS.installs);
  const [presets, setPresets] = useState([]);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [presetLoading, setPresetLoading] = useState(false);
  const [presetError, setPresetError] = useState("");

  const [benchmarks, setBenchmarks] = useState([]);
  const [bmGenre, setBmGenre] = useState("전체");
  const [bmLoading, setBmLoading] = useState(false);
  const [bmUploading, setBmUploading] = useState(false);
  const [bmMsg, setBmMsg] = useState("");
  const [appliedBm, setAppliedBm] = useState(null);
  const fileInputRef = useRef(null);

  const iapArpdau = arpdau * iapPct;
  const iaaArpdau = arpdau * (1 - iapPct);

  useEffect(() => {
    if (!APPS_SCRIPT_URL) return;
    setPresetLoading(true);
    gasGet({ action: "list" })
      .then(data => setPresets(Array.isArray(data) ? data.reverse() : []))
      .catch(() => setPresetError("불러오기 실패"))
      .finally(() => setPresetLoading(false));

    setBmLoading(true);
    gasGet({ action: "listAppMagic" })
      .then(data => setBenchmarks(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setBmLoading(false));
  }, []);

  const handleCSVUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !APPS_SCRIPT_URL) return;
    setBmUploading(true);
    setBmMsg("");
    try {
      const text = await file.text();
      const parsed = parseAppMagicCSV(text);
      if (!parsed.length) { setBmMsg("유효한 데이터가 없습니다."); return; }
      const saveRes = await gasGet({ action: "saveAppMagic", data: JSON.stringify(parsed) });
      if (!saveRes.ok) { setBmMsg("저장 실패 — Apps Script 재배포가 필요합니다."); return; }
      const updated = await gasGet({ action: "listAppMagic" });
      setBenchmarks(Array.isArray(updated) ? updated : []);
      setBmMsg(`${parsed.length}개 앱 저장 완료`);
    } catch { setBmMsg("업로드 실패"); }
    finally { setBmUploading(false); e.target.value = ""; }
  };

  const applyBenchmark = (bm) => {
    if (bm.d1) setD1(Number(bm.d1));
    if (bm.k) setK(Number(bm.k));
    if (bm.cumRpd) setArpdau(Number(bm.cumRpd));
    if (bm.cpi) setCpi(Number(bm.cpi));
    setAppliedBm(bm);
  };

  const resetAll = () => {
    setD1(DEFAULTS.d1); setK(DEFAULTS.k); setArpdau(DEFAULTS.arpdau);
    setIapPct(DEFAULTS.iapPct); setCpi(DEFAULTS.cpi); setInstalls(DEFAULTS.installs);
    setAppliedBm(null);
  };

  const bmGenres = ["전체", ...Array.from(new Set(benchmarks.map(b => b.genre).filter(Boolean)))];
  const filteredBm = bmGenre === "전체" ? benchmarks : benchmarks.filter(b => b.genre === bmGenre);

  const savePreset = async () => {
    const name = saveName.trim();
    if (!name || !APPS_SCRIPT_URL) return;
    setPresetLoading(true);
    try {
      const data = JSON.stringify({ name, d1, k, arpdau, iapPct, cpi, installs });
      const res = await gasGet({ action: "save", data });
      if (res.ok) {
        const newPreset = { id: res.id, name, d1, k, arpdau, iapPct, cpi, installs };
        setPresets(prev => [newPreset, ...prev]);
      }
    } catch { setPresetError("저장 실패"); }
    finally { setPresetLoading(false); setSaveName(""); setSaving(false); }
  };

  const loadPreset = (p) => {
    setD1(Number(p.d1)); setK(Number(p.k)); setArpdau(Number(p.arpdau));
    setIapPct(Number(p.iapPct)); setCpi(Number(p.cpi)); setInstalls(Number(p.installs));
  };

  const deletePreset = async (id) => {
    if (!APPS_SCRIPT_URL) return;
    setPresets(prev => prev.filter(p => p.id != id));
    gasGet({ action: "delete", id }).catch(() => {});
  };

  const tickColor = isDark ? "#94a3b8" : "#6b7280";
  const gridColor = isDark ? "#2a3448" : "#e5e7eb";
  const textColor = isDark ? "#cbd5e1" : "#374151";

  // Daily retention: ret(d) = d1 * d^k
  const retByDay = useMemo(() => {
    const arr = new Array(360);
    for (let d = 1; d <= 360; d++) arr[d - 1] = d1 * Math.pow(d, k);
    return arr;
  }, [d1, k]);

  // Cumulative LTV per user by day (total, IAP, IAA)
  const ltvByDay = useMemo(() => {
    const total = new Array(360);
    const iap = new Array(360);
    const iaa = new Array(360);
    let cumT = 0, cumIap = 0, cumIaa = 0;
    for (let d = 0; d < 360; d++) {
      cumT   += retByDay[d] * arpdau;
      cumIap += retByDay[d] * iapArpdau;
      cumIaa += retByDay[d] * iaaArpdau;
      total[d] = cumT; iap[d] = cumIap; iaa[d] = cumIaa;
    }
    return { total, iap, iaa };
  }, [retByDay, arpdau, iapArpdau, iaaArpdau]);

  // Monthly: avg retention, incremental revenue, cumulative LTV
  const monthly = useMemo(() => {
    return MONTH_LABELS.map((label, m) => {
      const start = m * 30;
      const end = start + 30;
      let sumRet = 0, sumRev = 0, sumIap = 0, sumIaa = 0;
      for (let d = start; d < end; d++) {
        sumRet += retByDay[d];
        sumRev += retByDay[d] * arpdau;
        sumIap += retByDay[d] * iapArpdau;
        sumIaa += retByDay[d] * iaaArpdau;
      }
      return {
        label,
        avgRet: sumRet / 30,
        monthRev: sumRev,
        monthIap: sumIap,
        monthIaa: sumIaa,
        cumLtv: ltvByDay.total[end - 1],
        cumIap: ltvByDay.iap[end - 1],
        cumIaa: ltvByDay.iaa[end - 1],
      };
    });
  }, [retByDay, arpdau, iapArpdau, iaaArpdau, ltvByDay]);

  // Breakeven day
  const breakevenDay = useMemo(() => {
    for (let d = 0; d < 360; d++) {
      if (ltvByDay.total[d] >= cpi) return d + 1;
    }
    return null;
  }, [ltvByDay, cpi]);

  // Retention chart (D1~D30 daily)
  const retChartData = useMemo(() => {
    const labels = Array.from({ length: 30 }, (_, i) => `D${i + 1}`);
    const goalPoints = Array.from({ length: 30 }, (_, i) => DAY_GOALS[i + 1] ?? null);
    return {
      labels,
      datasets: [
        {
          label: "Simulated Retention",
          data: retByDay.slice(0, 30).map(v => +(v * 100).toFixed(2)),
          borderColor: "#4361ee",
          backgroundColor: "rgba(67,97,238,0.08)",
          fill: true,
          tension: 0.3,
          pointRadius: 2,
        },
        {
          label: "Goal",
          data: goalPoints.map(v => v !== null ? +(v * 100).toFixed(2) : null),
          borderColor: "#f59e0b",
          backgroundColor: "transparent",
          borderDash: [5, 3],
          pointRadius: 5,
          pointStyle: "circle",
          spanGaps: false,
          tension: 0,
        },
      ],
    };
  }, [retByDay]);

  // LTV chart (monthly cumulative)
  const ltvChartData = useMemo(() => {
    const cpiLine = Array(12).fill(+(cpi).toFixed(4));
    return {
      labels: MONTH_LABELS,
      datasets: [
        {
          label: "Total LTV / User",
          data: monthly.map(m => +m.cumLtv.toFixed(4)),
          borderColor: "#10b981",
          backgroundColor: "rgba(16,185,129,0.08)",
          fill: true,
          tension: 0.3,
          pointRadius: 3,
        },
        {
          label: `IAP (${Math.round(iapPct * 100)}%)`,
          data: monthly.map(m => +m.cumIap.toFixed(4)),
          borderColor: "#8b5cf6",
          backgroundColor: "transparent",
          borderDash: [4, 2],
          pointRadius: 2,
          tension: 0.3,
        },
        {
          label: `IAA (${Math.round((1 - iapPct) * 100)}%)`,
          data: monthly.map(m => +m.cumIaa.toFixed(4)),
          borderColor: "#f59e0b",
          backgroundColor: "transparent",
          borderDash: [4, 2],
          pointRadius: 2,
          tension: 0.3,
        },
        {
          label: "CPI",
          data: cpiLine,
          borderColor: "#f43f5e",
          backgroundColor: "transparent",
          borderDash: [5, 3],
          pointRadius: 0,
        },
      ],
    };
  }, [monthly, cpi, iapPct]);

  const chartOpts = (yLabel, yFmt) => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { position: "top", labels: { color: textColor, boxWidth: 12, font: { size: 12 } } },
      tooltip: {
        backgroundColor: isDark ? "#1e2d42" : "#fff",
        titleColor: textColor,
        bodyColor: textColor,
        borderColor: isDark ? "#2a3a5a" : "#e2e5ea",
        borderWidth: 1,
      },
    },
    scales: {
      x: { ticks: { color: tickColor, font: { size: 11 } }, grid: { color: gridColor } },
      y: {
        ticks: { color: tickColor, font: { size: 11 }, callback: yFmt },
        grid: { color: gridColor },
        title: { display: true, text: yLabel, color: tickColor, font: { size: 11 } },
      },
    },
  });

  const ltv7  = ltvByDay.total[6];
  const ltv14 = ltvByDay.total[13];
  const ltv30 = ltvByDay.total[29];
  const ltv90 = ltvByDay.total[89];

  return (
    <div className="ltv-wrap">
      {/* KPI Summary */}
      <div className="ltv-kpi-row">
        {[
          { label: "LTV D7",  value: usd(ltv7),  sub: `ROI ${((ltv7  / cpi) * 100).toFixed(0)}%` },
          { label: "LTV D14", value: usd(ltv14), sub: `ROI ${((ltv14 / cpi) * 100).toFixed(0)}%` },
          { label: "LTV D30", value: usd(ltv30), sub: `ROI ${((ltv30 / cpi) * 100).toFixed(0)}%` },
          { label: "LTV D90", value: usd(ltv90), sub: `ROI ${((ltv90 / cpi) * 100).toFixed(0)}%` },
          {
            label: "Breakeven",
            value: breakevenDay ? `D${breakevenDay}` : "360일 초과",
            sub: breakevenDay ? `누적 LTV ≥ CPI ${usd(cpi)}` : "회수 불가",
            accent: breakevenDay ? (breakevenDay <= 30 ? "good" : breakevenDay <= 90 ? "warn" : "bad") : "bad",
          },
          {
            label: "D30 Total Rev",
            value: `$${Math.round(ltv30 * installs).toLocaleString()}`,
            sub: `${installs.toLocaleString()} installs`,
          },
        ].map(({ label, value, sub, accent }) => (
          <div key={label} className={`ltv-kpi-card ${accent || ""}`}>
            <div className="ltv-kpi-label">{label}</div>
            <div className="ltv-kpi-value">{value}</div>
            {sub && <div className="ltv-kpi-sub">{sub}</div>}
          </div>
        ))}
      </div>

      <div className="ltv-body">
        {/* Left: Inputs */}
        <div className="ltv-inputs card">
          <div className="ltv-reset-row">
            <button className="ltv-reset-btn" onClick={resetAll}>↺ 초기화</button>
          </div>

          <div className="ltv-section-block">
            <div className="ltv-section-title">
              📐 Retention Model
              <HelpTip text="Power-law 공식 D1 × day^k 로 일별 잔존율을 추정합니다. D1은 설치 첫날 잔존율, k는 감소 속도(음수일수록 빠른 감소)입니다." />
            </div>
            <SliderInput label="D1 Retention" value={d1} onChange={(v) => { setD1(v); setAppliedBm(null); }} min={0.05} max={0.8} step={0.01} display={pct} />
            <SliderInput
              label={<>Decay Factor (k) <HelpTip text="0에 가까울수록 잔존율이 완만하게 감소, -1.5에 가까울수록 급격히 떨어집니다. 하이브리드 캐주얼 기준 -0.6~-0.8이 일반적입니다." /></>}
              value={k} onChange={(v) => { setK(v); setAppliedBm(null); }}
              min={-1.5} max={-0.1} step={0.01}
              display={(v) => {
                const lbl = kLabel(v);
                return <>{v.toFixed(2)} <span style={{ fontSize: "10px", fontWeight: 700, color: lbl.color, background: lbl.color + "22", borderRadius: "4px", padding: "1px 5px" }}>{lbl.text}</span></>;
              }}
            />
            <div className="ltv-goal-check">
              {Object.entries(DAY_GOALS).map(([day, goal]) => {
                const sim = d1 * Math.pow(parseInt(day), k);
                const ok = Math.abs(sim - goal) / goal < 0.15;
                return (
                  <div key={day} className={`ltv-goal-row ${ok ? "ok" : "miss"}`}>
                    <span>D{day} Goal {pct(goal)}</span>
                    <span>Sim {pct(sim)} {ok ? "✓" : "✗"}</span>
                  </div>
                );
              })}
            </div>
            {appliedBm && (
              <div className="ltv-applied-bm">
                📊 <strong>{appliedBm.app}</strong> 기반 · D1 {(appliedBm.d1*100).toFixed(1)}% · k {appliedBm.k}{appliedBm.cumRpd ? ` · ARPDAU $${Number(appliedBm.cumRpd).toFixed(4)}` : ""}
                <button className="ltv-applied-bm-clear" onClick={() => setAppliedBm(null)} title="출처 표시 닫기">✕</button>
              </div>
            )}
          </div>

          <div className="ltv-section-block">
            <div className="ltv-section-title">
              💰 Revenue
              <HelpTip text="수익 파라미터를 설정합니다. ARPDAU는 일일 활성유저 1인당 평균 매출이며, IAP(인앱결제)와 IAA(광고수익)의 비중을 조절할 수 있습니다." />
            </div>
            <ArpdauInput value={arpdau} onChange={setArpdau} />
            <SliderInput label={<>IAP : IAA 비중 <span className="ltv-manual-badge">직접 조절</span> <HelpTip text="하이브리드 캐주얼 수익 구조. IAA(광고)는 초기 유저에서 주로 발생하고, IAP(인앱결제)는 장기 잔존 유저에서 발생합니다. 일반적으로 IAA 70~90%가 많습니다. 슬라이더로 게임의 실제 비중에 맞게 조절하세요." /></>} value={iapPct} onChange={setIapPct} min={0} max={1} step={0.1} display={ratio}>
              <div className="ltv-iap-bar">
                <div className="ltv-iap-fill iap" style={{ width: `${iapPct * 100}%` }}>
                  {iapPct >= 0.15 && <span>IAP {usd4(iapArpdau)}</span>}
                </div>
                <div className="ltv-iap-fill iaa" style={{ width: `${(1 - iapPct) * 100}%` }}>
                  {(1 - iapPct) >= 0.15 && <span>IAA {usd4(iaaArpdau)}</span>}
                </div>
              </div>
            </SliderInput>
            <SliderInput label={<>CPI <HelpTip text="유저 1명 획득에 드는 광고비(Cost Per Install). Breakeven은 누적 LTV가 이 값을 넘는 날로, D30 이내면 공격적 스케일업이 가능합니다." /></>} value={cpi} onChange={setCpi} min={0.1} max={5.0} step={0.05} display={usd} />
          </div>

          <div className="ltv-section-block">
            <div className="ltv-section-title">
              📦 Scale
              <HelpTip text="인스톨 수를 설정하면 D30 Total Rev에서 코호트 전체 예상 매출을 확인할 수 있습니다." />
            </div>
            <SliderInput label="Install Count" value={installs} onChange={setInstalls} min={1000} max={100000} step={1000} display={(v) => v.toLocaleString()} />
          </div>

          <div className="ltv-section-block">
            <div className="ltv-section-title">
              💾 Saved Scenarios
              <HelpTip text="현재 파라미터 세트를 이름 붙여 저장합니다. Google Sheets에 저장되어 팀원과 공유되며, 클릭하면 해당 세트를 불러옵니다." />
            </div>
            {!APPS_SCRIPT_URL ? (
              <div className="ltv-script-notice">
                Apps Script URL 설정 후 사용 가능해요.<br />
                <span style={{ color: "var(--muted)", fontSize: "11px" }}>.env → VITE_LTV_SCRIPT_URL</span>
              </div>
            ) : saving ? (
              <div className="ltv-save-row">
                <input className="ltv-save-input" placeholder="시나리오 이름 입력..." value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") savePreset(); if (e.key === "Escape") setSaving(false); }}
                  autoFocus />
                <button className="ltv-save-btn confirm" onClick={savePreset} disabled={presetLoading}>저장</button>
                <button className="ltv-save-btn cancel" onClick={() => { setSaving(false); setSaveName(""); }}>✕</button>
              </div>
            ) : (
              <button className="ltv-add-btn" onClick={() => setSaving(true)} disabled={presetLoading}>
                {presetLoading ? "⏳ 처리 중..." : "+ 현재 세트 저장"}
              </button>
            )}
            {presetError && <div style={{ fontSize: "11px", color: "var(--bad)", marginTop: "6px" }}>{presetError}</div>}
            {APPS_SCRIPT_URL && presets.length > 0 && (
              <div className="ltv-preset-list">
                {presets.map((p) => (
                  <div key={p.id} className="ltv-preset-item">
                    <button className="ltv-preset-load" onClick={() => loadPreset(p)} title="불러오기">
                      <span className="ltv-preset-name">{p.name}</span>
                      <span className="ltv-preset-meta">D1 {(Number(p.d1)*100).toFixed(0)}% · ARPDAU ${Number(p.arpdau).toFixed(3)} · CPI ${Number(p.cpi).toFixed(2)}</span>
                    </button>
                    <button className="ltv-preset-delete" onClick={() => deletePreset(p.id)} title="삭제">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="ltv-section-block">
            <div className="ltv-section-title">
              📊 Benchmark
              <HelpTip text="AppMagic CSV를 업로드하면 앱별 데이터를 Google Sheets에 누적 저장합니다. 앱을 선택하면 D1·k·ARPDAU·CPI가 자동 입력됩니다." />
            </div>
            {!APPS_SCRIPT_URL ? (
              <div className="ltv-script-notice">Apps Script URL 설정 후 사용 가능합니다.</div>
            ) : (
              <>
                <div className="ltv-bm-guide">
                  앱매직 앱 비교 대시보드 → 컬럼 설정에서 아래 순서로 지정 후 CSV 내보내기
                  <span className="ltv-bm-guide-cols">1일 차 잔존율 · 7일 차 잔존율 · 14일 차 잔존율 · 누적 RpD · 광고비 · 다운로드 수</span>
                </div>
                <div className="ltv-bm-upload-row">
                  <button className="ltv-bm-upload-btn" onClick={() => fileInputRef.current?.click()} disabled={bmUploading}>
                    {bmUploading ? "⏳ 저장 중..." : "📂 CSV 업로드"}
                  </button>
                  <input ref={fileInputRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleCSVUpload} />
                  {bmMsg && <span className="ltv-bm-msg">{bmMsg}</span>}
                </div>
                {benchmarks.length > 0 && (
                  <>
                    <select className="ltv-bm-select" value={bmGenre} onChange={e => setBmGenre(e.target.value)}>
                      {bmGenres.map(g => <option key={g}>{g}</option>)}
                    </select>
                    <div className="ltv-bm-list">
                      {bmLoading && <div className="ltv-bm-empty">불러오는 중...</div>}
                      {!bmLoading && filteredBm.length === 0 && <div className="ltv-bm-empty">해당 장르 없음</div>}
                      {filteredBm.map((bm, i) => (
                        <button key={i} className="ltv-bm-item" onClick={() => applyBenchmark(bm)} title="클릭하면 파라미터 자동 입력">
                          <span className="ltv-bm-name">{bm.app}</span>
                          <span className="ltv-bm-meta">D1 {bm.d1 ? (bm.d1*100).toFixed(1) : "–"}% · k {bm.k ?? "–"} · ARPDAU {bm.cumRpd ? "$" + Number(bm.cumRpd).toFixed(4) : "–"} · {bm.months}개월</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {benchmarks.length === 0 && !bmLoading && (
                  <div className="ltv-bm-empty">CSV를 업로드하면 여기에 앱 목록이 쌓입니다.</div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right: Charts */}
        <div className="ltv-charts">
          <div className="card ltv-chart-card">
            <div className="ltv-chart-title">Retention Curve (D1~D30)</div>
            <div style={{ height: 220 }}>
              <Line data={retChartData} options={chartOpts("Retention (%)", (v) => v + "%")} />
            </div>
          </div>
          <div className="card ltv-chart-card">
            <div className="ltv-chart-title">Cumulative LTV vs CPI</div>
            <div style={{ height: 220 }}>
              <Line data={ltvChartData} options={chartOpts("LTV per User ($)", (v) => "$" + v)} />
            </div>
          </div>

          {/* Monthly table */}
          <div className="card">
            <div className="ltv-chart-title">Monthly Breakdown</div>
            <div style={{ overflowX: "auto" }}>
              <table className="ltv-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Days</th>
                    <th>Avg Ret.</th>
                    <th>IAP Rev</th>
                    <th>IAA Rev</th>
                    <th>Cum LTV</th>
                    <th>ROI</th>
                    <th>Total Rev</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((m, i) => {
                    const roi = (m.cumLtv / cpi) * 100;
                    const roiOk = roi >= 100;
                    return (
                      <tr key={m.label}>
                        <td style={{ fontWeight: 600 }}>{m.label}</td>
                        <td style={{ color: "var(--muted)" }}>D{i * 30 + 1}~{(i + 1) * 30}</td>
                        <td>{pct(m.avgRet)}</td>
                        <td style={{ color: "#8b5cf6" }}>{usd4(m.cumIap)}</td>
                        <td style={{ color: "#d97706" }}>{usd4(m.cumIaa)}</td>
                        <td style={{ fontWeight: 600 }}>{usd(m.cumLtv)}</td>
                        <td style={{ color: roiOk ? "var(--good)" : "var(--bad)", fontWeight: 600 }}>
                          {roi.toFixed(0)}%
                        </td>
                        <td>{`$${(m.cumLtv * installs).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
