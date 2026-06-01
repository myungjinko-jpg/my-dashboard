import { hasValue, toNumber, getInstallsMeta, getInstallsGa, formatCurrency, formatPercent, formatSeconds } from "../utils";
import renderInlineDelta from "./InlineDelta";

export default function DailyTable({ dailyRowsWithChange }) {
  return (
    <div className="card">
      <h3 className="table-title">Selected Iteration Daily Metrics</h3>
      <p className="table-subtitle">Daily raw metrics for the selected iteration.</p>
      <table className="daily-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>CPI</th>
            <th>Installs (Meta)</th>
            <th>Installs (GA)</th>
            <th>D1 Retention</th>
            <th>D0 Playtime</th>
            <th>D1 Playtime</th>
          </tr>
        </thead>
        <tbody>
          {dailyRowsWithChange.map((row, idx) => (
            <tr key={idx}>
              <td>{row.Date || "-"}</td>
              <td>
                <div>{hasValue(row.CPI) && toNumber(row.CPI) > 0 ? formatCurrency(row.CPI) : "No data"}</div>
                {renderInlineDelta(row.dailyDelta.cpi)}
              </td>
              <td>{hasValue(row["Installs (Meta)"]) ? getInstallsMeta(row) : 0}</td>
              <td>{hasValue(row["Installs (GA)"]) ? getInstallsGa(row) : 0}</td>
              <td>
                <div>{hasValue(row["D1 Retention"]) && Number.isFinite(toNumber(row["D1 Retention"])) ? formatPercent(row["D1 Retention"]) : "No data"}</div>
                {renderInlineDelta(row.dailyDelta.d1)}
              </td>
              <td>
                <div>{hasValue(row["D0 Playtime"]) && toNumber(row["D0 Playtime"]) > 0 ? formatSeconds(row["D0 Playtime"]) : "No data"}</div>
                {renderInlineDelta(row.dailyDelta.d0Pt)}
              </td>
              <td>
                <div>{hasValue(row["D1 Playtime"]) && toNumber(row["D1 Playtime"]) > 0 ? formatSeconds(row["D1 Playtime"]) : "No data"}</div>
                {renderInlineDelta(row.dailyDelta.d1Pt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
