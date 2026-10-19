import { NextRequest, NextResponse } from "next/server";

type LookupKind = "projects" | "declarationTypes";
type LookupOption = { code: string; label: string };

const DEMO_OPTIONS: Record<LookupKind, LookupOption[]> = {
  projects: [
    { code: "300000", label: "Intern project" },
    { code: "PRJ-2026-01", label: "Implementatie" },
    { code: "PRJ-2026-02", label: "Procesoptimalisatie" },
  ],
  declarationTypes: [
    { code: "K01", label: "Overige kosten" },
    { code: "ZK", label: "Zakelijke kilometers" },
    { code: "OV", label: "Overige declaratie" },
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
  const kind: LookupKind = rawKind === "projects" ? "projects" : "declarationTypes";
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().toLocaleLowerCase("nl-NL");

  const baseUrl = process.env.AFAS_BASE_URL?.replace(/\/$/, "");
  const token = process.env.AFAS_TOKEN;
  const connector = kind === "projects"
    ? process.env.AFAS_PROJECTS_GETCONNECTOR
    : process.env.AFAS_DECLARATION_TYPES_GETCONNECTOR;

  if (!baseUrl || !token || !connector) {
    return NextResponse.json({ source: "demo", options: filter(DEMO_OPTIONS[kind], query) });
  }

  try {
    const response = await fetch(`${baseUrl}/connectors/${encodeURIComponent(connector)}?skip=0&take=1000`, {
      headers: { Accept: "application/json", Authorization: `AfasToken ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`AFAS gaf status ${response.status}`);

    const data = await response.json() as { rows?: Record<string, unknown>[] };
    const options = (data.rows ?? [])
      .map((row) => toOption(row, kind))
      .filter((option): option is LookupOption => Boolean(option));

    return NextResponse.json({ source: "afas", options: filter(options, query) });
  } catch (error) {
    return NextResponse.json(
      { source: "demo", warning: error instanceof Error ? error.message : "AFAS lookup mislukt", options: filter(DEMO_OPTIONS[kind], query) },
      { status: 200 },
    );
  }
}

function toOption(row: Record<string, unknown>, kind: LookupKind): LookupOption | null {
  const configuredCode = kind === "projects" ? process.env.AFAS_PROJECT_CODE_FIELD : process.env.AFAS_DECLARATION_TYPE_CODE_FIELD;
  const configuredLabel = kind === "projects" ? process.env.AFAS_PROJECT_LABEL_FIELD : process.env.AFAS_DECLARATION_TYPE_LABEL_FIELD;
  const code = readFirst(row, configuredCode ? [configuredCode] : FIELD_CANDIDATES[kind].code);
  if (!code) return null;
  const label = readFirst(row, configuredLabel ? [configuredLabel] : FIELD_CANDIDATES[kind].label) || code;
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
