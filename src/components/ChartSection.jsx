import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from "chart.js";
import { Line } from "react-chartjs-2";
import { toNumber } from "../utils";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const cpiChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: "index", intersect: false },
  plugins: {
    legend: { position: "top" },
    tooltip: {
      callbacks: {
        label: (ctx) => `${ctx.dataset.label}: $${Number(ctx.parsed.y ?? 0).toFixed(2)}`,
      },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: { color: "#6b7280", callback: (v) => `$${Number(v).toFixed(2)}` },
      grid: { color: "#e5e7eb" },
    },
    x: { ticks: { color: "#6b7280" }, grid: { display: false } },
  },
};

const d1ChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: "index", intersect: false },
  plugins: {
    legend: { position: "top" },
    tooltip: {
      callbacks: {
        label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.parsed.y ?? 0).toFixed(2)}%`,
      },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: { color: "#6b7280", callback: (v) => `${Number(v).toFixed(0)}%` },
      grid: { color: "#e5e7eb" },
    },
    x: { ticks: { color: "#6b7280" }, grid: { display: false } },
  },
};

export default function ChartSection({ chartCurrentRows, previousRows }) {
  const cpiChartData = {
    labels: chartCurrentRows.map((row) => row.Date || "-"),
    datasets: [
      {
        label: "Current",
        data: chartCurrentRows.map((row) => toNumber(row.CPI)),
        borderColor: "#4f46e5", backgroundColor: "rgba(79,70,229,0.12)",
        tension: 0.3, borderWidth: 2, pointRadius: 3, pointHoverRadius: 5,
      },
      ...(previousRows.length ? [{
        label: "Previous",
        data: previousRows.map((row) => toNumber(row.CPI)),
        borderColor: "#94a3b8", backgroundColor: "rgba(148,163,184,0.10)",
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
        borderColor: "#94a3b8", backgroundColor: "rgba(148,163,184,0.10)",
        tension: 0.3, borderWidth: 2, borderDash: [6, 6], pointRadius: 2, pointHoverRadius: 4,
      }] : []),
    ],
  };

  return (
    <div className="chart-grid">
      <div className="card">
        <h3 className="chart-title">CPI Trend</h3>
        <div className="chart-box">
          <Line data={cpiChartData} options={cpiChartOptions} />
        </div>
      </div>
      <div className="card">
        <h3 className="chart-title">D1 Retention Trend</h3>
        <div className="chart-box">
          <Line data={d1ChartData} options={d1ChartOptions} />
        </div>
      </div>
    </div>
  );
}
