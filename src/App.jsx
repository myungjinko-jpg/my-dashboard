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


// 🔥 값이 유효한지 체크하는 함수
// - CPI는 0보다 커야 유효
// - Retention은 0도 의미 있는 값이라 허용
// - Playtime은 0이면 데이터 없음/수집 실패 가능성이 있어 제외
function isValidMetricValue(value, key) {
  if (!Number.isFinite(value)) return false;

  if (key === "CPI") return value > 0;
  if (key.includes("Retention")) return value >= 0;
  if (key.includes("Playtime")) return value > 0;

  return value > 0;
}

// 🔥 CPI 집계 함수
// - 일자별 CPI를 단순 평균하지 않고
// - Meta installs를 가중치로 사용하여 최종 CPI 계산
// - 공식: Σ(CPI × InstallsMeta) / Σ(InstallsMeta)
function getWeightedCpi(items) {
  let weightedSum = 0;
  let totalWeight = 0;

  items.forEach((item) => {
    const cpi = toNumber(item.CPI);
    const installsMeta = getInstallsMeta(item);

    if (isValidMetricValue(cpi, "CPI") && installsMeta > 0) {
      weightedSum += cpi * installsMeta;
      totalWeight += installsMeta;
    }
  });

  if (totalWeight === 0) return 0;

  return weightedSum / totalWeight;
}

// 🔥 D1 Retention 집계 함수
// - 각 날짜의 GA installs와 retention을 사용해
//   실제 D1 retained users 수를 계산한 뒤
// - 전체 retained users / 전체 installs(GA) 로 최종 리텐션 계산
// - 공식: Σ(InstallsGA × D1Retention) / Σ(InstallsGA)
function getWeightedRetention(items) {
  let totalInstallsGa = 0;
  let totalRetainedUsers = 0;

  items.forEach((item) => {
    const retention = toNumber(item["D1 Retention"]);
    const installsGa = getInstallsGa(item);

    if (isValidMetricValue(retention, "D1 Retention") && installsGa > 0) {
      totalRetainedUsers += installsGa * (retention / 100);
      totalInstallsGa += installsGa;
    }
  });

  if (totalInstallsGa === 0) return 0;

  // 🔥 최종 결과는 다시 % 단위로 반환
  return (totalRetainedUsers / totalInstallsGa) * 100;
}

// 🔥 D0 Playtime 집계 함수
// - GA installs를 가중치로 사용한 가중 평균
// - 공식: Σ(InstallsGA × D0Playtime) / Σ(InstallsGA)
function getWeightedD0Playtime(items) {
  let weightedSum = 0;
  let totalWeight = 0;

  items.forEach((item) => {
    const playtime = toNumber(item["D0 Playtime"]);
    const installsGa = getInstallsGa(item);

    if (isValidMetricValue(playtime, "D0 Playtime") && installsGa > 0) {
      weightedSum += playtime * installsGa;
      totalWeight += installsGa;
    }
  });

  if (totalWeight === 0) return 0;

  return weightedSum / totalWeight;
}

// 🔥 D1 Playtime 집계 함수
// - D1에 실제로 살아남은 유저 수를 가중치로 사용
// - retained users = InstallsGA × D1Retention
// - 공식: Σ(D1RetainedUsers × D1Playtime) / Σ(D1RetainedUsers)
function getWeightedD1Playtime(items) {
  let weightedSum = 0;
  let totalWeight = 0;

  items.forEach((item) => {
    const playtime = toNumber(item["D1 Playtime"]);
    const retention = toNumber(item["D1 Retention"]);
    const installsGa = getInstallsGa(item);

    // 🔥 D1 retained users 수 계산
    const retainedUsers =
      isValidMetricValue(retention, "D1 Retention") && installsGa > 0
        ? installsGa * (retention / 100)
        : 0;

    if (isValidMetricValue(playtime, "D1 Playtime") && retainedUsers > 0) {
      weightedSum += playtime * retainedUsers;
      totalWeight += retainedUsers;
    }
  });

  if (totalWeight === 0) return 0;

  return weightedSum / totalWeight;
}

