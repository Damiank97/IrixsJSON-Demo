import { read, SSF, utils } from "xlsx";

export const PURE10_COLUMNS = [
  "Datum",
  "Vrij bestand 5",
  "Aantal",
  "Starttijd",
  "Omschrijving",
  "Datatype",
  "Periodetype",
  "Medewerker",
  "Voorcalculatie",
  "Code",
  "Projectfase",
  "Aangemaakt op",
  "Aangemaakt door",
  "Gewijzigd op",
  "Gewijzigd door",
  "Voorcalculatieregel-guid",
  "Event-guid",
  "Periode",
  "PURE Planningstypes",
  "Geacccordeerd",
  "PlanningTypeId",
  "Omschrijving intern",
] as const;

const PURE9_FIELDS = {
  BudgetLineGuid: ["BudgetLineGuid"],
  DataType: ["DataType"],
  EmployeeProfitCode: ["EmployeeProfitCode", "Medewerker"],
  HourAmount: ["HourAmount", "Aantal"],
  PhaseProfitCode: ["PhaseProfitCode", "Phase"],
  PureGuid: ["PureGuid"],
  Remarks: ["Remarks"],
  QuotationID: ["QuotationID"],
  Datum: ["Datum"],
  Uurtype: ["Uurtype"],
  StartTime: ["StartTime", "Starttijd"],
  Period: ["Period", "Periode"],
  PeriodType: ["PeriodType", "Periodetype"],
} as const;

type Pure9Field = keyof typeof PURE9_FIELDS;

const LOOKUP_REQUIRED = ["GUID regel", "Type item code", "Code"] as const;

type Cell = string | number | boolean | Date | null | undefined;
type TableRow = Record<string, Cell>;

export type ParsedTable = {
  fileName: string;
  headers: string[];
  rows: TableRow[];
};

export type MigrationStats = {
  sourceRows: number;
  convertedRows: number;
  matchedRows: number;
  weeklyRows: number;
  dailyRows: number;
  fractionalAmounts: number;
  startTimes: number;
  blankEmployees: number;
  totalHours: number;
};

export type MigrationResult = {
  csv: string | null;
  errors: string[];
  warnings: string[];
  stats: MigrationStats;
  preview: string[][];
};

export async function readTable(file: File): Promise<ParsedTable> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !["xlsx", "xls", "csv", "tsv"].includes(extension)) {
    throw new Error("Gebruik een .xlsx-, .xls-, .csv- of .tsv-bestand.");
  }

  if (extension === "csv" || extension === "tsv") {
    const text = new TextDecoder("utf-8").decode(await file.arrayBuffer()).replace(/^\uFEFF/, "");
    const delimiter = extension === "tsv" ? "\t" : detectDelimiter(text);
    const matrix = parseDelimited(text, delimiter);
    return matrixToTable(file.name, matrix);
  }

  const workbook = read(await file.arrayBuffer(), {
    type: "array",
    cellDates: false,
    raw: true,
  });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) throw new Error("Het werkboek bevat geen werkblad.");
  const matrix = utils.sheet_to_json<Cell[]>(workbook.Sheets[firstSheet], {
    header: 1,
    raw: true,
    defval: "",
    blankrows: false,
  });
  return matrixToTable(file.name, matrix);
}

