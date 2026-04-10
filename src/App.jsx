import { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
);

const SHEET_ID = "1pBJWVce2CgrPBlFMGbS2yCp6tBQnNn4gkEHz7jG3LZk";
const SHEET_NAME = "sheet1";
const API_URL = `https://opensheet.elk.sh/${SHEET_ID}/${SHEET_NAME}`;

function toNumber(value) {
  return Number(String(value || 0).replace(/[^0-9.]/g, "")) || 0;
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function averageBy(items, key) {
  const valid = items.filter((item) => hasValue(item[key]) && toNumber(item[key]) > 0);
  if (!valid.length) return 0;
  return valid.reduce((sum, item) => sum + toNumber(item[key]), 0) / valid.length;
}

function formatCurrency(value) {
  const num = toNumber(value);
  if (!num) return "No data";
  return `$${num.toFixed(2)}`;
}

function formatPercent(value) {
  const num = toNumber(value);
  if (!num) return "No data";
  return `${num.toFixed(2)}%`;
}

function formatSeconds(value) {
  const num = toNumber(value);
  if (!num) return "No data";
  return `${Math.round(num)} sec`;
}

function getIterationOrder(value) {
  const parsed = Number(String(value || "").replace("#", ""));
  return Number.isNaN(parsed) ? 9999 : parsed;
}

function getInstallsMeta(row) {
  return toNumber(row["Installs (Meta)"]);
}

function getInstallsGa(row) {
  return toNumber(row["Installs (GA)"]);
}

function deltaText(current, previous, inverse = false, formatter = "number") {
  const currentValue = toNumber(current);
  const previousValue = toNumber(previous);

  if (!Number.isFinite(previousValue) || previousValue === 0) {
    return { text: "-", cls: "delta-flat" };
  }

  const diff = currentValue - previousValue;
  if (Math.abs(diff) < 0.0001) {
    return { text: "→ 0", cls: "delta-flat" };
  }

  const improved = inverse ? diff < 0 : diff > 0;
  const arrow = diff > 0 ? "▲" : "▼";
  const cls = improved ? "delta-up" : "delta-down";

  let value = Math.abs(diff).toFixed(2);
  if (formatter === "currency") value = `$${Math.abs(diff).toFixed(2)}`;
  if (formatter === "percent") value = `${Math.abs(diff).toFixed(2)}%`;
  if (formatter === "seconds") value = `${Math.round(Math.abs(diff))} sec`;
  if (formatter === "number") value = `${Math.round(Math.abs(diff))}`;

  return { text: `${arrow} ${value}`, cls };
}

export default function App() {
  const [rawData, setRawData] = useState([]);
  const [project, setProject] = useState("");
  const [iteration, setIteration] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(API_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((res) => {
        if (!Array.isArray(res)) throw new Error("응답이 배열이 아님");
        const clean = res.filter((r) => r.Project && r.Iteration);
        if (!clean.length) throw new Error("유효한 데이터 없음");
        setRawData(clean);
        setProject(clean[0].Project);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
      });
  }, []);

  const projects = useMemo(() => {
    return [...new Set(rawData.map((d) => d.Project).filter(Boolean))].sort((a, b) =>
      String(a).localeCompare(String(b))
    );
  }, [rawData]);

  const projectRows = useMemo(() => {
    return rawData.filter((d) => d.Project === project);
  }, [rawData, project]);

  const iterations = useMemo(() => {
    return [...new Set(projectRows.map((d) => d.Iteration).filter(Boolean))].sort(
      (a, b) => getIterationOrder(a) - getIterationOrder(b)
    );
  }, [projectRows]);

  useEffect(() => {
    if (iterations.length) setIteration(iterations[0]);
  }, [iterations]);

  const currentRows = useMemo(() => {
    return projectRows.filter((d) => d.Iteration === iteration);
  }, [projectRows, iteration]);

  const iterationSummary = useMemo(() => {
    const grouped = {};
    projectRows.forEach((row) => {
      if (!grouped[row.Iteration]) grouped[row.Iteration] = [];
      grouped[row.Iteration].push(row);
    });

    return Object.entries(grouped)
      .map(([it, items]) => ({
        iteration: it,
        order: getIterationOrder(it),
        avgCpi: averageBy(items, "CPI"),
        avgD1: averageBy(items, "D1 Retention"),
        totalInstallsMeta: items.reduce((sum, item) => sum + getInstallsMeta(item), 0),
        totalInstallsGa: items.reduce((sum, item) => sum + getInstallsGa(item), 0),
        avgD0Pt: averageBy(items, "D0 Playtime"),
        avgD1Pt: averageBy(items, "D1 Playtime"),
      }))
      .sort((a, b) => a.order - b.order);
  }, [projectRows]);

  const currentSummary = iterationSummary.find((item) => item.iteration === iteration);
  const currentIndex = iterationSummary.findIndex((item) => item.iteration === iteration);
  const previousSummary = currentIndex > 0 ? iterationSummary[currentIndex - 1] : null;

  const latestRowsByProject = useMemo(() => {
    const latestByProject = {};
    rawData.forEach((row) => {
      const prev = latestByProject[row.Project];
      if (!prev || getIterationOrder(row.Iteration) > getIterationOrder(prev.Iteration)) {
        latestByProject[row.Project] = row;
      }
    });
    return Object.values(latestByProject);
  }, [rawData]);

  const overviewProjects = new Set(rawData.map((row) => row.Project).filter(Boolean)).size;
  const overviewTotalDownloads = rawData.reduce((sum, row) => sum + getInstallsMeta(row), 0);

  const bestCpiRow = [...latestRowsByProject]
    .filter((row) => hasValue(row.CPI) && toNumber(row.CPI) > 0)
    .sort((a, b) => toNumber(a.CPI) - toNumber(b.CPI))[0];

  const bestD1Row = [...latestRowsByProject]
    .filter((row) => hasValue(row["D1 Retention"]) && toNumber(row["D1 Retention"]) > 0)
    .sort((a, b) => toNumber(b["D1 Retention"]) - toNumber(a["D1 Retention"]))[0];

  const sortedCurrentRows = [...currentRows].sort((a, b) =>
    String(a.Date || "").localeCompare(String(b.Date || ""))
  );

  const previousRows = useMemo(() => {
  if (!previousSummary) return [];
  return projectRows
    .filter((row) => row.Iteration === previousSummary.iteration)
    .sort((a, b) => String(a.Date || "").localeCompare(String(b.Date || "")));
}, [projectRows, previousSummary]);

const cpiChartData = {
  labels: sortedCurrentRows.map((row) => row.Date || "-"),
  datasets: [
    {
      label: "Current",
      data: sortedCurrentRows.map((row) => toNumber(row.CPI)),
      borderColor: "#4f46e5",
      backgroundColor: "rgba(79,70,229,0.12)",
      tension: 0.3,
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 5,
    },
    ...(previousRows.length
      ? [
          {
            label: "Previous",
            data: previousRows.map((row) => toNumber(row.CPI)),
            borderColor: "#94a3b8",
            backgroundColor: "rgba(148,163,184,0.10)",
            tension: 0.3,
            borderWidth: 2,
            borderDash: [6, 6],
            pointRadius: 2,
            pointHoverRadius: 4,
          },
        ]
      : []),
  ],
};

const d1ChartData = {
  labels: sortedCurrentRows.map((row) => row.Date || "-"),
  datasets: [
    {
      label: "Current",
      data: sortedCurrentRows.map((row) => toNumber(row["D1 Retention"])),
      borderColor: "#059669",
      backgroundColor: "rgba(5,150,105,0.12)",
      tension: 0.3,
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 5,
    },
    ...(previousRows.length
      ? [
          {
            label: "Previous",
            data: previousRows.map((row) => toNumber(row["D1 Retention"])),
            borderColor: "#94a3b8",
            backgroundColor: "rgba(148,163,184,0.10)",
            tension: 0.3,
            borderWidth: 2,
            borderDash: [6, 6],
            pointRadius: 2,
            pointHoverRadius: 4,
          },
        ]
      : []),
  ],
};

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: "index",
    intersect: false,
  },
  plugins: {
    legend: {
      position: "top",
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        color: "#6b7280",
      },
      grid: {
        color: "#e5e7eb",
      },
    },
    x: {
      ticks: {
        color: "#6b7280",
      },
      grid: {
        display: false,
      },
    },
  },
};

  return (
    <div className="wrap">
      <div className="topbar">
        <h1 className="dashboard-title">📊 Flick Project Dashboard</h1>
        <a
          className="raw-link"
          href="https://docs.google.com/spreadsheets/d/1pBJWVce2CgrPBlFMGbS2yCp6tBQnNn4gkEHz7jG3LZk/edit?gid=0#gid=0"
          target="_blank"
          rel="noopener noreferrer"
        >
          Flick Project Dashboard_Raw Data
        </a>
      </div>

      {error && <div className="error-box">데이터 로드 실패: {error}</div>}

      <section className="section-block">
        <div className="section-header">
          <div className="section-eyebrow">Portfolio</div>
          <h2 className="section-heading">전체 프로젝트</h2>
          <p className="section-desc">
            현재 트래킹 중인 프로젝트 포트폴리오를 한눈에 보는 요약 영역입니다.
          </p>
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
              {bestCpiRow ? (
                <>
                  <div className="overview-value small">
                    {bestCpiRow.Project}{" "}
                    <span className="overview-meta">{bestCpiRow.Iteration}</span>
                  </div>
                  <div>{formatCurrency(bestCpiRow.CPI)}</div>
                </>
              ) : (
                "No data"
              )}
            </div>
          </div>

          <div className="overview-item">
            <div className="overview-label">Best D1</div>
            <div className="overview-value">
              {bestD1Row ? (
                <>
                  <div className="overview-value small">
                    {bestD1Row.Project}{" "}
                    <span className="overview-meta">{bestD1Row.Iteration}</span>
                  </div>
                  <div>{formatPercent(bestD1Row["D1 Retention"])}</div>
                </>
              ) : (
                "No data"
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="section-header">
          <div className="section-eyebrow">Project Detail</div>
          <h2 className="section-heading">개별 프로젝트</h2>
          <p className="section-desc">
            선택한 프로젝트의 iteration별 성과와 추이를 비교하는 상세 분석 영역입니다.
          </p>
        </div>

        <div className="section-shell">
          <div className="card">
            <div className="filter-row">
              <div className="filter-group">
                <div className="filter-label">Project</div>
                <select id="projectSelector" value={project} onChange={(e) => setProject(e.target.value)}>
                  {projects.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <div className="filter-label">Iteration</div>
                <select id="iterationSelector" value={iteration} onChange={(e) => setIteration(e.target.value)}>
                  {iterations.map((it) => (
                    <option key={it} value={it}>
                      {it}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="kpi-grid">
            <div className="card">
              <div className="kpi-title">Installs</div>
              <div className="kpi-value">Meta: {currentSummary?.totalInstallsMeta || 0}</div>
              <div className="kpi-value small">GA: {currentSummary?.totalInstallsGa || 0}</div>
              <div className="kpi-delta">
                {previousSummary ? (
                  <>
                    <span className={deltaText(currentSummary?.totalInstallsMeta, previousSummary.totalInstallsMeta, false, "number").cls}>
                      Meta {deltaText(currentSummary?.totalInstallsMeta, previousSummary.totalInstallsMeta, false, "number").text}
                    </span>
                    <br />
                    <span className={deltaText(currentSummary?.totalInstallsGa, previousSummary.totalInstallsGa, false, "number").cls}>
                      GA {deltaText(currentSummary?.totalInstallsGa, previousSummary.totalInstallsGa, false, "number").text}
                    </span>
                  </>
                ) : (
                  <span className="delta-flat">첫 CPI 테스트</span>
                )}
              </div>
            </div>

            <div className="card">
              <div className="kpi-title">CPI</div>
              <div className="kpi-value">{formatCurrency(currentSummary?.avgCpi)}</div>
              <div className={`kpi-delta ${previousSummary ? deltaText(currentSummary?.avgCpi, previousSummary.avgCpi, true, "currency").cls : "delta-flat"}`}>
                {previousSummary ? deltaText(currentSummary?.avgCpi, previousSummary.avgCpi, true, "currency").text : "첫 CPI 테스트"}
              </div>
            </div>

            <div className="card">
              <div className="kpi-title">D1 Retention</div>
              <div className="kpi-value">{formatPercent(currentSummary?.avgD1)}</div>
              <div className={`kpi-delta ${previousSummary ? deltaText(currentSummary?.avgD1, previousSummary.avgD1, false, "percent").cls : "delta-flat"}`}>
                {previousSummary ? deltaText(currentSummary?.avgD1, previousSummary.avgD1, false, "percent").text : "첫 CPI 테스트"}
              </div>
            </div>

            <div className="card">
              <div className="kpi-title">D0 Playtime</div>
              <div className="kpi-value">{formatSeconds(currentSummary?.avgD0Pt)}</div>
              <div className={`kpi-delta ${previousSummary ? deltaText(currentSummary?.avgD0Pt, previousSummary.avgD0Pt, false, "seconds").cls : "delta-flat"}`}>
                {previousSummary ? deltaText(currentSummary?.avgD0Pt, previousSummary.avgD0Pt, false, "seconds").text : "첫 CPI 테스트"}
              </div>
            </div>

            <div className="card">
              <div className="kpi-title">D1 Playtime</div>
              <div className="kpi-value">{formatSeconds(currentSummary?.avgD1Pt)}</div>
              <div className={`kpi-delta ${previousSummary ? deltaText(currentSummary?.avgD1Pt, previousSummary.avgD1Pt, false, "seconds").cls : "delta-flat"}`}>
                {previousSummary ? deltaText(currentSummary?.avgD1Pt, previousSummary.avgD1Pt, false, "seconds").text : "첫 CPI 테스트"}
              </div>
            </div>
          </div>

          <div className="chart-grid">
  <div className="card">
    <h3 className="chart-title">CPI Trend</h3>
    <div className="chart-box">
      <Line data={cpiChartData} options={chartOptions} />
    </div>
  </div>

  <div className="card">
    <h3 className="chart-title">D1 Retention Trend</h3>
    <div className="chart-box">
      <Line data={d1ChartData} options={chartOptions} />
    </div>
  </div>
</div>

          <div className="card">
            <h3 className="table-title">Iteration Comparison</h3>
            <table>
              <thead>
                <tr>
                  <th>Iteration</th>
                  <th>CPI</th>
                  <th>D1 Retention</th>
                  <th>Installs (Meta)</th>
                  <th>Installs (GA)</th>
                  <th>D0 Playtime</th>
                  <th>D1 Playtime</th>
                  <th>Change</th>
                </tr>
              </thead>
              <tbody>
                {iterationSummary.map((row, index) => {
                  const prev = index > 0 ? iterationSummary[index - 1] : null;
                  return (
                    <tr key={row.iteration}>
                      <td>{row.iteration}</td>
                      <td>{formatCurrency(row.avgCpi)}</td>
                      <td>{formatPercent(row.avgD1)}</td>
                      <td>{row.totalInstallsMeta || 0}</td>
                      <td>{row.totalInstallsGa || 0}</td>
                      <td>{formatSeconds(row.avgD0Pt)}</td>
                      <td>{formatSeconds(row.avgD1Pt)}</td>
                      <td>
                        {prev ? (
                          <>
                            <span className={deltaText(row.avgCpi, prev.avgCpi, true, "currency").cls}>
                              CPI {deltaText(row.avgCpi, prev.avgCpi, true, "currency").text}
                            </span>
                            <br />
                            <span className={deltaText(row.avgD1, prev.avgD1, false, "percent").cls}>
                              D1 {deltaText(row.avgD1, prev.avgD1, false, "percent").text}
                            </span>
                          </>
                        ) : (
                          <span className="delta-flat">첫 CPI 테스트</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h3 className="table-title">Selected Iteration Daily Metrics</h3>
            <p className="table-subtitle">선택한 iteration의 일자별 raw 지표입니다.</p>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>CPI</th>
                  <th>D1 Retention</th>
                  <th>Installs (Meta)</th>
                  <th>Installs (GA)</th>
                  <th>D0 Playtime</th>
                  <th>D1 Playtime</th>
                </tr>
              </thead>
              <tbody>
                {sortedCurrentRows.map((row, idx) => (
                  <tr key={idx}>
                    <td>{row.Date || "-"}</td>
                    <td>{hasValue(row.CPI) && toNumber(row.CPI) > 0 ? formatCurrency(row.CPI) : "No data"}</td>
                    <td>
                      {hasValue(row["D1 Retention"]) && toNumber(row["D1 Retention"]) > 0
                        ? formatPercent(row["D1 Retention"])
                        : "No data"}
                    </td>
                    <td>{hasValue(row["Installs (Meta)"]) ? getInstallsMeta(row) : 0}</td>
                    <td>{hasValue(row["Installs (GA)"]) ? getInstallsGa(row) : 0}</td>
                    <td>
                      {hasValue(row["D0 Playtime"]) && toNumber(row["D0 Playtime"]) > 0
                        ? formatSeconds(row["D0 Playtime"])
                        : "No data"}
                    </td>
                    <td>
                      {hasValue(row["D1 Playtime"]) && toNumber(row["D1 Playtime"]) > 0
                        ? formatSeconds(row["D1 Playtime"])
                        : "No data"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}