function formatCurrency(value) {
  const num = toNumber(value);
  if (!num) return "No data";
  return `$${num.toFixed(2)}`;
}

// 🔥 퍼센트 포맷 함수
// - 0%도 유효한 값이므로 표시해야 함
function formatPercent(value) {
  const num = toNumber(value);

  if (!Number.isFinite(num)) return "No data";

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

// 🔥 실제 지표 데이터가 하나라도 있는 row인지 확인
// - Project / Iteration / Date만 있고 나머지 metric이 모두 비어 있으면 false
function hasAnyMetricData(row) {
  const metricKeys = [
    "CPI",
    "Installs (Meta)",
    "Installs (GA)",
    "D1 Retention",
    "D0 Playtime",
    "D1 Playtime",
  ];

  return metricKeys.some((key) => hasValue(row[key]));
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
// 🔥 날짜 문자열을 timestamp로 변환
// - 시트 날짜 형식: YYYY. M. D.
function parseDateValue(value) {
  if (!value) return 0;

  const parts = String(value)
    .trim()
    .split(".")
    .map((v) => v.trim())
    .filter(Boolean);

  if (parts.length < 3) return 0;

  const [year, month, day] = parts.map(Number);

  return new Date(year, month - 1, day).getTime();
}

// 🔥 표시용 날짜 포맷 함수
// - 입력: YYYY. M. D.
// - 출력: 2026. 4. 6 (Mon)
function formatDisplayDate(value) {
  const timestamp = parseDateValue(value);
  if (!timestamp) return "-";

  const date = new Date(timestamp);
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = weekdays[date.getDay()];

  return `${year}. ${month}. ${day} (${weekday})`;
}

// 🔥 현재 iteration의 테스트 메타 정보 계산
// - 시작일 / 종료일 / 현재 상태를 계산
function getIterationMeta(items) {
  if (!items.length) {
    return {
      startDate: "",
      endDate: "",
      status: "No Data",
    };
  }

  const sortedByDate = [...items].sort(
    (a, b) => parseDateValue(a.Date) - parseDateValue(b.Date)
  );

  const startDate = sortedByDate[0]?.Date || "";
  const endDate = sortedByDate[sortedByDate.length - 1]?.Date || "";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const endTimestamp = parseDateValue(endDate);
  const endDateOnly = new Date(endTimestamp);
  endDateOnly.setHours(0, 0, 0, 0);

  const status = endTimestamp && endDateOnly >= today ? "Live" : "Test Ended";

  return {
    startDate,
    endDate,
    status,
  };
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
        const clean = res.filter((r) => {
          return hasValue(r.Project) && hasValue(r.Iteration) && hasValue(r.Date);
        });
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
      (a, b) => getIterationOrder(b) - getIterationOrder(a)
    );
  }, [projectRows]);

  useEffect(() => {
    if (iterations.length) setIteration(iterations[0]);
  }, [iterations]);

  const currentRows = useMemo(() => {
    return projectRows.filter((d) => d.Iteration === iteration);
  }, [projectRows, iteration]);

  const metricRows = useMemo(() => {
  return currentRows.filter((row) => hasAnyMetricData(row));
  }, [currentRows]);

  const currentMeta = useMemo(() => {
  return getIterationMeta(currentRows);
  }, [currentRows]);

  const iterationSummary = useMemo(() => {
    const grouped = {};

    projectRows.forEach((row) => {
      // 🔥 placeholder row는 iteration 존재/기간 용도로는 남기되
      // KPI 집계용 iteration summary에서는 제외
      if (!hasAnyMetricData(row)) return;

      if (!grouped[row.Iteration]) grouped[row.Iteration] = [];
      grouped[row.Iteration].push(row);
    });

    return Object.entries(grouped)
      .map(([it, items]) => ({
        iteration: it,
        order: getIterationOrder(it),

        // 🔥 CPI는 Meta installs 기준 가중 평균 사용
        avgCpi: getWeightedCpi(items),

        // 🔥 D1 Retention은 GA installs 기반 코호트 합산 리텐션 사용
        avgD1: getWeightedRetention(items),

        // 🔥 installs 합계
        totalInstallsMeta: items.reduce(
          (sum, item) => sum + getInstallsMeta(item),
          0
        ),
        totalInstallsGa: items.reduce(
          (sum, item) => sum + getInstallsGa(item),
          0
        ),

        // 🔥 D0 / D1 Playtime 가중 평균
        avgD0Pt: getWeightedD0Playtime(items),
        avgD1Pt: getWeightedD1Playtime(items),
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


// 테이블용 (최신 날짜 → 과거)
// - 실제 metric이 있는 row만 표시
const sortedCurrentRows = [...metricRows].sort(
  (a, b) => parseDateValue(b.Date) - parseDateValue(a.Date)
);

// 차트용 (과거 → 최신)
// - 실제 metric이 있는 row만 표시
const chartCurrentRows = [...metricRows].sort(
  (a, b) => parseDateValue(a.Date) - parseDateValue(b.Date)
);


const previousRows = useMemo(() => {
  if (!previousSummary) return [];

  return projectRows
    .filter(
      (row) =>
        row.Iteration === previousSummary.iteration && hasAnyMetricData(row)
    )
    .sort((a, b) => parseDateValue(a.Date) - parseDateValue(b.Date));
}, [projectRows, previousSummary]);

const cpiChartData = {
  labels: chartCurrentRows.map((row) => row.Date || "-"),
  datasets: [
    {
      label: "Current",
      data: chartCurrentRows.map((row) => toNumber(row.CPI)),
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
  labels: chartCurrentRows.map((row) => row.Date || "-"),
  datasets: [
    {
      label: "Current",
      data: chartCurrentRows.map((row) => toNumber(row["D1 Retention"])),
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

// 🔥 CPI 차트 전용 옵션
// y축과 툴팁에 달러($) 표시
const cpiChartOptions = {
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
    tooltip: {
      callbacks: {
        // 툴팁 값에 $ 표시
        label: function (context) {
          const label = context.dataset.label || "";
          const value = context.parsed.y ?? 0;
          return `${label}: $${Number(value).toFixed(2)}`;
        },
      },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        color: "#6b7280",
        // y축 눈금에 $ 표시
        callback: function (value) {
          return `$${Number(value).toFixed(2)}`;
        },
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

// 🔥 D1 Retention 차트 전용 옵션
// y축과 툴팁에 % 표시
const d1ChartOptions = {
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
    tooltip: {
      callbacks: {
        // 툴팁 값에 % 표시
        label: function (context) {
          const label = context.dataset.label || "";
          const value = context.parsed.y ?? 0;
          return `${label}: ${Number(value).toFixed(2)}%`;
        },
      },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        color: "#6b7280",
        // y축 눈금에 % 표시
        callback: function (value) {
          return `${Number(value).toFixed(0)}%`;
        },
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

const sortedProjects = [...projects].sort((a, b) => {
  const isDropA = a.startsWith("(Drop)");
  const isDropB = b.startsWith("(Drop)");

  if (isDropA && !isDropB) return 1;
  if (!isDropA && isDropB) return -1;

  return a.localeCompare(b);
});

  return (
    <div className="wrap">
      <div className="topbar">
        <h1
          className="dashboard-title"
          style={{ display: "flex", alignItems: "center", gap: "10px" }}
        >
          <span>CPI Test Dashboard</span>
          <span
            style={{
              fontSize: "14px",
              fontWeight: 500,
              color: "#6b7280",
              padding: "2px 8px",
              border: "1px solid #e5e7eb",
              borderRadius: "999px",
              backgroundColor: "#f9fafb",
            }}
          >
            v2.0.0
          </span>
        </h1>
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

            {/* 🔥 제목 영어로 변경 */}
            <h2 className="section-heading">All Projects</h2>

            {/* 🔥 설명 영어로 변경 */}
            <p className="section-desc">
              A summary view of all currently tracked projects.
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
          {/* 🔥 제목을 영어로 변경 */}
          <h2 className="section-heading">Project Analysis</h2>

          {/* 🔥 설명도 영어로 변경 */}
          <p className="section-desc">
            Detailed analysis comparing performance and trends across iterations.
          </p>
        </div>

        <div className="section-shell">
          <div className="card">
            <div className="filter-row">
              <div className="filter-group">
                <div className="filter-label">Project</div>
                <select id="projectSelector" value={project} onChange={(e) => setProject(e.target.value)}>
                  {sortedProjects.map((p) => (
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

            {/* 🔥 선택한 iteration의 테스트 상태 및 기간 표시 */}
            <div
              style={{
                marginTop: "14px",
                paddingTop: "14px",
                borderTop: "1px solid #e5e7eb",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                fontSize: "14px",
                color: "#6b7280",
              }}
            >
              <div>
                <span style={{ fontWeight: 600, color: "#111827", marginRight: "6px" }}>
                  Status:
                </span>
                {currentMeta.status}
              </div>

              <div>
                <span style={{ fontWeight: 600, color: "#111827", marginRight: "6px" }}>
                  Date Range:
                </span>
                {formatDisplayDate(currentMeta.startDate)} ~ {formatDisplayDate(currentMeta.endDate)}
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
                  <span className="delta-flat">Initial CPI Test</span>
                )}
              </div>
            </div>

            <div className="card">
              <div className="kpi-title">CPI</div>
              <div className="kpi-value">{formatCurrency(currentSummary?.avgCpi)}</div>
              <div className={`kpi-delta ${previousSummary ? deltaText(currentSummary?.avgCpi, previousSummary.avgCpi, true, "currency").cls : "delta-flat"}`}>
                {previousSummary ? deltaText(currentSummary?.avgCpi, previousSummary.avgCpi, true, "currency").text : "Initial CPI Test"}
              </div>
            </div>

            <div className="card">
              <div className="kpi-title">D1 Retention</div>
              <div className="kpi-value">{formatPercent(currentSummary?.avgD1)}</div>
              <div className={`kpi-delta ${previousSummary ? deltaText(currentSummary?.avgD1, previousSummary.avgD1, false, "percent").cls : "delta-flat"}`}>
                {previousSummary ? deltaText(currentSummary?.avgD1, previousSummary.avgD1, false, "percent").text : "Initial CPI Test"}
              </div>
            </div>

            <div className="card">
              <div className="kpi-title">D0 Playtime</div>
              <div className="kpi-value">{formatSeconds(currentSummary?.avgD0Pt)}</div>
              <div className={`kpi-delta ${previousSummary ? deltaText(currentSummary?.avgD0Pt, previousSummary.avgD0Pt, false, "seconds").cls : "delta-flat"}`}>
                {previousSummary ? deltaText(currentSummary?.avgD0Pt, previousSummary.avgD0Pt, false, "seconds").text : "Initial CPI Test"}
              </div>
            </div>

            <div className="card">
              <div className="kpi-title">D1 Playtime</div>
              <div className="kpi-value">{formatSeconds(currentSummary?.avgD1Pt)}</div>
              <div className={`kpi-delta ${previousSummary ? deltaText(currentSummary?.avgD1Pt, previousSummary.avgD1Pt, false, "seconds").cls : "delta-flat"}`}>
                {previousSummary ? deltaText(currentSummary?.avgD1Pt, previousSummary.avgD1Pt, false, "seconds").text : "Initial CPI Test"}
              </div>
            </div>
          </div>

          <div className="chart-grid">
  <div className="card">
    <h3 className="chart-title">CPI Trend</h3>
    <div className="chart-box">
      {/* 🔥 CPI 차트는 달러 표시 옵션 사용 */}
      <Line data={cpiChartData} options={cpiChartOptions} />
    </div>
  </div>

  <div className="card">
    <h3 className="chart-title">D1 Retention Trend</h3>
    <div className="chart-box">
      {/* 🔥 D1 차트는 퍼센트 표시 옵션 사용 */}
      <Line data={d1ChartData} options={d1ChartOptions} />
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
                          <span className="delta-flat">Initial CPI Test</span>
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
            <p className="table-subtitle">Daily raw metrics for the selected iteration.</p>
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
                      {/* 🔥 리텐션은 0%도 유효한 값이므로 >= 0 기준으로 표시 */}
                      {hasValue(row["D1 Retention"]) && Number.isFinite(toNumber(row["D1 Retention"]))
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