export function migratePure9ToPure10(source: ParsedTable, lookup: ParsedTable): MigrationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const sourceColumns = resolveSourceColumns(source.headers);
  const missingSourceFields = (Object.keys(PURE9_FIELDS) as Pure9Field[])
    .filter((field) => !sourceColumns[field])
    .map((field) => PURE9_FIELDS[field].join(" / "));
  if (missingSourceFields.length) {
    errors.push(`PURE 9-bestand: ontbrekende kolommen: ${missingSourceFields.join(", ")}.`);
  }
  validateHeaders(lookup, LOOKUP_REQUIRED, "GetConnector", errors);
  const freeFileHeader = findFreeFileHeader(source.headers);
  if (!freeFileHeader) {
    errors.push("Het PURE 9-bestand mist de kolom 'Vrij bestand 1' t/m 'Vrij bestand 10'.");
  }
  const sourceValue = (row: TableRow, field: Pure9Field) => {
    const header = sourceColumns[field];
    return header ? row[header] : undefined;
  };
  const planningRows = source.rows
    .map((row, index) => ({ row, rowNumber: index + 2 }))
    .filter(({ row }) => parseNumber(sourceValue(row, "DataType")) === 2);
  const ignoredSourceRows = source.rows.length - planningRows.length;
  const inferBlankPeriodsAsWeekly = planningRows.length > 0 && planningRows.every(({ row }) =>
    parseNumber(sourceValue(row, "PeriodType")) === null && isMondayDate(sourceValue(row, "Datum")),
  );

  const stats: MigrationStats = {
    sourceRows: planningRows.length,
    convertedRows: 0,
    matchedRows: 0,
    weeklyRows: 0,
    dailyRows: 0,
    fractionalAmounts: 0,
    startTimes: 0,
    blankEmployees: 0,
    totalHours: 0,
  };

  if (errors.length) return { csv: null, errors, warnings, stats, preview: [] };
  if (!source.rows.length) errors.push("Het PURE 9-bestand bevat geen gegevensregels.");
  else if (!planningRows.length) errors.push("Het PURE 9-bestand bevat geen planningsregels met DataType 2.");
  if (!lookup.rows.length) errors.push("De GetConnector bevat geen voorcalculatieregels.");
  if (errors.length) return { csv: null, errors, warnings, stats, preview: [] };
  if (ignoredSourceRows) {
    warnings.push(`${ignoredSourceRows.toLocaleString("nl-NL")} overige regels uit het vrije bestand zijn genegeerd.`);
  }
  if (inferBlankPeriodsAsWeekly) {
    warnings.push("PeriodType is leeg; omdat alle planningsdatums op maandag vallen, zijn de regels als weekplanning verwerkt.");
  }

  const byGuid = new Map<string, { code: string; type: string }>();
  const duplicateLookupGuids = new Set<string>();
  for (const [index, row] of lookup.rows.entries()) {
    const guid = normalizeGuid(row["GUID regel"]);
    if (!guid) {
      errors.push(`GetConnector regel ${index + 2}: GUID regel is leeg.`);
      continue;
    }
    if (byGuid.has(guid)) duplicateLookupGuids.add(guid);
    byGuid.set(guid, {
      code: textValue(row.Code),
      type: textValue(row["Type item code"]),
    });
  }
  if (duplicateLookupGuids.size) {
    errors.push(`De GetConnector bevat ${duplicateLookupGuids.size} dubbele GUID(s).`);
  }

  const output: string[][] = [];
  const seenEvents = new Set<string>();
  const issueLimit = 30;
  let hiddenIssueCount = 0;
  const addRowError = (message: string) => {
    if (errors.length < issueLimit) errors.push(message);
    else hiddenIssueCount += 1;
  };
  for (const { row, rowNumber } of planningRows) {
    const budgetGuid = normalizeGuid(sourceValue(row, "BudgetLineGuid"));
    const eventGuid = normalizeGuid(sourceValue(row, "PureGuid"));
    const match = byGuid.get(budgetGuid);
    const amount = parseNumber(sourceValue(row, "HourAmount"));
    const date = formatDate(sourceValue(row, "Datum"));
    const periodType = parseNumber(sourceValue(row, "PeriodType")) ?? (inferBlankPeriodsAsWeekly ? 1 : null);
    const employee = textValue(sourceValue(row, "EmployeeProfitCode"));
    const description = textValue(sourceValue(row, "Remarks"));

    if (!budgetGuid) addRowError(`PURE 9 regel ${rowNumber}: BudgetLineGuid is leeg.`);
    else if (!match) addRowError(`PURE 9 regel ${rowNumber}: geen match voor ${textValue(sourceValue(row, "BudgetLineGuid"))}.`);
    else {
      stats.matchedRows += 1;
      if (!match.code) addRowError(`PURE 9 regel ${rowNumber}: de gematchte werksoort heeft geen Code.`);
      if (match.type.toLowerCase() !== "wst") {
        addRowError(`PURE 9 regel ${rowNumber}: type '${match.type || "leeg"}' is geen werksoort (Wst).`);
      }
    }
    if (!eventGuid) addRowError(`PURE 9 regel ${rowNumber}: PureGuid/Event-guid is leeg.`);
    else if (seenEvents.has(eventGuid)) addRowError(`PURE 9 regel ${rowNumber}: dubbele Event-guid ${textValue(sourceValue(row, "PureGuid"))}.`);
    else seenEvents.add(eventGuid);
    if (amount === null || amount < 0) addRowError(`PURE 9 regel ${rowNumber}: ongeldig aantal uren.`);
    if (!date) addRowError(`PURE 9 regel ${rowNumber}: ongeldige datum.`);
    if (periodType !== 0 && periodType !== 1) addRowError(`PURE 9 regel ${rowNumber}: PeriodType is niet 0 of 1.`);
    if (description.length > 50) addRowError(`PURE 9 regel ${rowNumber}: Omschrijving is langer dan 50 tekens.`);

    if (amount !== null) {
      stats.totalHours += amount;
      if (!Number.isInteger(amount)) stats.fractionalAmounts += 1;
    }
    if (periodType === 1) stats.weeklyRows += 1;
    if (periodType === 0) stats.dailyRows += 1;
    if (!employee) stats.blankEmployees += 1;
    const startTime = formatTime(sourceValue(row, "StartTime"));
    if (startTime) stats.startTimes += 1;

    output.push([
      date,
      freeFileHeader ? textValue(row[freeFileHeader]) : "",
      amount === null ? "" : formatAmount(amount),
      startTime,
      description,
      "0",
      periodType === null ? "" : String(periodType),
      employee,
      textValue(sourceValue(row, "QuotationID")),
      match?.code ?? "",
      textValue(sourceValue(row, "PhaseProfitCode")),
      "",
      "",
      "",
      "",
      textValue(sourceValue(row, "BudgetLineGuid")),
      textValue(sourceValue(row, "PureGuid")),
      textValue(sourceValue(row, "Period")),
      "",
      "0",
      "1",
      "",
    ]);
  }

  if (hiddenIssueCount) errors.push(`Daarnaast zijn nog ${hiddenIssueCount} fouten niet getoond.`);
  if (stats.blankEmployees) warnings.push(`${stats.blankEmployees.toLocaleString("nl-NL")} regels hebben bewust geen medewerker.`);
  if (stats.dailyRows) warnings.push(`${stats.dailyRows.toLocaleString("nl-NL")} dagregels worden met Periodetype 0 overgenomen.`);
  if (stats.startTimes) warnings.push(`${stats.startTimes.toLocaleString("nl-NL")} starttijden worden als uu:mm geschreven.`);

  stats.totalHours = Number(stats.totalHours.toFixed(6));
  stats.convertedRows = errors.length ? 0 : output.length;
  const csv = errors.length ? null : toCsv(output);
  return {
    csv,
    errors,
    warnings,
    stats,
    preview: output.slice(0, 8),
  };
}

