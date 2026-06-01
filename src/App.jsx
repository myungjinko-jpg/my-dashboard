import { useEffect, useMemo, useState } from "react";
import LoadingScreen from "./components/LoadingScreen";
import KpiGrid from "./components/KpiGrid";
import ChartSection from "./components/ChartSection";
import IterationTable from "./components/IterationTable";
import DailyTable from "./components/DailyTable";
import {
  hasValue, hasAnyMetricData, parseDateValue, formatDisplayDate, formatCurrency, formatPercent,
  getInstallsMeta, getInstallsGa, getIterationOrder, getIterationMeta,
  getWeightedCpi, getWeightedRetention, getWeightedD0Playtime, getWeightedD1Playtime,
  deltaText,
} from "./utils";

const SHEET_ID = "1pBJWVce2CgrPBlFMGbS2yCp6tBQnNn4gkEHz7jG3LZk";
const SHEET_NAME = "sheet1";
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
        setProject(clean[0].Project);
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
  const previousSummary = currentIndex > 0 ? iterationSummary[currentIndex - 1] : null;

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

  const bestCpiProject = [...latestIterationSummaryByProject].filter((i) => i.avgCpi > 0).sort((a, b) => a.avgCpi - b.avgCpi)[0];
  const bestD1Project = [...latestIterationSummaryByProject].filter((i) => i.avgD1 >= 0).sort((a, b) => b.avgD1 - a.avgD1)[0];
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

  const sortedProjects = [...projects].sort((a, b) => {
    const isDropA = a.startsWith("(Drop)");
    const isDropB = b.startsWith("(Drop)");
    if (isDropA && !isDropB) return 1;
    if (!isDropA && isDropB) return -1;
    return a.localeCompare(b);
  });

  if (loading) return <LoadingScreen msgIndex={msgIndex} dots={dots} />;

  return (
    <div className="wrap">
      <div className="topbar">
        <h1 className="dashboard-title" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span>CPI Test Dashboard</span>
          <span style={{ fontSize: "14px", fontWeight: 500, color: "#6b7280", padding: "2px 8px", border: "1px solid #e5e7eb", borderRadius: "999px", backgroundColor: "#f9fafb" }}>
            v3.1.0
          </span>
        </h1>
        <div className="topbar-right">
          <div className="theme-toggle">
            <button className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")}>Light</button>
            <button className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")}>Dark</button>
          </div>
          <a className="raw-link" href="https://docs.google.com/spreadsheets/d/1pBJWVce2CgrPBlFMGbS2yCp6tBQnNn4gkEHz7jG3LZk/edit?gid=0#gid=0" target="_blank" rel="noopener noreferrer">
            Flick Project Dashboard_Raw Data
          </a>
        </div>
      </div>

      {error && <div className="error-box">데이터 로드 실패: {error}</div>}

      <section className="section-block">
        <div className="section-header">
          <div className="section-eyebrow">Portfolio</div>
          <h2 className="section-heading">All Projects</h2>
          <p className="section-desc">A summary view of all currently tracked projects.</p>
        </div>
        <div className="overview-grid">
          <div className="overview-item">
            <div className="overview-label">Projects</div>
            <div className="overview-value">{overviewProjects || "-"}</div>
          </div>
          <div className="overview-item">
            <div className="overview-label">Downloads (Meta)</div>
            <div className="overview-value">{overviewTotalDownloads || "-"}</div>
          </div>
          <div className="overview-item">
            <div className="overview-label">Best CPI</div>
            <div className="overview-value">
              {bestCpiProject ? (
                <>
                  <div className="overview-value small">{bestCpiProject.project} <span className="overview-meta">{bestCpiProject.iteration}</span></div>
                  <div>{formatCurrency(bestCpiProject.avgCpi)}</div>
                </>
              ) : "No data"}
            </div>
          </div>
          <div className="overview-item">
            <div className="overview-label">Best D1</div>
            <div className="overview-value">
              {bestD1Project ? (
                <>
                  <div className="overview-value small">{bestD1Project.project} <span className="overview-meta">{bestD1Project.iteration}</span></div>
                  <div>{formatPercent(bestD1Project.avgD1)}</div>
                </>
              ) : "No data"}
            </div>
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="section-header">
          <div className="section-eyebrow">Project Detail</div>
          <h2 className="section-heading">Project Analysis</h2>
          <p className="section-desc">Detailed analysis comparing performance and trends across iterations.</p>
        </div>
        <div className="section-shell">
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
            <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: "1px solid #e5e7eb", display: "flex", flexDirection: "column", gap: "6px", fontSize: "14px", color: "#6b7280" }}>
              <div><span style={{ fontWeight: 600, color: "#111827", marginRight: "6px" }}>Status:</span>{currentMeta.status}</div>
              <div><span style={{ fontWeight: 600, color: "#111827", marginRight: "6px" }}>Date Range:</span>{formatDisplayDate(currentMeta.startDate)} ~ {formatDisplayDate(currentMeta.endDate)}</div>
            </div>
          </div>

          <KpiGrid currentSummary={currentSummary} previousSummary={previousSummary} />
          <ChartSection chartCurrentRows={chartCurrentRows} previousRows={previousRows} />
          <IterationTable iterationSummary={iterationSummary} />
          <DailyTable dailyRowsWithChange={dailyRowsWithChange} />
        </div>
      </section>
    </div>
  );
}
