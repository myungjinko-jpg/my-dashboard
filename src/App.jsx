import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import LoadingScreen from "./components/LoadingScreen";
import slackLogo from "./assets/toppng.com-slack-new-logo-icon-1600x1600.png";
import sheetLogo from "./assets/googlesheet icon.png";
import KpiGrid from "./components/KpiGrid";
import ChartSection from "./components/ChartSection";
import IterationTable from "./components/IterationTable";
import DailyTable from "./components/DailyTable";
import {
  hasValue, hasAnyMetricData, parseDateValue, formatDisplayDate, formatCurrency, formatPercent,
  formatNumber, getInstallsMeta, getInstallsGa, getIterationOrder, getIterationMeta,
  getWeightedCpi, getWeightedRetention, getWeightedD0Playtime, getWeightedD1Playtime,
  deltaText,
} from "./utils";
import LtvCalculator from "./components/LtvCalculator";

const SHEET_ID = "1pBJWVce2CgrPBlFMGbS2yCp6tBQnNn4gkEHz7jG3LZk";
const SHEET_NAME = "Test_Raw%20Data";
const API_URL = `https://opensheet.elk.sh/${SHEET_ID}/${SHEET_NAME}`;

export default function App() {
  const [rawData, setRawData] = useState([]);
  const [project, setProject] = useState("");
  const [iteration, setIteration] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [msgIndex, setMsgIndex] = useState(() => Math.floor(Math.random() * 16));
  const [dots, setDots] = useState(".");
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");
  const [copying, setCopying] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [sharingConfirm, setSharingConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState("cpi");
  const reportRef = useRef(null);

  useEffect(() => {
    document.body.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex((prev) => {
        const next = Math.floor(Math.random() * 16);
        return next === prev ? (next + 1) % 16 : next;
      });
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "." : prev + "."));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const startTime = Date.now();
    fetch(API_URL)
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then((res) => {
        if (!Array.isArray(res)) throw new Error("응답이 배열이 아님");
        const clean = res.filter((r) => hasValue(r.Project) && hasValue(r.Iteration) && hasValue(r.Date));
        if (!clean.length) throw new Error("유효한 데이터 없음");
        setRawData(clean);

        // Live 중인 프로젝트 우선 선택
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const projectLatestDate = {};
        clean.forEach((r) => {
          const ts = parseDateValue(r.Date);
          if (!projectLatestDate[r.Project] || ts > projectLatestDate[r.Project]) {
            projectLatestDate[r.Project] = ts;
          }
        });

        // 마지막 날짜가 (오늘-2일) 이후인 프로젝트를 Live로 간주
        const twoDaysAgo = new Date(today);
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

        const liveProject = Object.entries(projectLatestDate).find(([, ts]) => {
          const d = new Date(ts);
          d.setHours(0, 0, 0, 0);
          return d >= twoDaysAgo;
        });

        setProject(liveProject ? liveProject[0] : clean[0].Project);
      })
      .catch((err) => { console.error(err); setError(err.message); })
      .finally(() => {
        const elapsed = Date.now() - startTime;
        setTimeout(() => setLoading(false), Math.max(0, 3000 - elapsed));
      });
  }, []);

  const projects = useMemo(() => (
    [...new Set(rawData.map((d) => d.Project).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)))
  ), [rawData]);

  const projectRows = useMemo(() => rawData.filter((d) => d.Project === project), [rawData, project]);

  const iterations = useMemo(() => {
    const latestDatePerIteration = {};
    projectRows.forEach((row) => {
      if (!row.Iteration || !row.Date) return;
      const date = new Date(row.Date);
      if (!latestDatePerIteration[row.Iteration] || date > latestDatePerIteration[row.Iteration])
        latestDatePerIteration[row.Iteration] = date;
    });
    return Object.keys(latestDatePerIteration).sort((a, b) => latestDatePerIteration[b] - latestDatePerIteration[a]);
  }, [projectRows]);

  useEffect(() => { if (iterations.length) setIteration(iterations[0]); }, [iterations]);

  const currentRows = useMemo(() => projectRows.filter((d) => d.Iteration === iteration), [projectRows, iteration]);
  const metricRows = useMemo(() => currentRows.filter(hasAnyMetricData), [currentRows]);
  const currentMeta = useMemo(() => getIterationMeta(currentRows), [currentRows]);

  const iterationSummary = useMemo(() => {
    const grouped = {};
    projectRows.forEach((row) => {
      if (!hasAnyMetricData(row)) return;
      if (!grouped[row.Iteration]) grouped[row.Iteration] = [];
      grouped[row.Iteration].push(row);
    });
    return Object.entries(grouped).map(([it, items]) => ({
      iteration: it,
      latestDate: Math.max(...items.map((item) => parseDateValue(item.Date))),
      avgCpi: getWeightedCpi(items),
      avgD1: getWeightedRetention(items),
      totalInstallsMeta: items.reduce((sum, item) => sum + getInstallsMeta(item), 0),
      totalInstallsGa: items.reduce((sum, item) => sum + getInstallsGa(item), 0),
      avgD0Pt: getWeightedD0Playtime(items),
      avgD1Pt: getWeightedD1Playtime(items),
    })).sort((a, b) => b.latestDate - a.latestDate);
  }, [projectRows]);

  const currentIndex = iterationSummary.findIndex((item) => item.iteration === iteration);
  const currentSummary = iterationSummary[currentIndex];
  // 내림차순 정렬이므로 이전(과거) iteration은 index + 1
  const previousSummary = currentIndex < iterationSummary.length - 1 ? iterationSummary[currentIndex + 1] : null;

  const latestIterationSummaryByProject = useMemo(() => {
    const grouped = {};
    rawData.forEach((row) => {
      if (!hasAnyMetricData(row)) return;
      if (!grouped[row.Project]) grouped[row.Project] = {};
      if (!grouped[row.Project][row.Iteration]) grouped[row.Project][row.Iteration] = [];
      grouped[row.Project][row.Iteration].push(row);
    });
    return Object.entries(grouped).map(([projectName, iterationMap]) => {
      const latestIteration = Object.keys(iterationMap).sort((a, b) => getIterationOrder(b) - getIterationOrder(a))[0];
      const items = iterationMap[latestIteration] || [];
      return { project: projectName, iteration: latestIteration, avgCpi: getWeightedCpi(items), avgD1: getWeightedRetention(items) };
    }).filter((item) => item.iteration);
  }, [rawData]);

  const bestCpiProject = [...latestIterationSummaryByProject].filter((i) => i.avgCpi > 0 && !i.project.startsWith("(Drop)")).sort((a, b) => a.avgCpi - b.avgCpi)[0];
  const bestD1Project = [...latestIterationSummaryByProject].filter((i) => i.avgD1 >= 0 && !i.project.startsWith("(Drop)")).sort((a, b) => b.avgD1 - a.avgD1)[0];
  const overviewProjects = new Set(rawData.map((row) => row.Project).filter(Boolean)).size;
  const overviewTotalDownloads = rawData.reduce((sum, row) => sum + getInstallsMeta(row), 0);

  const chartCurrentRows = useMemo(() => (
    [...metricRows].sort((a, b) => parseDateValue(a.Date) - parseDateValue(b.Date))
  ), [metricRows]);

  const dailyRowsWithChange = useMemo(() => {
    const ascRows = [...metricRows].sort((a, b) => parseDateValue(a.Date) - parseDateValue(b.Date));
    return ascRows.map((row, index) => {
      const prev = index > 0 ? ascRows[index - 1] : null;
      return {
        ...row,
        dailyDelta: {
          cpi: prev ? deltaText(row.CPI, prev.CPI, true, "currency") : null,
          d1: prev ? deltaText(row["D1 Retention"], prev["D1 Retention"], false, "percent") : null,
          d0Pt: prev ? deltaText(row["D0 Playtime"], prev["D0 Playtime"], false, "seconds") : null,
          d1Pt: prev ? deltaText(row["D1 Playtime"], prev["D1 Playtime"], false, "seconds") : null,
        },
      };
    });
  }, [metricRows]);

  const previousRows = useMemo(() => {
    if (!previousSummary) return [];
    return projectRows
      .filter((row) => row.Iteration === previousSummary.iteration && hasAnyMetricData(row))
      .sort((a, b) => parseDateValue(a.Date) - parseDateValue(b.Date));
  }, [projectRows, previousSummary]);

  const getProjectTier = (name) => {
    if (name.startsWith("(Drop)")) return 2;
    if (name.startsWith("[Challenge]")) return 1;
    return 0;
  };

  const sortedProjects = [...projects].sort((a, b) => {
    const tierDiff = getProjectTier(a) - getProjectTier(b);
    if (tierDiff !== 0) return tierDiff;
    return a.localeCompare(b);
  });

  const shareStatus = async () => {
    setSharingConfirm(false);
    setSharing(true);
    try {
      const res = await fetch("/api/status", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setSharing("done");
        setTimeout(() => setSharing(false), 2000);
      } else {
        setSharing(false);
        alert(data.message || "오류가 발생했습니다.");
      }
    } catch (e) {
      console.error(e);
      setSharing(false);
    }
  };

  const copyReport = async () => {
    if (!reportRef.current) return;
    setCopying(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: theme === "dark" ? "#0f1623" : "#f6f7fb",
      });
      canvas.toBlob(async (blob) => {
        try {
          await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
          setCopying("done");
          setTimeout(() => setCopying(false), 2000);
        } catch {
          // 클립보드 API 미지원 시 다운로드로 대체
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${project}_${iteration}_report.png`;
          a.click();
          URL.revokeObjectURL(url);
          setCopying(false);
        }
      }, "image/png");
    } catch (e) {
      console.error(e);
      setCopying(false);
    }
  };

  if (loading) return <LoadingScreen msgIndex={msgIndex} dots={dots} />;

  return (
    <div className="wrap">
      <div className="topbar">
        <h1 className="dashboard-title" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span>Flick Toolbox</span>
          <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--muted)", padding: "2px 8px", border: "1px solid var(--line)", borderRadius: "999px", backgroundColor: "var(--card)" }}>
            v4.0.0
          </span>
        </h1>
        <div className="topbar-right">
          <div className="theme-toggle">
            <button className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")}>Light</button>
            <button className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")}>Dark</button>
          </div>
        </div>
      </div>

      <div className="tab-nav">
        <button className={`tab-btn ${activeTab === "cpi" ? "active" : ""}`} onClick={() => setActiveTab("cpi")}>
          📊 CPI Dashboard
        </button>
        <button className={`tab-btn ${activeTab === "ltv" ? "active" : ""}`} onClick={() => setActiveTab("ltv")}>
          💡 LTV Calculator
        </button>
      </div>

      {error && <div className="error-box">데이터 로드 실패: {error}</div>}

      {activeTab === "ltv" && (
        <section className="section-block">
          <div className="section-header">
            <div className="section-eyebrow">Monetization</div>
            <h2 className="section-heading">LTV Calculator</h2>
            <p className="section-desc">Power-law retention 모델 기반 LTV 시뮬레이터. 파라미터를 조정해 수익성을 예측하세요.</p>
          </div>
          <LtvCalculator isDark={theme === "dark"} />
        </section>
      )}

      {activeTab === "cpi" && (<><section className="section-block">
        <div className="section-header">
          <div className="section-eyebrow">Portfolio</div>
          <h2 className="section-heading">All Projects</h2>
          <p className="section-desc">A summary view of all currently tracked projects.</p>
        </div>
        <div className="overview-grid">
          <div className="overview-item accent-indigo">
            <div className="overview-label">🗂 Projects</div>
            <div className="overview-value">{overviewProjects || "-"}</div>
          </div>
          <div className="overview-item accent-sky">
            <div className="overview-label">📥 Downloads (Meta)</div>
            <div className="overview-value">{overviewTotalDownloads ? formatNumber(overviewTotalDownloads) : "-"}</div>
          </div>
          <div className="overview-item accent-green">
            <div className="overview-label">💰 Best CPI</div>
            <div className="overview-value">{bestCpiProject ? formatCurrency(bestCpiProject.avgCpi) : "No data"}</div>
            {bestCpiProject && (
              <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "6px", fontWeight: 600 }}>
                {bestCpiProject.project} <span style={{ color: "var(--primary)" }}>{bestCpiProject.iteration}</span>
              </div>
            )}
          </div>
          <div className="overview-item accent-violet">
            <div className="overview-label">🔁 Best D1</div>
            <div className="overview-value">{bestD1Project ? formatPercent(bestD1Project.avgD1) : "No data"}</div>
            {bestD1Project && (
              <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "6px", fontWeight: 600 }}>
                {bestD1Project.project} <span style={{ color: "var(--primary)" }}>{bestD1Project.iteration}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="section-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <div className="section-eyebrow">Project Detail</div>
            <h2 className="section-heading">Project Analysis</h2>
            <p className="section-desc">Detailed analysis comparing performance and trends across iterations.</p>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <a
              href="https://docs.google.com/spreadsheets/d/1pBJWVce2CgrPBlFMGbS2yCp6tBQnNn4gkEHz7jG3LZk/edit?gid=0#gid=0"
              target="_blank" rel="noopener noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", gap: "6px",
                padding: "8px 14px", borderRadius: "999px", border: "1px solid var(--card-border)",
                background: "var(--card)", color: "var(--text)", textDecoration: "none",
                fontSize: "13px", fontWeight: 600, whiteSpace: "nowrap",
              }}
            >
              <img src={sheetLogo} alt="Sheets" style={{ width: 15, height: 15 }} />
              Data Update
            </a>
            {sharingConfirm ? (
              <div style={{
                display: "inline-flex", alignItems: "center", gap: "8px",
                padding: "8px 14px", borderRadius: "999px", border: "1px solid #6366f1",
                background: "var(--card)", fontSize: "13px", fontWeight: 600, whiteSpace: "nowrap",
              }}>
                <span style={{ color: "var(--muted)" }}>업데이트 현황을 Slack에 전송할까요?</span>
                <button onClick={shareStatus} style={{ border: "none", background: "#6366f1", color: "#fff", borderRadius: "6px", padding: "3px 10px", fontWeight: 700, cursor: "pointer", fontSize: "12px" }}>Yes</button>
                <button onClick={() => setSharingConfirm(false)} style={{ border: "none", background: "transparent", color: "var(--muted)", borderRadius: "6px", padding: "3px 8px", fontWeight: 700, cursor: "pointer", fontSize: "12px" }}>No</button>
              </div>
            ) : (
              <button
                onClick={() => setSharingConfirm(true)}
                disabled={sharing === true}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "6px",
                  padding: "8px 14px", borderRadius: "999px", border: "1px solid var(--card-border)",
                  background: sharing === "done" ? "#10b981" : "var(--card)",
                  color: sharing === "done" ? "#fff" : "var(--text)",
                  fontSize: "13px", fontWeight: 600, cursor: sharing === true ? "wait" : "pointer",
                  transition: "all 0.2s", whiteSpace: "nowrap",
                }}
              >
                {sharing === true ? "⏳ Sending..." : sharing === "done" ? "✅ Sent!" : <><img src={slackLogo} alt="Slack" style={{ width: 15, height: 15 }} /> Slack Update</>}
              </button>
            )}
            <button
              onClick={copyReport}
              disabled={copying === true}
              style={{
                display: "inline-flex", alignItems: "center", gap: "6px",
                padding: "8px 14px", borderRadius: "999px", border: "1px solid var(--card-border)",
                background: copying === "done" ? "#10b981" : "var(--card)",
                color: copying === "done" ? "#fff" : "var(--text)",
                fontSize: "13px", fontWeight: 600, cursor: copying === true ? "wait" : "pointer",
                transition: "all 0.2s", whiteSpace: "nowrap",
              }}
            >
              {copying === true ? "⏳ 캡쳐 중..." : copying === "done" ? "✅ 복사됨!" : "📋 Copy Report"}
            </button>
          </div>
        </div>
        <div className="section-shell" ref={reportRef}>
          <div className="card">
            <div className="filter-row">
              <div className="filter-group">
                <div className="filter-label">Project</div>
                <select id="projectSelector" value={project} onChange={(e) => setProject(e.target.value)}>
                  {sortedProjects.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="filter-group">
                <div className="filter-label">Iteration</div>
                <select id="iterationSelector" value={iteration} onChange={(e) => setIteration(e.target.value)}>
                  {iterations.map((it) => <option key={it} value={it}>{it}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: "8px", fontSize: "14px", color: "var(--muted)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontWeight: 600, color: "var(--text)" }}>Status:</span>
                <span className={`status-badge ${currentMeta.status === "Live" ? "live" : "ended"}`}>
                  {currentMeta.status === "Live" ? "● Live" : currentMeta.status}
                </span>
              </div>
              <div><span style={{ fontWeight: 600, color: "var(--text)", marginRight: "6px" }}>Date Range:</span>{formatDisplayDate(currentMeta.startDate)} ~ {formatDisplayDate(currentMeta.endDate)}</div>
            </div>
          </div>

          <KpiGrid currentSummary={currentSummary} previousSummary={previousSummary} />
          <ChartSection chartCurrentRows={chartCurrentRows} previousRows={previousRows} isDark={theme === "dark"} />
          <IterationTable iterationSummary={iterationSummary} currentIteration={iteration} />
          <DailyTable dailyRowsWithChange={dailyRowsWithChange} />
        </div>
      </section></>)}
    </div>
  );
}