function resolveSourceColumns(headers: string[]): Record<Pure9Field, string | undefined> {
  return Object.fromEntries(
    (Object.entries(PURE9_FIELDS) as [Pure9Field, readonly string[]][]).map(([field, aliases]) => [
      field,
      headers.find((header) => aliases.some((alias) => header.trim().toLowerCase() === alias.toLowerCase())),
    ]),
  ) as Record<Pure9Field, string | undefined>;
}

function findFreeFileHeader(headers: string[]): string | undefined {
  return headers.find((header) =>
    /^vrij bestand 0?(?:[1-9]|10)$/i.test(header.trim()) || header.trim().toLowerCase() === "omschrijving",
  );
}

function isMondayDate(value: Cell): boolean {
  const formatted = formatDate(value);
  if (!formatted) return false;
  const [day, month, year] = formatted.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() === 1;
}

function matrixToTable(fileName: string, matrix: Cell[][]): ParsedTable {
  if (!matrix.length) throw new Error("Het bestand is leeg.");
  const headers = matrix[0].map((value) => textValue(value).replace(/^\uFEFF/, "").trim());
  if (!headers.some(Boolean)) throw new Error("De eerste rij bevat geen kolomnamen.");
  const rows = matrix.slice(1)
    .filter((cells) => cells.some((value) => textValue(value) !== ""))
    .map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
  return { fileName, headers, rows };
}

