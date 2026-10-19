import { NextRequest, NextResponse } from "next/server";
import { DEMO_COMBINATIONS, parseCombinations } from "@/lib/declarationRules";

type LookupKind = "projects" | "declarationTypes";
type LookupOption = { code: string; label: string; kind?: "kosten" | "kilometers" };

const DEMO_OPTIONS: Record<LookupKind, LookupOption[]> = {
  projects: [
    { code: "300000", label: "Intern project" },
    { code: "PRJ-2026-01", label: "Implementatie" },
    { code: "PRJ-2026-02", label: "Procesoptimalisatie" },
  ],
  declarationTypes: [
    { code: "K01", label: "Overige kosten", kind: "kosten" },
    { code: "ZK", label: "Zakelijke kilometers", kind: "kilometers" },
    { code: "OV", label: "Overige declaratie", kind: "kosten" },
  ],
};

const FIELD_CANDIDATES: Record<LookupKind, { code: string[]; label: string[] }> = {
  projects: {
    code: ["Project", "Projectcode", "ProjectCode", "PrId", "Code"],
    label: ["Omschrijving", "Description", "Projectnaam", "ProjectName", "Naam", "Name"],
  },
  declarationTypes: {
    code: ["Declaratiesoort", "DeclarationType", "BiId", "Typecode", "TypeCode", "Code"],
    label: ["Omschrijving", "Description", "Naam", "Name"],
  },
};

export async function GET(request: NextRequest) {
  const rawKind = request.nextUrl.searchParams.get("type");
  if (!["projects", "declarationTypes", "validityCombinations"].includes(rawKind ?? "")) return NextResponse.json({ error: "Onbekende lookup." }, { status: 400 });
  const kind = rawKind as LookupKind | "validityCombinations";
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().toLocaleLowerCase("nl-NL");

  const baseUrl = process.env.AFAS_BASE_URL?.replace(/\/$/, "");
  const token = process.env.AFAS_TOKEN;
  const connector = kind === "projects"
    ? process.env.AFAS_PROJECTS_GETCONNECTOR
    : kind === "declarationTypes" ? process.env.AFAS_DECLARATION_TYPES_GETCONNECTOR : process.env.AFAS_VALIDITY_GETCONNECTOR;

  if (!baseUrl && !token && !connector) {
    return NextResponse.json(kind === "validityCombinations" ? { source: "demo", combinations: DEMO_COMBINATIONS } : { source: "demo", options: filter(DEMO_OPTIONS[kind], query) }, { headers: { "Cache-Control": "no-store" } });
  }
  if (!baseUrl || !token || !connector) return NextResponse.json({ source: "error", error: "AFAS-koppeling is onvolledig ingesteld. Vul de omgevingsvariabelen en de GetConnector voor deze lookup in." }, { status: 503 });

  try {
    const rows: Record<string, unknown>[] = [];
    // Geen stil afgekapt resultaat: ook combinaties na regel 1.000 tellen mee.
    for (let skip = 0; ; skip += 1000) {
      if (skip >= 50_000) throw new Error("Deze lookup bevat meer dan 50.000 regels. Beperk de GetConnector tot de benodigde declaratiegegevens.");
      const response = await fetch(`${baseUrl}/connectors/${encodeURIComponent(connector)}?skip=${skip}&take=1000`, {
        headers: { Accept: "application/json", Authorization: `AfasToken ${token}` }, cache: "no-store", signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`AFAS gaf status ${response.status}`);
      const data = await response.json() as { rows?: Record<string, unknown>[] };
      if (!Array.isArray(data.rows)) throw new Error("AFAS gaf geen geldige regels terug.");
      rows.push(...data.rows);
      if (data.rows.length < 1000) break;
    }
    if (kind === "validityCombinations") {
      const fields = {
        employee: process.env.AFAS_VALIDITY_EMPLOYEE_FIELD || "Medewerker", project: process.env.AFAS_VALIDITY_PROJECT_FIELD || "Project",
        declarationType: process.env.AFAS_VALIDITY_DECLARATION_TYPE_FIELD || "Declaratiesoort", startDate: process.env.AFAS_VALIDITY_START_FIELD || "Begindatum", endDate: process.env.AFAS_VALIDITY_END_FIELD || "Einddatum",
      };
      return NextResponse.json({ source: "afas", combinations: parseCombinations(rows, fields) }, { headers: { "Cache-Control": "no-store" } });
    }
    const options = rows
      .map((row) => toOption(row, kind))
      .filter((option): option is LookupOption => Boolean(option));

    return NextResponse.json({ source: "afas", options: filter(options, query) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { source: "error", error: error instanceof Error ? error.message : "AFAS lookup mislukt" },
      { status: 502 },
    );
  }
}

function toOption(row: Record<string, unknown>, kind: LookupKind): LookupOption | null {
  const configuredCode = kind === "projects" ? process.env.AFAS_PROJECT_CODE_FIELD : process.env.AFAS_DECLARATION_TYPE_CODE_FIELD;
  const configuredLabel = kind === "projects" ? process.env.AFAS_PROJECT_LABEL_FIELD : process.env.AFAS_DECLARATION_TYPE_LABEL_FIELD;
  const code = readFirst(row, configuredCode ? [configuredCode] : FIELD_CANDIDATES[kind].code);
  if (!code) return null;
  const label = readFirst(row, configuredLabel ? [configuredLabel] : FIELD_CANDIDATES[kind].label) || code;
  if (kind === "declarationTypes") {
    const column = process.env.AFAS_DECLARATION_KIND_FIELD || "Invoertype";
    const value = String(row[column] ?? "").trim().toLowerCase();
    if (process.env.AFAS_DECLARATION_KIND_FIELD && !["kosten", "kilometers"].includes(value)) throw new Error(`Kolom '${column}' moet kosten of kilometers bevatten voor elke declaratiesoort.`);
    return { code, label, ...(["kosten", "kilometers"].includes(value) ? { kind: value as "kosten" | "kilometers" } : {}) };
  }
  return { code, label };
}

function readFirst(row: Record<string, unknown>, fields: string[]) {
  for (const field of fields) {
    const value = row[field];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function filter(options: LookupOption[], query: string) {
  if (!query) return options;
  return options.filter((option) => `${option.code} ${option.label}`.toLocaleLowerCase("nl-NL").includes(query));
}
