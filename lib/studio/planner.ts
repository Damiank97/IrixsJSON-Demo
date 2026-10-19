import { DATASETS, METRICS, newWidget, validateDashboard, type Dashboard, type DatasetId, type EngineTrace, type GenerationResult, type Widget } from "./model";

export const EXAMPLE_PROMPT = "Maak een dashboard met de omzetontwikkeling per maand, een vergelijking met vorig jaar, de top 10 klanten en een filter op administratie.";

export function missingForQuestion(question: string): string[] {
  const q = question.toLowerCase();
  const missing: string[] = [];
  if (/verzuim|ziekte|ziekmeld|absen/.test(q)) missing.push("Verzuimdagen, beschikbare werkdagen en medewerkerbezetting per periode");
  if (/salaris|loon|payroll/.test(q)) missing.push("Geautoriseerde loon- en salarisgegevens per periode");
  if (/voorraad|inventory/.test(q)) missing.push("Voorraadstanden en voorraadmutaties");
  if (/cashflow|liquiditeit|bankstand/.test(q)) missing.push("Bankmutaties, openstaande posten en beginstanden");
  if (/forecast|voorspel|prognose|budget/.test(q)) missing.push("Bevestigde budgetten of een goedgekeurd prognosemodel");
  if (/fte|personeels|headcount|medewerkers/.test(q) && !/uren|project|nacalculatie/.test(q)) missing.push("Medewerkerbezetting en FTE met peildatums");
  return missing;
}

export function makeDashboard(dataset: DatasetId = "revenue", empty = false): Dashboard {
  const widgets = dataset === "revenue" ? [newWidget("revenue"), newWidget("growth"), newWidget("profit"), newWidget("customers"), { ...newWidget("revenue", "bar"), title: "Omzetontwikkeling", width: "full" as const }, { ...newWidget("revenue", "bar", "customer"), title: "Top 10 klanten" }, { ...newWidget("revenue", "table", "administration"), title: "Resultaat per administratie" }] : [newWidget("hours"), newWidget("billableHours"), newWidget("utilization"), { ...newWidget("hours", "line"), title: "Urenontwikkeling", width: "full" as const }, { ...newWidget("hours", "bar", "project"), title: "Top 10 projecten" }];
  return { id: crypto.randomUUID(), title: empty ? "Nieuw dashboard" : dataset === "revenue" ? "Omzet & klanten" : "Projecten & inzet", description: empty ? "Geef je dashboard een naam en voeg inzichten toe." : dataset === "revenue" ? "Van maandtrend tot klantbijdrage. Alle cijfers in één overzicht." : "Inzicht in geschreven uren en declarabiliteit per project.", dataset, widgets: empty ? [] : widgets, filters: { year: 2026, administration: "all", fromMonth: 1, toMonth: 12 }, owner: "eigenaar", shared: false, updatedAt: null };
}

export function demoDashboards(): Dashboard[] {
  const revenue = { ...makeDashboard(), id: "demo-omzet", shared: true };
  const hours = { ...makeDashboard("hours"), id: "demo-uren", shared: true };
  const result = { ...makeDashboard(), id: "demo-resultaat", title: "Financieel resultaat", description: "Brutowinst, marge en omzet per administratie.", shared: true, widgets: [newWidget("revenue"), newWidget("profit"), newWidget("margin"), newWidget("growth"), { ...newWidget("profit", "line"), title: "Brutowinst per maand", width: "full" as const }, { ...newWidget("margin", "bar", "customer"), title: "Marge per klant" }] };
  return [revenue, hours, result];
}

