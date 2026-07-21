import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Activity, DollarSign, Layers, Bookmark, Database, SlidersHorizontal } from "lucide-react";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler } from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const endLabelPlugin = {
  id: "endLabel",
  afterDatasetsDraw(chart) {
    const { ctx, chartArea: { right } } = chart;
    chart.data.datasets.forEach((ds, i) => {
      const meta = chart.getDatasetMeta(i);
      if (meta.hidden) return;
      const pts = meta.data.filter(Boolean);
      if (!pts.length) return;
      const last = pts[pts.length - 1];
      const x = last.x, y = last.y;
      ctx.save();
      ctx.font = "600 10px system-ui, sans-serif";
      ctx.fillStyle = ds.borderColor;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(ds.label, x + 6, y);
      ctx.restore();
    });
  },
};
ChartJS.register(endLabelPlugin);

// Apps Script 배포 후 URL을 여기에 입력
const APPS_SCRIPT_URL = import.meta.env.VITE_LTV_SCRIPT_URL || "";

const MONTH_LABELS = ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9", "M10", "M11", "M12"];
const DAY_GOALS = { 1: 0.4, 7: 0.17, 14: 0.07, 30: 0.025 };

function pct(v) { return (v * 100).toFixed(1) + "%"; }
function usd(v) { return "$" + v.toFixed(2); }
function usd4(v) { return "$" + v.toFixed(2); }
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
          {text.split("\n").map((line, i) =>
            line === "---"
              ? <span key={i} className="ltv-helptip-sep" />
              : <span key={i} className="ltv-helptip-line">{line}</span>
          )}
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
        <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          ARPDAU
          <input
            type="number" min={0.01} max={50} step={0.01} value={parseFloat(value).toFixed(2)}
            onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) onChange(v); }}
            className="ltv-number-input"
          />
        </span>
        <span className="ltv-input-value">{usd4(value)}</span>
      </div>
      <input
        type="range" min={0.01} max={1.0} step={0.01} value={Math.min(value, 1.0)}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="ltv-slider"
      />
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

const DEFAULTS = { d1: 0.43, k: -0.8, arpdau: 0.5, iapPct: 0.5, cpi: 2.55 };