function validateHeaders(table: ParsedTable, required: readonly string[], label: string, errors: string[]) {
  const missing = required.filter((header) => !table.headers.includes(header));
  if (missing.length) errors.push(`${label}: ontbrekende kolommen: ${missing.join(", ")}.`);
}

function textValue(value: Cell): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeGuid(value: Cell): string {
  return textValue(value).replace(/[{}]/g, "").toLowerCase();
}

function parseNumber(value: Cell): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = textValue(value).replace(/\s/g, "").replace(",", ".");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDate(value: Cell): string {
  let year: number | null = null;
  let month: number | null = null;
  let day: number | null = null;
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    year = value.getUTCFullYear(); month = value.getUTCMonth() + 1; day = value.getUTCDate();
  } else if (typeof value === "number") {
    const parsed = SSF.parse_date_code(value);
    if (parsed) { year = parsed.y; month = parsed.m; day = parsed.d; }
  } else {
    const raw = textValue(value);
    const dutch = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    const iso = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (dutch) { day = Number(dutch[1]); month = Number(dutch[2]); year = Number(dutch[3]); }
    else if (iso) { year = Number(iso[1]); month = Number(iso[2]); day = Number(iso[3]); }
    else if (/^\d+(?:[.,]\d+)?$/.test(raw)) {
      const parsed = SSF.parse_date_code(Number(raw.replace(",", ".")));
      if (parsed) { year = parsed.y; month = parsed.m; day = parsed.d; }
    }
  }
  if (!year || !month || !day || month > 12 || day > 31) return "";
  return `${String(day).padStart(2, "0")}-${String(month).padStart(2, "0")}-${year}`;
}

function formatTime(value: Cell): string {
  if (value === null || value === undefined || textValue(value) === "") return "";
  if (value instanceof Date) {
    return `${String(value.getUTCHours()).padStart(2, "0")}:${String(value.getUTCMinutes()).padStart(2, "0")}`;
  }
  if (typeof value === "string" && /^\d{1,2}:\d{2}/.test(value.trim())) {
    const [hours, minutes] = value.trim().split(":");
    return `${hours.padStart(2, "0")}:${minutes.slice(0, 2)}`;
  }
  const numeric = parseNumber(value);
  if (numeric === null) return "";
  const minutes = Math.round((((numeric % 1) + 1) % 1) * 24 * 60);
  return `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function formatAmount(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(10).replace(/0+$/, "").replace(/\.$/, "").replace(".", ",");
}

function toCsv(rows: string[][]): string {
  const lines = [PURE10_COLUMNS as readonly string[], ...rows].map((row) => row.map(escapeCsv).join(";"));
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

function escapeCsv(value: string): string {
  return /[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const candidates = [";", "\t", ","];
  return candidates.map((delimiter) => ({ delimiter, count: countOutsideQuotes(firstLine, delimiter) }))
    .sort((a, b) => b.count - a.count)[0]?.delimiter ?? ";";
}

function countOutsideQuotes(line: string, delimiter: string): number {
  let quoted = false;
  let count = 0;
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '"') quoted = !quoted;
    else if (!quoted && line[index] === delimiter) count += 1;
  }
  return count;
}

function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      row.push(value); value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value); rows.push(row); row = []; value = "";
    } else value += character;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows;
}
