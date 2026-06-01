import { deltaText, formatCurrency, formatPercent, formatSeconds, formatNumber } from "../utils";
import renderInlineDelta from "./InlineDelta";

export default function IterationTable({ iterationSummary, currentIteration }) {
  return (
    <div className="card">
      <h3 className="table-title">Iteration Comparison</h3>
      <table className="iteration-table">
        <thead>
          <tr>
            <th>Iteration</th>
            <th>CPI</th>
            <th>Installs (Meta)</th>
            <th>Installs (GA)</th>
            <th>D1 Retention</th>
            <th>D0 Playtime</th>
            <th>D1 Playtime</th>
          </tr>
        </thead>
        <tbody>
          {iterationSummary.map((row, index) => {
            const prev = index < iterationSummary.length - 1 ? iterationSummary[index + 1] : null;
            const cpiDelta = prev ? deltaText(row.avgCpi, prev.avgCpi, true, "currency") : null;
            const d1Delta = prev ? deltaText(row.avgD1, prev.avgD1, false, "percent") : null;
            const d0PtDelta = prev ? deltaText(row.avgD0Pt, prev.avgD0Pt, false, "seconds") : null;
            const d1PtDelta = prev ? deltaText(row.avgD1Pt, prev.avgD1Pt, false, "seconds") : null;

            return (
              <tr key={row.iteration} className={row.iteration === currentIteration ? "row-highlight" : ""}>
                <td>{row.iteration}</td>
                <td><div>{formatCurrency(row.avgCpi)}</div>{renderInlineDelta(cpiDelta)}</td>
                <td>{formatNumber(row.totalInstallsMeta)}</td>
                <td>{formatNumber(row.totalInstallsGa)}</td>
                <td><div>{formatPercent(row.avgD1)}</div>{renderInlineDelta(d1Delta)}</td>
                <td><div>{formatSeconds(row.avgD0Pt)}</div>{renderInlineDelta(d0PtDelta)}</td>
                <td><div>{formatSeconds(row.avgD1Pt)}</div>{renderInlineDelta(d1PtDelta)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
