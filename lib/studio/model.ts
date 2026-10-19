export type DatasetId = "revenue" | "hours";
export type MetricId = "revenue" | "profit" | "margin" | "growth" | "customers" | "hours" | "billableHours" | "utilization";
export type WidgetKind = "kpi" | "line" | "bar" | "table";
export type Dimension = "month" | "customer" | "project" | "administration";
export type Widget = { id: string; title: string; kind: WidgetKind; metric: MetricId; dimension: Dimension; compare: boolean; width: "half" | "full"; top: number };
export type Dashboard = { id: string; title: string; description: string; dataset: DatasetId; widgets: Widget[]; filters: { year: number; administration: string; fromMonth: number; toMonth: number }; owner: string; shared: boolean; updatedAt: string | null };
export type DataRow = { year: number; month: number; administration: string; customer: string; project: string; revenue: number; profit: number; hours: number; billableHours: number };
export type MissingRequest = { id: string; question: string; missing: string[]; createdAt: string };
export type EngineTrace = { checks: { label: string; detail: string }[]; source: "ai" | "deterministic"; warning?: string; dataset: DatasetId; metrics: string[]; fields: string[] };
export type GenerationResult = { dashboard?: Dashboard; trace?: EngineTrace; missing?: { message: string; fields: string[]; question: string } };

export const DATASETS = [
  { id: "revenue" as const, name: "Financiële resultaten", connector: "DEMO_Omzetregels", status: "Demodataset", version: "2026-10-19", description: "Fictieve omzet en brutowinst per maand, klant en administratie.", fields: ["year", "month", "administration", "customer", "revenue", "profit"], dimensions: ["month", "customer", "administration"] as Dimension[], candidate: "Financiële mutaties / verkoopfactuurregels", reference: "FiEntries", relation: "customer → unieke fictieve klant; administratie + jaar + maand vormen de periode. Geen bevestigde AFAS-join." },
  { id: "hours" as const, name: "Projecten & uren", connector: "DEMO_Projecturen", status: "Demodataset", version: "2026-10-19", description: "Fictieve geschreven en declarabele uren per project en administratie.", fields: ["year", "month", "administration", "project", "hours", "billableHours"], dimensions: ["month", "project", "administration"] as Dimension[], candidate: "Nacalculatie / projecturen", reference: "PtRealization", relation: "project → uniek fictief project. Vertaling naar echte AFAS-project- en itemcodes nog te onderzoeken." },
];

export const METRICS: Record<MetricId, { name: string; dataset: DatasetId; format: "currency" | "number" | "percent"; fields: string[]; formula: string }> = {
  revenue: { name: "Omzet", dataset: "revenue", format: "currency", fields: ["revenue"], formula: "Som netto-omzet in de geselecteerde periode" },
  profit: { name: "Brutowinst", dataset: "revenue", format: "currency", fields: ["profit"], formula: "Som omzet minus directe kosten" },
  margin: { name: "Brutomarge", dataset: "revenue", format: "percent", fields: ["profit", "revenue"], formula: "Som brutowinst / som omzet × 100 (gewogen)" },
  growth: { name: "Groei t.o.v. vorig jaar", dataset: "revenue", format: "percent", fields: ["revenue", "year", "month"], formula: "(Omzet - omzet dezelfde periode vorig jaar) / omzet vorig jaar × 100" },
  customers: { name: "Actieve klanten", dataset: "revenue", format: "number", fields: ["customer", "revenue"], formula: "Aantal unieke klanten met positieve omzet in de selectie" },
  hours: { name: "Geschreven uren", dataset: "hours", format: "number", fields: ["hours"], formula: "Som geschreven uren" },
  billableHours: { name: "Declarabele uren", dataset: "hours", format: "number", fields: ["billableHours"], formula: "Som declarabele uren" },
  utilization: { name: "Declarabiliteit", dataset: "hours", format: "percent", fields: ["billableHours", "hours"], formula: "Som declarabele uren / som geschreven uren × 100 (gewogen)" },
};

export const MONTHS = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
export const ADMINS = ["Irixs Demo Noord", "Irixs Demo Zuid"];
export const STUDIO_STORAGE = "irixs-dashboard-studio-v1";
export const REQUEST_STORAGE = "irixs-studio-requests-v1";
export const SOURCE_STORAGE = "irixs-studio-sources-v1";

export function newWidget(metric: MetricId = "revenue", kind: WidgetKind = "kpi", dimension: Dimension = "month"): Widget {
  return { id: crypto.randomUUID(), title: METRICS[metric].name, kind, metric, dimension, compare: kind !== "kpi", width: "half", top: 10 };
}

// Eén configuratiecontract voor opslag, AI-uitvoer en rendering. Geen uitvoerbare code.
export function validateDashboard(value: unknown): Dashboard {
  if (!value || typeof value !== "object") throw new Error("Dashboarddefinitie ontbreekt.");
  const d = value as Dashboard;
  const dataset = DATASETS.find((item) => item.id === d.dataset);
  if (!dataset || typeof d.id !== "string" || !d.id || typeof d.title !== "string" || !d.title.trim() || d.title.length > 100 || typeof d.description !== "string" || d.description.length > 500 || !Array.isArray(d.widgets) || d.widgets.length > 24) throw new Error("Ongeldige dashboarddefinitie.");
  const ids = new Set();
  for (const w of d.widgets) {
    if (!w || typeof w.id !== "string" || !w.id || ids.has(w.id) || typeof w.title !== "string" || !w.title.trim() || w.title.length > 100 || !["kpi", "line", "bar", "table"].includes(w.kind) || !METRICS[w.metric] || METRICS[w.metric].dataset !== d.dataset || !dataset.dimensions.includes(w.dimension) || !["half", "full"].includes(w.width) || typeof w.compare !== "boolean" || !Number.isInteger(w.top) || w.top < 1 || w.top > 12) throw new Error("Een component gebruikt een onbekende KPI, dimensie of instelling.");
    ids.add(w.id);
  }
  const f = d.filters;
  if (!f || ![2025, 2026].includes(f.year) || (f.administration !== "all" && !ADMINS.includes(f.administration)) || !Number.isInteger(f.fromMonth) || !Number.isInteger(f.toMonth) || f.fromMonth < 1 || f.toMonth > 12 || f.fromMonth > f.toMonth) throw new Error("Ongeldige dashboardfilters.");
  if (typeof d.owner !== "string" || typeof d.shared !== "boolean" || (d.updatedAt !== null && (typeof d.updatedAt !== "string" || !Number.isFinite(Date.parse(d.updatedAt))))) throw new Error("Ongeldige opslaggegevens.");
  return d;
}

export function publicCatalog() {
  return DATASETS.map(({ id, name, description, fields, dimensions, version }) => ({ id, name, description, fields, dimensions, version, metrics: Object.entries(METRICS).filter(([, metric]) => metric.dataset === id).map(([id, metric]) => ({ id, ...metric })) }));
}
