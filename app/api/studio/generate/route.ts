import { NextRequest, NextResponse } from "next/server";
import { DATASETS, publicCatalog, validateDashboard, type Dashboard } from "@/lib/studio/model";
import { applyAiPlan, missingForQuestion, planQuestion, verifyKnowledge } from "@/lib/studio/planner";
import { aiConfiguration, completeJson } from "@/lib/aiProvider";
import { getEvidence } from "@/lib/studio/knowledge";

export const maxDuration = 60;
export async function POST(request: NextRequest) {
  try {
    const raw = await request.text();
    if (raw.length > 32_000) return NextResponse.json({ error: "Deze vraag is te groot." }, { status: 413 });
    const body = JSON.parse(raw);
    if (typeof body.question !== "string" || !body.question.trim() || body.question.length > 2000) return NextResponse.json({ error: "Stel een vraag van maximaal 2.000 tekens." }, { status: 400 });
    let current: Dashboard | undefined;
    if (body.current) current = validateDashboard(body.current);
    const available = Array.isArray(body.available) ? body.available.filter((v: unknown) => v === "revenue" || v === "hours") : ["revenue", "hours"];
    const missing = missingForQuestion(body.question);
    if (missing.length) return NextResponse.json({ missing: { message: "Voor dit dashboard ontbreekt nog een benodigde gegevensbron. De inrichting kan door Irixs worden aangevuld.", fields: missing, question: body.question } });
    // Hergebruik de bestaande officiële schemabank; ze wordt niet als leesconnector voorgesteld.
    const existingKnowledge = (await Promise.all(["FiEntries", "PtRealization"].map(getEvidence))).filter(Boolean).map((e) => ({ id: e!.id, version: e!.version, name: e!.name, fields: e!.fields.slice(0, 6).map(({code,description,type}) => ({code,description,type})) }));
    let source: "ai" | "deterministic" = "deterministic";
    let warning: string | undefined;
    let dashboard: Dashboard | undefined;
    if (aiConfiguration().configured) {
      try {
        const result = await completeJson([
          { role: "system", content: `Je maakt configuraties voor Irixs Dashboard Studio, geen frontendcode. Gebruik uitsluitend de verstrekte metadata. Geen AFAS-connectors, velden of waarden verzinnen. Antwoord uitsluitend met een geldig JSON-object, zonder Markdown: {"title":"...","description":"...","dataset":"revenue|hours","widgets":[{"id":"...","title":"...","kind":"kpi|line|bar|table","metric":"...","dimension":"month|customer|project|administration","compare":true,"width":"half|full","top":10}]}. Alle widgetvelden zijn verplicht, ook voor KPI's: gebruik daar dimension="month" en top=10. top is altijd een geheel getal van 1 t/m 12. Kies dimension en metric uitsluitend uit de gekozen dataset. Maximaal 16 componenten. Gebruik 3-4 kpi's, één brede maandgrafiek en een top-10 grafiek/tabel als dat bij de vraag past. Bij wijzigen: behoud dataset, bestaande widget-ids, titels en alle niet genoemde componenten. Pas alleen de gevraagde onderdelen aan. Gebruik de KPI-definities uit het cataloguscontract. Catalogus: ${JSON.stringify(publicCatalog())}. Bestaande schemabank als onderbouwde context: ${JSON.stringify(existingKnowledge)}. Dit zijn UpdateConnector-schema's, geen bevestigde GetConnectoren. De demo-adapter levert uitsluitend de velden uit het canonieke cataloguscontract.` },
          { role: "user", content: JSON.stringify({ question: body.question, current: current ? { title: current.title, description: current.description, dataset: current.dataset, widgets: current.widgets } : null }) },
        ], { tokens: 2500 });
        dashboard = applyAiPlan(result, current); source = "ai";
      } catch (error) {
        const status = error instanceof Error ? /De AI-provider gaf status (\d{3})\./.exec(error.message)?.[1] : undefined;
        warning = status ? `De AI-provider gaf status ${status}. De beperkte demo-interpreter is gebruikt.` : "AI gaf geen bruikbaar plan terug. De beperkte demo-interpreter is gebruikt.";
      }
    } else warning = "Externe AI staat uit of is niet geconfigureerd: deze vraag is verwerkt door de beperkte demo-interpreter.";
    dashboard ??= planQuestion(body.question, current);
    const result = verifyKnowledge(dashboard, available, source, warning);
    const reference = existingKnowledge.find((e) => e.id === DATASETS.find((s) => s.id === dashboard!.dataset)?.reference);
    if (result.trace && reference) result.trace.checks.splice(1, 0, { label: "Bestaande kennisbank geraadpleegd", detail: `Officiële AFAS-definitie ${reference.version} gecontroleerd als context; dashboarddata komt uit de afzonderlijke demo-adapter.` });
    if (result.missing) result.missing.question = body.question;
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof SyntaxError ? "Ongeldige JSON." : error instanceof Error ? error.message : "Dashboard genereren mislukt." }, { status: 400 });
  }
}