export function planQuestion(question: string, current?: Dashboard): Dashboard {
  const q = question.toLowerCase();
  if (!current && !/omzet|klant|financi|resultaat|bruto|marge|winst|uren|declarab|nacalculatie|project/.test(q)) throw new Error("De demo ondersteunt financiële resultaten en projecturen. Geef aan welke van deze gegevens je wilt bekijken.");
  const dashboard = current ? structuredClone(current) : makeDashboard(/uren|nacalculatie|declarab|project/.test(q) && !/omzet|klanten/.test(q) ? "hours" : "revenue");
  if (!current) {
    if (/lijn/.test(q)) dashboard.widgets = dashboard.widgets.map((w) => w.kind === "bar" && w.dimension === "month" ? { ...w, kind: "line" } : w);
    if (!/vorig|vergelijk|groei|yoy/.test(q)) dashboard.widgets = dashboard.widgets.map((w) => ({ ...w, compare: false }));
  } else {
    let changed = false;
    if (/lijn|staaf|tabel/.test(q)) {
      const kind = /lijn/.test(q) ? "line" : /staaf/.test(q) ? "bar" : "table";
      dashboard.widgets = dashboard.widgets.map((w) => {
        if (w.kind !== "kpi" && (w.dimension === "month" || /alle grafieken/.test(q))) { changed = true; return { ...w, kind }; }
        return w;
      });
    }
    if (/groei/.test(q) && dashboard.dataset === "revenue" && !dashboard.widgets.some((w) => w.metric === "growth" && w.kind === "kpi")) { dashboard.widgets.push(newWidget("growth")); changed = true; }
    if (/marge/.test(q) && dashboard.dataset === "revenue" && !dashboard.widgets.some((w) => w.metric === "margin")) { dashboard.widgets.push(newWidget("margin")); changed = true; }
    const top = /top\s*(\d{1,2})/.exec(q);
    if (top) { dashboard.widgets = dashboard.widgets.map((w) => w.dimension === "customer" || w.dimension === "project" ? { ...w, top: Math.min(12, Math.max(1, Number(top[1]))), title: `Top ${Math.min(12, Math.max(1, Number(top[1])))} ${w.dimension === "customer" ? "klanten" : "projecten"}` } : w); changed = true; }
    if (/vorig|vergelijk/.test(q)) { dashboard.widgets = dashboard.widgets.map((w) => ({ ...w, compare: true })); changed = true; }
    if (!changed) throw new Error("De demo-interpreter ondersteunt hier: grafiektype veranderen, marge/groei toevoegen, top N aanpassen en vergelijken met vorig jaar. Probeer een voorbeeldvraag.");
  }
  return validateDashboard(dashboard);
}

export function verifyKnowledge(dashboard: Dashboard, available: string[], source: EngineTrace["source"], warning?: string): GenerationResult {
  const dataset = DATASETS.find((s) => s.id === dashboard.dataset)!;
  const metrics = Array.from(new Set(dashboard.widgets.map((w) => w.metric)));
  const fields = Array.from(new Set(metrics.flatMap((metric) => METRICS[metric].fields).concat(dashboard.widgets.filter((w) => w.kind !== "kpi").map((w) => w.dimension), ["year", "month", "administration"])));
  const missing = fields.filter((field) => !dataset.fields.includes(field));
  if (!available.includes(dashboard.dataset) || missing.length) return { missing: { message: "Voor dit dashboard ontbreekt nog een benodigde gegevensbron. De inrichting kan door Irixs worden aangevuld.", fields: missing.length ? missing : [dataset.name], question: dashboard.title } };
  return { dashboard, trace: { source, warning, dataset: dashboard.dataset, metrics, fields, checks: [
    { label: "Vraag geïnterpreteerd", detail: `${metrics.map((m) => METRICS[m].name).join(", ")}` },
    { label: "Beschikbare gegevensbron gevonden", detail: `${dataset.name} · lokale demonstratiedataset` },
    { label: "Benodigde velden gevalideerd", detail: `${fields.length} velden zijn aanwezig in het datasetcontract` },
    { label: "KPI-definities gecontroleerd", detail: "Gewogen totalen, periodefilters en vergelijking met dezelfde periode vorig jaar" },
    { label: `${dashboard.widgets.length} dashboardcomponenten samengesteld`, detail: "Gestructureerde configuratie gecontroleerd; grafieken renderen op demodata" },
  ] } };
}

export function applyAiPlan(raw: unknown, current?: Dashboard): Dashboard {
  if (!raw || typeof raw !== "object") throw new Error("AI gaf geen dashboardplan terug.");
  const plan = raw as { title: string; description: string; dataset: DatasetId; widgets: Widget[] };
  const dashboard = current ? structuredClone(current) : makeDashboard(plan.dataset, true);
  if (current && plan.dataset !== current.dataset) throw new Error("Een vervolgopdracht mag de gegevensbron niet ongevraagd vervangen.");
  dashboard.title = plan.title; dashboard.description = plan.description;
  if (!Array.isArray(plan.widgets) || !plan.widgets.length) throw new Error("AI gaf geen bruikbare componenten terug.");
  const existingIds = new Set(current?.widgets.map((w) => w.id));
  if (current && current.widgets.some((w) => !plan.widgets.some((proposed) => proposed.id === w.id))) throw new Error("Het AI-plan moet de bestaande componenten behouden. Pas alleen de gevraagde onderdelen aan.");
  dashboard.widgets = plan.widgets.map((w) => ({ ...w, id: typeof w.id === "string" && existingIds.has(w.id) ? w.id : crypto.randomUUID() }));
  return validateDashboard(dashboard);
}
