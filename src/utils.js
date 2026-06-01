export function toNumber(value) {
  return Number(String(value || 0).replace(/[^0-9.]/g, "")) || 0;
}

export function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

export function isValidMetricValue(value, key) {
  if (!Number.isFinite(value)) return false;
  if (key === "CPI") return value > 0;
  if (key.includes("Retention")) return value >= 0;
  if (key.includes("Playtime")) return value > 0;
  return value > 0;
}

export function getInstallsMeta(row) {
  return toNumber(row["Installs (Meta)"]);
}

export function getInstallsGa(row) {
  return toNumber(row["Installs (GA)"]);
}

export function hasAnyMetricData(row) {
  const metricKeys = ["CPI", "Installs (Meta)", "Installs (GA)", "D1 Retention", "D0 Playtime", "D1 Playtime"];
  return metricKeys.some((key) => hasValue(row[key]));
}

export function getIterationOrder(value) {
  const parsed = Number(String(value || "").replace("#", ""));
  return Number.isNaN(parsed) ? 9999 : parsed;
}

export function parseDateValue(value) {
  if (!value) return 0;
  const parts = String(value).trim().split(".").map((v) => v.trim()).filter(Boolean);
  if (parts.length < 3) return 0;
  const [year, month, day] = parts.map(Number);
  return new Date(year, month - 1, day).getTime();
}

export function formatDisplayDate(value) {
  const timestamp = parseDateValue(value);
  if (!timestamp) return "-";
  const date = new Date(timestamp);
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()} (${weekdays[date.getDay()]})`;
}

export function formatNumber(value) {
  const num = toNumber(value);
  if (!num) return "0";
  return num.toLocaleString();
}

export function formatCurrency(value) {
  const num = toNumber(value);
  if (!num) return "No data";
  return `$${num.toFixed(2)}`;
}

export function formatPercent(value) {
  const num = toNumber(value);
  if (!Number.isFinite(num)) return "No data";
  return `${num.toFixed(2)}%`;
}

export function formatSeconds(value) {
  const num = toNumber(value);
  if (!num) return "No data";
  return `${Math.round(num)} sec`;
}

export function deltaText(current, previous, inverse = false, formatter = "number") {
  const currentValue = toNumber(current);
  const previousValue = toNumber(previous);
  if (!Number.isFinite(previousValue) || previousValue === 0) return { text: "-", cls: "delta-flat" };
  const diff = currentValue - previousValue;
  if (Math.abs(diff) < 0.0001) return { text: "→ 0", cls: "delta-flat" };
  const improved = inverse ? diff < 0 : diff > 0;
  const arrow = diff > 0 ? "▲" : "▼";
  const cls = improved ? "delta-up" : "delta-down";
  let value;
  if (formatter === "currency") value = `$${Math.abs(diff).toFixed(2)}`;
  else if (formatter === "percent") value = `${Math.abs(diff).toFixed(2)}%p`;
  else if (formatter === "seconds") value = `${Math.round(Math.abs(diff))} sec`;
  else value = `${Math.round(Math.abs(diff))}`;
  return { text: `${arrow} ${value}`, cls };
}


export function getWeightedCpi(items) {
  let weightedSum = 0, totalWeight = 0;
  items.forEach((item) => {
    const cpi = toNumber(item.CPI);
    const installsMeta = getInstallsMeta(item);
    if (isValidMetricValue(cpi, "CPI") && installsMeta > 0) {
      weightedSum += cpi * installsMeta;
      totalWeight += installsMeta;
    }
  });
  return totalWeight === 0 ? 0 : weightedSum / totalWeight;
}

export function getWeightedRetention(items) {
  let totalInstallsGa = 0, totalRetainedUsers = 0;
  items.forEach((item) => {
    const retention = toNumber(item["D1 Retention"]);
    const installsGa = getInstallsGa(item);
    if (isValidMetricValue(retention, "D1 Retention") && installsGa > 0) {
      totalRetainedUsers += installsGa * (retention / 100);
      totalInstallsGa += installsGa;
    }
  });
  return totalInstallsGa === 0 ? 0 : (totalRetainedUsers / totalInstallsGa) * 100;
}

export function getWeightedD0Playtime(items) {
  let weightedSum = 0, totalWeight = 0;
  items.forEach((item) => {
    const playtime = toNumber(item["D0 Playtime"]);
    const installsGa = getInstallsGa(item);
    if (isValidMetricValue(playtime, "D0 Playtime") && installsGa > 0) {
      weightedSum += playtime * installsGa;
      totalWeight += installsGa;
    }
  });
  return totalWeight === 0 ? 0 : weightedSum / totalWeight;
}

export function getWeightedD1Playtime(items) {
  let weightedSum = 0, totalWeight = 0;
  items.forEach((item) => {
    const playtime = toNumber(item["D1 Playtime"]);
    const retention = toNumber(item["D1 Retention"]);
    const installsGa = getInstallsGa(item);
    const retainedUsers = isValidMetricValue(retention, "D1 Retention") && installsGa > 0
      ? installsGa * (retention / 100) : 0;
    if (isValidMetricValue(playtime, "D1 Playtime") && retainedUsers > 0) {
      weightedSum += playtime * retainedUsers;
      totalWeight += retainedUsers;
    }
  });
  return totalWeight === 0 ? 0 : weightedSum / totalWeight;
}

export function getIterationMeta(items) {
  if (!items.length) return { startDate: "", endDate: "", status: "No Data" };
  const sortedByDate = [...items].sort((a, b) => parseDateValue(a.Date) - parseDateValue(b.Date));
  const startDate = sortedByDate[0]?.Date || "";
  const endDate = sortedByDate[sortedByDate.length - 1]?.Date || "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endTimestamp = parseDateValue(endDate);
  const endDateOnly = new Date(endTimestamp);
  endDateOnly.setHours(0, 0, 0, 0);
  const status = endTimestamp && endDateOnly >= today ? "Live" : "Test Ended";
  return { startDate, endDate, status };
}
