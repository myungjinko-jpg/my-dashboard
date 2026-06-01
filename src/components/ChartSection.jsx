import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from "chart.js";
import { Line } from "react-chartjs-2";
import { toNumber } from "../utils";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

function makeChartOptions({ isDark, yPrefix, ySuffix, suggestedMax }) {
  const tickColor = isDark ? "#94a3b8" : "#6b7280";
  const gridColor = isDark ? "#2a3448" : "#e5e7eb";

  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        position: "top",
        labels: { color: isDark ? "#cbd5e1" : "#374151" },
      },
      tooltip: {
        backgroundColor: isDark ? "#1e2a3a" : "#ffffff",
        titleColor: isDark ? "#f1f5f9" : "#111827",
        bodyColor: isDark ? "#94a3b8" : "#6b7280",
        borderColor: isDark ? "#2a3a52" : "#e5e7eb",
        borderWidth: 1,
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${yPrefix}${Number(ctx.parsed.y ?? 0).toFixed(2)}${ySuffix}`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ...(suggestedMax !== undefined ? { suggestedMax } : {}),
        ticks: { color: tickColor, callback: (v) => `${yPrefix}${Number(v).toFixed(yPrefix ? 2 : 0)}${ySuffix}` },
        grid: { color: gridColor },
      },
      x: {
        ticks: { color: tickColor },
        grid: { display: false },
      },
    },
  };
}

export default function ChartSection({ chartCurrentRows, previousRows, isDark }) {
  const cpiChartData = {
    labels: chartCurrentRows.map((row) => row.Date || "-"),
    datasets: [
      {
        label: "Current",
        data: chartCurrentRows.map((row) => toNumber(row.CPI)),
        borderColor: "#6366f1", backgroundColor: "rgba(99,102,241,0.12)",
        tension: 0.3, borderWidth: 2, pointRadius: 3, pointHoverRadius: 5,
      },
      ...(previousRows.length ? [{
        label: "Previous",
        data: previousRows.map((row) => toNumber(row.CPI)),
        borderColor: isDark ? "#475569" : "#94a3b8",
        backgroundColor: isDark ? "rgba(71,85,105,0.10)" : "rgba(148,163,184,0.10)",
        tension: 0.3, borderWidth: 2, borderDash: [6, 6], pointRadius: 2, pointHoverRadius: 4,
      }] : []),
    ],
  };

  const d1ChartData = {
    labels: chartCurrentRows.map((row) => row.Date || "-"),
    datasets: [
      {
        label: "Current",
        data: chartCurrentRows.map((row) => toNumber(row["D1 Retention"])),
        borderColor: "#059669", backgroundColor: "rgba(5,150,105,0.12)",
        tension: 0.3, borderWidth: 2, pointRadius: 3, pointHoverRadius: 5,
      },
      ...(previousRows.length ? [{
        label: "Previous",
        data: previousRows.map((row) => toNumber(row["D1 Retention"])),
        borderColor: isDark ? "#475569" : "#94a3b8",
        backgroundColor: isDark ? "rgba(71,85,105,0.10)" : "rgba(148,163,184,0.10)",
        tension: 0.3, borderWidth: 2, borderDash: [6, 6], pointRadius: 2, pointHoverRadius: 4,
      }] : []),
    ],
  };

  return (
    <div className="chart-grid">
      <div className="card">
        <h3 className="chart-title">CPI Trend</h3>
        <div className="chart-box">
          <Line data={cpiChartData} options={makeChartOptions({ isDark, yPrefix: "$", ySuffix: "" })} />
        </div>
      </div>
      <div className="card">
        <h3 className="chart-title">D1 Retention Trend</h3>
        <div className="chart-box">
          <Line data={d1ChartData} options={makeChartOptions({ isDark, yPrefix: "", ySuffix: "%", suggestedMax: 10 })} />
        </div>
      </div>
    </div>
  );
}
