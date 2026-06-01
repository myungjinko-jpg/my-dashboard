import { deltaText, formatCurrency, formatPercent, formatSeconds, formatNumber } from "../utils";

function KpiCard({ title, value, sub, delta }) {
  return (
    <div className="card">
      <div className="kpi-title">{title}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-value small">{sub}</div>}
      <div className="kpi-delta">{delta}</div>
    </div>
  );
}

export default function KpiGrid({ currentSummary, previousSummary }) {
  const metaDelta = previousSummary
    ? deltaText(currentSummary?.totalInstallsMeta, previousSummary.totalInstallsMeta, false, "number")
    : null;

  return (
    <div className="kpi-grid">
      <KpiCard
        title="Installs (Meta)"
        value={formatNumber(currentSummary?.totalInstallsMeta)}
        sub={`GA: ${formatNumber(currentSummary?.totalInstallsGa)}`}
        delta={
          metaDelta
            ? <span className={metaDelta.cls}>{metaDelta.text}</span>
            : <span className="delta-flat">Initial CPI Test</span>
        }
      />
      <KpiCard
        title="CPI"
        value={formatCurrency(currentSummary?.avgCpi)}
        delta={
          previousSummary
            ? <span className={deltaText(currentSummary?.avgCpi, previousSummary.avgCpi, true, "currency").cls}>
                {deltaText(currentSummary?.avgCpi, previousSummary.avgCpi, true, "currency").text}
              </span>
            : <span className="delta-flat">Initial CPI Test</span>
        }
      />
      <KpiCard
        title="D1 Retention"
        value={formatPercent(currentSummary?.avgD1)}
        delta={
          previousSummary
            ? <span className={deltaText(currentSummary?.avgD1, previousSummary.avgD1, false, "percent").cls}>
                {deltaText(currentSummary?.avgD1, previousSummary.avgD1, false, "percent").text}
              </span>
            : <span className="delta-flat">Initial CPI Test</span>
        }
      />
      <KpiCard
        title="D0 Playtime"
        value={formatSeconds(currentSummary?.avgD0Pt)}
        delta={
          previousSummary
            ? <span className={deltaText(currentSummary?.avgD0Pt, previousSummary.avgD0Pt, false, "seconds").cls}>
                {deltaText(currentSummary?.avgD0Pt, previousSummary.avgD0Pt, false, "seconds").text}
              </span>
            : <span className="delta-flat">Initial CPI Test</span>
        }
      />
      <KpiCard
        title="D1 Playtime"
        value={formatSeconds(currentSummary?.avgD1Pt)}
        delta={
          previousSummary
            ? <span className={deltaText(currentSummary?.avgD1Pt, previousSummary.avgD1Pt, false, "seconds").cls}>
                {deltaText(currentSummary?.avgD1Pt, previousSummary.avgD1Pt, false, "seconds").text}
              </span>
            : <span className="delta-flat">Initial CPI Test</span>
        }
      />
    </div>
  );
}
