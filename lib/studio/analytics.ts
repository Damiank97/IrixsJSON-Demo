import { ADMINS, METRICS, MONTHS, type Dashboard, type DataRow, type DatasetId, type MetricId, type Widget } from "./model";

const CUSTOMERS = ["Atlas Groep", "Kompas Services", "Nova Techniek", "Helder Advies", "Westhaven", "Studio Noord", "Buitenlijn", "Vonk Partners", "Meridiaan", "Polderwerk", "Lumen", "Kern & Co"];
export function demoRows(dataset: DatasetId): DataRow[] {
  const rows: DataRow[] = [];
  for (let year = 2024; year <= 2026; year++) for (let month = 1; month <= 12; month++) ADMINS.forEach((administration, a) => CUSTOMERS.forEach((customer, c) => {
    const seasonal = [0.88, 0.92, 1.06, 1.02, 1.1, 1.16, 0.83, 0.9, 1.2, 1.14, 1.08, 1.21][month - 1];
    const revenue = Math.round((6200 + (11 - c) * 1300 + a * 800) * seasonal * (1 + (year - 2024) * 0.115) * (1 + ((c * 7 + month * 3 + a) % 9 - 4) / 100));
    const hours = Math.round((42 + (11 - c) * 5 + a * 7) * seasonal * (1 + (year - 2024) * 0.04));
    rows.push({ year, month, administration, customer: dataset === "revenue" ? customer : "", project: `Project ${String(c + 1).padStart(2, "0")}`, revenue: dataset === "revenue" ? revenue : 0, profit: dataset === "revenue" ? Math.round(revenue * (0.26 + (c % 5) * 0.035)) : 0, hours: dataset === "hours" ? hours : 0, billableHours: dataset === "hours" ? Math.round(hours * (0.65 + (c % 4) * 0.07)) : 0 });
  }));
  return rows;
}

export function selectedRows(dashboard: Dashboard, year = dashboard.filters.year): DataRow[] {
  return demoRows(dashboard.dataset).filter((r) => r.year === year && r.month >= dashboard.filters.fromMonth && r.month <= dashboard.filters.toMonth && (dashboard.filters.administration === "all" || r.administration === dashboard.filters.administration));
}

export function calculateMetric(metric: MetricId, rows: DataRow[], previous: DataRow[]): number | null {
  const sum = (key: "revenue" | "profit" | "hours" | "billableHours", data = rows) => data.reduce((total, row) => total + row[key], 0);
  switch (metric) {
    case "revenue": return sum("revenue");
    case "profit": return sum("profit");
    case "hours": return sum("hours");
    case "billableHours": return sum("billableHours");
    case "customers": return new Set(rows.filter((row) => row.revenue > 0).map((row) => row.customer)).size;
    case "margin": return sum("revenue") ? sum("profit") / sum("revenue") * 100 : null;
    case "utilization": return sum("hours") ? sum("billableHours") / sum("hours") * 100 : null;
    case "growth": return sum("revenue", previous) ? (sum("revenue") - sum("revenue", previous)) / sum("revenue", previous) * 100 : null;
  }
}

export function widgetData(dashboard: Dashboard, widget: Widget) {
  const rows = selectedRows(dashboard), previous = selectedRows(dashboard, dashboard.filters.year - 1);
  const twoYearsAgo = selectedRows(dashboard, dashboard.filters.year - 2);
  const keys = widget.dimension === "month" ? Array.from({ length: dashboard.filters.toMonth - dashboard.filters.fromMonth + 1 }, (_, i) => dashboard.filters.fromMonth + i) : Array.from(new Set(rows.map((r) => r[widget.dimension])));
  const series = keys.map((key) => {
    const subset = (data: DataRow[]) => data.filter((r) => r[widget.dimension] === key);
    return { label: widget.dimension === "month" ? MONTHS[Number(key) - 1] : String(key), value: calculateMetric(widget.metric, subset(rows), subset(previous)), previous: calculateMetric(widget.metric, subset(previous), subset(twoYearsAgo)) };
  });
  return { value: calculateMetric(widget.metric, rows, previous), previous: calculateMetric(widget.metric, previous, twoYearsAgo), series: widget.dimension === "month" ? series : series.sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity)).slice(0, widget.top) };
}

export function formatMetric(metric: MetricId, value: number | null, compact = false): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("nl-NL", { ...(METRICS[metric].format === "currency" ? { style: "currency", currency: "EUR" } : {}), maximumFractionDigits: METRICS[metric].format === "percent" ? 1 : compact ? 1 : 0, ...(compact ? { notation: "compact" as const } : {}) }).format(value) + (METRICS[metric].format === "percent" ? "%" : "");
}