export default function LtvCalculator({ isDark }) {
  const [d1, setD1] = useState(DEFAULTS.d1);
  const [k, setK] = useState(DEFAULTS.k);
  const [arpdau, setArpdau] = useState(DEFAULTS.arpdau);
  const [iapPct, setIapPct] = useState(DEFAULTS.iapPct);
  const [cpi, setCpi] = useState(DEFAULTS.cpi);
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
  const [selectedBmIdx, setSelectedBmIdx] = useState("");
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
    setIapPct(DEFAULTS.iapPct); setCpi(DEFAULTS.cpi);
    setAppliedBm(null);
  };

  const bmGenres = ["전체", ...Array.from(new Set(benchmarks.map(b => b.genre).filter(Boolean)))];
  const filteredBm = bmGenre === "전체" ? benchmarks : benchmarks.filter(b => b.genre === bmGenre);

  const savePreset = async () => {
    const name = saveName.trim();
    if (!name || !APPS_SCRIPT_URL) return;
    setPresetLoading(true);
    try {
      const data = JSON.stringify({ name, d1, k, arpdau, iapPct, cpi });
      const res = await gasGet({ action: "save", data });
      if (res.ok) {
        const newPreset = { id: res.id, name, d1, k, arpdau, iapPct, cpi };
        setPresets(prev => [newPreset, ...prev]);
      }
    } catch { setPresetError("저장 실패"); }
    finally { setPresetLoading(false); setSaveName(""); setSaving(false); }
  };

  const loadPreset = (p) => {
    setD1(Number(p.d1)); setK(Number(p.k)); setArpdau(Number(p.arpdau));
    setIapPct(Number(p.iapPct)); setCpi(Number(p.cpi));
  };

  const deletePreset = async (id) => {
    if (!APPS_SCRIPT_URL) return;
    setPresets(prev => prev.filter(p => p.id != id));
    gasGet({ action: "delete", id }).catch(() => {});
  };

  const tickColor = isDark ? "#94a3b8" : "#9aa3b0";
  const gridColor = isDark ? "#1d2333" : "#eef0f4";
  const textColor = isDark ? "#c9d4e8" : "#374151";

  // Daily retention: ret(d) = d1 * d^k
  const retByDay = useMemo(() => {
    const arr = new Array(360);
    for (let d = 1; d <= 360; d++) arr[d - 1] = d1 * Math.pow(d, k);
    return arr;
  }, [d1, k]);

  // Cumulative LTV per user by day (total, IAP, IAA)
  // D0(설치일): 잔존 100% → 설치일 매출 = ARPDAU. 누적을 이 값으로 시작해 total[d]가 D0를 포함.
  //   total[0] = D0 + D1 매출 = "LTV D1"(D0 포함), ltv0(D0 단독) = arpdau
  const ltvByDay = useMemo(() => {
    const total = new Array(360);
    const iap = new Array(360);
    const iaa = new Array(360);
    let cumT = arpdau, cumIap = iapArpdau, cumIaa = iaaArpdau;
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
      // D0(설치일) 매출은 첫 달 증분에 포함 → 월별 증분 합이 누적 LTV와 일치
      if (m === 0) { sumRev += arpdau; sumIap += iapArpdau; sumIaa += iaaArpdau; }
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

  // Breakeven day — 누적 LTV가 CPI를 넘는 첫 날 (0 = D0 설치일에 이미 회수)
  const breakevenDay = useMemo(() => {
    if (arpdau >= cpi) return 0;
    for (let d = 0; d < 360; d++) {
      if (ltvByDay.total[d] >= cpi) return d + 1;
    }
    return null;
  }, [ltvByDay, cpi, arpdau]);

  // Retention chart (D1~D30 daily)
  const retChartData = useMemo(() => {
    const labels = Array.from({ length: 30 }, (_, i) => `D${i + 1}`);
    const goalPoints = Array.from({ length: 30 }, (_, i) => DAY_GOALS[i + 1] != null ? +(DAY_GOALS[i + 1] * 100).toFixed(2) : null);
    return {
      labels,
      datasets: [
        {
          label: "Retention",
          data: retByDay.slice(0, 30).map(v => +(v * 100).toFixed(2)),
          borderColor: "#818cf8",
          backgroundColor: (ctx) => {
            const chart = ctx.chart;
            const { chartArea } = chart;
            if (!chartArea) return "rgba(129,140,248,0)";
            const grad = chart.ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            grad.addColorStop(0, "rgba(129,140,248,0.18)");
            grad.addColorStop(1, "rgba(129,140,248,0)");
            return grad;
          },
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2.5,
        },
        {
          label: "Goal",
          data: goalPoints,
          borderColor: "transparent",
          backgroundColor: "transparent",
          pointRadius: goalPoints.map((v, i) => v !== null ? 4 : 0),
          pointStyle: "circle",
          pointBorderColor: goalPoints.map((v, i) => {
            if (v === null) return "transparent";
            const day = i + 1;
            const sim = d1 * Math.pow(day, k) * 100;
            return sim >= v * 0.85 ? "#22c55e" : "#fb7185";
          }),
          pointBorderWidth: 1.5,
          pointBackgroundColor: goalPoints.map((v, i) => {
            if (v === null) return "transparent";
            const day = i + 1;
            const sim = d1 * Math.pow(day, k) * 100;
            return sim >= v * 0.85 ? "rgba(34,197,94,0.15)" : "rgba(251,113,133,0.15)";
          }),
          showLine: false,
          spanGaps: false,
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
          label: "Total LTV",
          data: monthly.map(m => +m.cumLtv.toFixed(4)),
          borderColor: "#818cf8",
          backgroundColor: (ctx) => {
            const chart = ctx.chart;
            const { chartArea } = chart;
            if (!chartArea) return "rgba(129,140,248,0)";
            const grad = chart.ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            grad.addColorStop(0, "rgba(129,140,248,0.18)");
            grad.addColorStop(1, "rgba(129,140,248,0)");
            return grad;
          },
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2.5,
        },
        {
          label: `IAP (${Math.round(iapPct * 100)}%)`,
          data: monthly.map(m => +m.cumIap.toFixed(4)),
          borderColor: "#a5b4fc",
          backgroundColor: "transparent",
          borderDash: [4, 3],
          pointRadius: 0,
          borderWidth: 1.5,
          tension: 0.35,
        },
        {
          label: `IAA (${Math.round((1 - iapPct) * 100)}%)`,
          data: monthly.map(m => +m.cumIaa.toFixed(4)),
          borderColor: "#cbd5e1",
          backgroundColor: "transparent",
          borderDash: [4, 3],
          pointRadius: 0,
          borderWidth: 1.5,
          tension: 0.35,
        },
        {
          label: "CPI (회수 기준선)",
          data: cpiLine,
          borderColor: "#ef4444",
          backgroundColor: "transparent",
          pointRadius: 0,
          borderWidth: 2,
          borderDash: [6, 4],
        },
      ],
    };
  }, [monthly, cpi, iapPct]);

  const chartOpts = (yFmt) => ({
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { right: 52 } },
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#0e1117",
        titleColor: "#c9d4e8",
        bodyColor: "#64748b",
        borderColor: "#1d2333",
        borderWidth: 1,
        padding: 10,
        cornerRadius: 6,
      },
    },
    scales: {
      x: {
        ticks: { color: tickColor, font: { size: 11 }, maxTicksLimit: 8 },
        grid: { color: gridColor },
        border: { color: gridColor },
      },
      y: {
        ticks: { color: tickColor, font: { size: 11 }, callback: yFmt, maxTicksLimit: 5 },
        grid: { color: gridColor },
        border: { color: "transparent" },
      },
    },
  });

  const ltv0  = arpdau;              // D0(설치일) = 잔존 100% × ARPDAU
  const ltv1  = ltvByDay.total[0];
  const ltv7  = ltvByDay.total[6];
  const ltv14 = ltvByDay.total[13];
  const ltv30 = ltvByDay.total[29];
  const ltv90 = ltvByDay.total[89];

  // 수익성 판정 — D90 누적 LTV vs CPI 고정 기준
  const profitable = ltv90 >= cpi;
  const roas = cpi > 0 ? ltv90 / cpi : 0;
  const cpiGap = ltv90 - cpi;

  return (
    <div className="ltv-wrap">
      {/* 수익성 판정 히어로 — LTV(D90) > CPI 여야 수익 */}
      <div className={`ltv-verdict ${profitable ? "good" : "bad"}`}>
        <div className="ltv-verdict-main">
          <span className="ltv-verdict-icon">{profitable ? "✅" : "❌"}</span>
          <div>
            <div className="ltv-verdict-title">{profitable ? "수익 가능" : "수익 불가"}</div>
            <div className="ltv-verdict-formula">LTV D90 {usd(ltv90)} {profitable ? "≥" : "<"} CPI {usd(cpi)}</div>
          </div>
        </div>
        <div className="ltv-verdict-stats">
          <div><div className="ltv-verdict-stat-label">ROAS (LTV/CPI)</div><div className="ltv-verdict-stat-value">{roas.toFixed(2)}x</div></div>
          <div><div className="ltv-verdict-stat-label">CPI 대비</div><div className={`ltv-verdict-stat-value ${profitable ? "pos" : "neg"}`}>{cpiGap >= 0 ? "+" : "−"}{usd(Math.abs(cpiGap))}</div></div>
          <div><div className="ltv-verdict-stat-label">Breakeven</div><div className="ltv-verdict-stat-value">{breakevenDay === 0 ? "D0" : breakevenDay ? `D${breakevenDay}` : "회수 불가"}</div></div>
        </div>
      </div>

      {/* KPI Summary — CPI 회수율(LTV/CPI). CPI 돌파 시 초록 */}
      <div className="ltv-kpi-row">
        {[
          { label: "LTV D0", value: usd(ltv0),  ltv: ltv0,  isNew: true },
          { label: "LTV D1", value: usd(ltv1),  ltv: ltv1 },
          { label: "LTV D7", value: usd(ltv7),  ltv: ltv7 },
          { label: "LTV D14", value: usd(ltv14), ltv: ltv14 },
          { label: "LTV D30", value: usd(ltv30), ltv: ltv30 },
          { label: "LTV D90", value: usd(ltv90), ltv: ltv90 },
          {
            label: "Breakeven",
            value: breakevenDay === 0 ? "D0" : breakevenDay ? `D${breakevenDay}` : "360일 초과",
            sub: breakevenDay !== null ? `누적 LTV ≥ CPI ${usd(cpi)}` : "회수 불가",
            accent: breakevenDay === null ? "bad" : breakevenDay <= 30 ? "good" : breakevenDay <= 90 ? "warn" : "bad",
          },
        ].map(({ label, value, sub, ltv, accent, isNew }) => {
          const recovered = ltv != null && ltv >= cpi;
          const cardAccent = accent != null ? accent : (recovered ? "good" : "");
          return (
            <div key={label} className={`ltv-kpi-card ${cardAccent}`}>
              <div className="ltv-kpi-label">{label}{isNew && <span className="ltv-kpi-new"> NEW</span>}</div>
              <div className="ltv-kpi-value">{value}{recovered && <span className="ltv-kpi-check"> ✓</span>}</div>
              {sub != null
                ? <div className="ltv-kpi-sub">{sub}</div>
                : <div className="ltv-kpi-sub">CPI 회수 {((ltv / cpi) * 100).toFixed(0)}%</div>}
            </div>
          );
        })}
      </div>

      <div className="ltv-body">
        {/* Left: Inputs */}
        <div className="ltv-inputs card">

          {/* Benchmark */}
          <div className="ltv-section-block">
            <div className="ltv-section-title">
              <Database size={14} /> Benchmark
              <HelpTip text={"경쟁 앱의 실제 지표를 참고값으로 불러오는 기능입니다.\n---\n앱 선택 시 D1 · k · ARPDAU · CPI가 자동 입력됩니다.\n값은 참고용이며 슬라이더로 직접 조정할 수 있습니다."} />
            </div>
            {!APPS_SCRIPT_URL ? (
              <div className="ltv-script-notice">Apps Script URL 설정 후 사용 가능합니다.</div>
            ) : (
              <>

                <div className="ltv-bm-upload-row">
                  <button className="ltv-bm-upload-btn" onClick={() => fileInputRef.current?.click()} disabled={bmUploading}>
                    {bmUploading ? "⏳ 저장 중..." : "📂 CSV 업로드"}
                  </button>
                  <input ref={fileInputRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleCSVUpload} />
                  {bmMsg && <span className="ltv-bm-msg">{bmMsg}</span>}
                </div>
                <div className="ltv-bm-selects">
                  <div className="ltv-select-wrap">
                    <select className="ltv-select" value={bmGenre} onChange={e => setBmGenre(e.target.value)} disabled={bmLoading}>
                      {bmLoading ? <option>불러오는 중...</option> : bmGenres.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div className="ltv-select-wrap">
                    <select className="ltv-select" value={selectedBmIdx} disabled={bmLoading || filteredBm.length === 0} onChange={e => {
                      const idx = e.target.value;
                      const bm = filteredBm.find((_, i) => String(i) === idx);
                      if (bm) { applyBenchmark(bm); setSelectedBmIdx(idx); }
                    }}>
                      <option value="" disabled>
                        {bmLoading ? "불러오는 중..." : filteredBm.length === 0 ? "CSV를 업로드하면 목록이 쌓입니다" : "앱 선택..."}
                      </option>
                      {filteredBm.map((bm, i) => (
                        <option key={i} value={String(i)}>{bm.app}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}
            {appliedBm && (
              <div className="ltv-applied-bm">
                <div className="ltv-applied-bm-header">
                  <span className="ltv-applied-bm-name">{appliedBm.app}</span>
                  <button className="ltv-applied-bm-clear" onClick={() => { setAppliedBm(null); setSelectedBmIdx(""); }} title="선택 해제">✕</button>
                </div>
                <div className="ltv-applied-bm-stats">
                  <div className="ltv-applied-bm-stat">
                    <span className="ltv-applied-bm-stat-label">D1</span>
                    <span className="ltv-applied-bm-stat-value">{appliedBm.d1 ? (appliedBm.d1*100).toFixed(1) + "%" : "–"}</span>
                  </div>
                  <div className="ltv-applied-bm-stat">
                    <span className="ltv-applied-bm-stat-label">k</span>
                    <span className="ltv-applied-bm-stat-value">{appliedBm.k ?? "–"}</span>
                  </div>
                  <div className="ltv-applied-bm-stat">
                    <span className="ltv-applied-bm-stat-label">ARPDAU</span>
                    <span className="ltv-applied-bm-stat-value">{appliedBm.cumRpd ? `$${Number(appliedBm.cumRpd).toFixed(2)}` : "–"}</span>
                  </div>
                  <div className="ltv-applied-bm-stat">
                    <span className="ltv-applied-bm-stat-label">CPI</span>
                    <span className="ltv-applied-bm-stat-value">{appliedBm.cpi ? `$${Number(appliedBm.cpi).toFixed(2)}` : "–"}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="ltv-section-block">
            <div className="ltv-section-title">
              <Activity size={14} /> Retention Model
              <HelpTip text={"D1과 k를 입력하면 일별 잔존율 곡선을 자동 추정합니다.\n---\n벤치마크에서 앱을 선택하면 자동으로 채워집니다.\n직접 조정해 시나리오를 비교할 수 있습니다."} />
            </div>
            <SliderInput label="D1 Retention" value={d1} onChange={(v) => { setD1(v); setAppliedBm(null); }} min={0.05} max={0.8} step={0.01} display={pct} />
            <SliderInput
              label={<>Decay Factor (k) <HelpTip text={"잔존율이 시간에 따라 얼마나 빠르게 떨어지는지를 나타냅니다.\n---\n완만  (k ≥ -0.45)    유저가 오래 남는 구조\n보통  (-0.85 ~ -0.45)  하이브리드 캐주얼 일반적 범위\n급격  (k < -0.85)    초기에 빠르게 이탈"} /></>}
              value={k} onChange={(v) => { setK(v); setAppliedBm(null); }}
              min={-1.5} max={-0.1} step={0.01}
              display={(v) => {
                const lbl = kLabel(v);
                return <>{v.toFixed(2)} <span style={{ fontSize: "10px", fontWeight: 700, color: lbl.color, background: lbl.color + "22", borderRadius: "4px", padding: "1px 5px" }}>{lbl.text}</span></>;
              }}
            />
          </div>

          <div className="ltv-section-block">
            <div className="ltv-section-title">
              <DollarSign size={14} /> Revenue
              <HelpTip text={"수익 관련 파라미터를 설정합니다.\n---\nARPDAU  일일 활성 유저 1인당 평균 매출\nCPI        유저 1명 획득에 드는 광고비"} />
            </div>
            <ArpdauInput value={arpdau} onChange={setArpdau} />
            <SliderInput label={<>CPI <HelpTip text={"유저 1명을 획득하는 데 드는 광고비입니다.\n---\n이 값을 기준으로 Breakeven 일자가 계산됩니다."} /></>} value={cpi} onChange={setCpi} min={0.1} max={5.0} step={0.05} display={usd} />
          </div>

          <div className="ltv-section-block">
            <div className="ltv-section-title">
              <SlidersHorizontal size={14} /> Manual Inputs
            </div>
            <SliderInput label={<>IAP : IAA 비중 <span className="ltv-manual-badge">수동</span> <HelpTip text={"ARPDAU 중 인앱결제(IAP)와 광고수익(IAA)의 비율입니다.\n---\n벤치마크에서 자동 입력되지 않으므로 게임에 맞게 직접 조절하세요."} /></>} value={iapPct} onChange={setIapPct} min={0} max={1} step={0.1} display={ratio} />
          </div>

          <div className="ltv-section-block">
            <div className="ltv-section-title">
              <Bookmark size={14} /> Saved Scenarios
              <HelpTip text={"현재 파라미터 조합을 이름 붙여 저장하는 기능입니다.\n---\n구글 시트에 저장되어 팀원과 공유됩니다.\n저장된 항목을 클릭하면 즉시 적용됩니다."} />
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
                      <span className="ltv-preset-meta">D1 {(Number(p.d1)*100).toFixed(0)}% · ARPDAU ${Number(p.arpdau).toFixed(2)} · CPI ${Number(p.cpi).toFixed(2)}</span>
                    </button>
                    <button className="ltv-preset-delete" onClick={() => deletePreset(p.id)} title="삭제">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="ltv-reset-row">
            <button className="ltv-reset-btn" onClick={resetAll}>↺ 전체 초기화</button>
          </div>
        </div>

        {/* Right: Charts */}
        <div className="ltv-charts">
          <div className="ltv-charts-top">
          <div className="card ltv-chart-card">
            <div className="ltv-chart-title">Retention Curve (D1~D30)</div>
            <div style={{ height: 220 }}>
              <Line data={retChartData} options={chartOpts((v) => v + "%")} />
            </div>
            <div className="ltv-goal-bars">
              {Object.entries(DAY_GOALS).map(([day, goal]) => {
                const sim = d1 * Math.pow(parseInt(day), k);
                const ratio = Math.min(sim / goal, 2);
                const ok = sim >= goal * 0.85;
                const color = ok ? "#10b981" : "#f43f5e";
                return (
                  <div key={day} className="ltv-goal-bar-row">
                    <span className="ltv-goal-bar-label">D{day}</span>
                    <div className="ltv-goal-bar-track">
                      <div className="ltv-goal-bar-fill" style={{ width: `${Math.min(ratio * 50, 100)}%`, background: color }} />
                      <div className="ltv-goal-bar-marker" style={{ left: "50%" }} />
                    </div>
                    <span className="ltv-goal-bar-sim" style={{ color }}>{pct(sim)}</span>
                    <span className="ltv-goal-bar-goal">/ {pct(goal)}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="card ltv-chart-card">
            <div className="ltv-chart-title">Cumulative LTV vs CPI</div>
            <div style={{ height: 220 }}>
              <Line data={ltvChartData} options={chartOpts((v) => "$" + v)} />
            </div>
            <div className="ltv-iap-bar" style={{ marginTop: 16 }}>
              <div className="ltv-iap-fill iap" style={{ width: `${iapPct * 100}%` }}>
                {iapPct >= 0.15 && <span>IAP {usd4(iapArpdau)}</span>}
              </div>
              <div className="ltv-iap-fill iaa" style={{ width: `${(1 - iapPct) * 100}%` }}>
                {(1 - iapPct) >= 0.15 && <span>IAA {usd4(iaaArpdau)}</span>}
              </div>
            </div>
            <div className="ltv-chart-stats">
              {[
                { label: "D30 LTV", value: usd(ltv30) },
                { label: "CPI",     value: usd(cpi) },
                { label: "D30 ROI", value: `${((ltv30 / cpi) * 100).toFixed(0)}%`, color: ltv30 >= cpi ? "var(--good)" : "var(--bad)" },
                { label: "Breakeven", value: breakevenDay ? `D${breakevenDay}` : "360d+", color: breakevenDay ? (breakevenDay <= 90 ? "var(--good)" : "var(--warn)") : "var(--bad)" },
              ].map(({ label, value, color }) => (
                <div key={label} className="ltv-chart-stat">
                  <span className="ltv-chart-stat-label">{label}</span>
                  <span className="ltv-chart-stat-value" style={color ? { color } : {}}>{value}</span>
                </div>
              ))}
            </div>
          </div>
          </div>{/* ltv-charts-top */}

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
                        <td>{usd4(m.cumIap)}</td>
                        <td>{usd4(m.cumIaa)}</td>
                        <td style={{ fontWeight: 600 }}>{usd(m.cumLtv)}</td>
                        <td style={{ color: roiOk ? "var(--good)" : "var(--bad)", fontWeight: 600 }}>
                          {roi.toFixed(0)}%
                        </td>
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
