import { deltaText, formatCurrency, formatPercent, formatSeconds } from "../utils";

export default function KpiGrid({ currentSummary, previousSummary }) {
  return (
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
  );
}
