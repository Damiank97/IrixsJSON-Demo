export type ValidityCombination = {
  employee: string;
  project: string;
  declarationType: string;
  startDate: string;
  endDate: string;
};

export const DEMO_COMBINATIONS: ValidityCombination[] = [
  { employee: "ALLARDJ", project: "300000", declarationType: "K01", startDate: "2026-01-01", endDate: "" },
  { employee: "ALLARDJ", project: "300000", declarationType: "ZK", startDate: "2026-01-01", endDate: "" },
  { employee: "ALLARDJ", project: "PRJ-2026-01", declarationType: "K01", startDate: "2026-01-01", endDate: "" },
  { employee: "ALLARDJ", project: "PRJ-2026-01", declarationType: "ZK", startDate: "2026-01-01", endDate: "" },
  { employee: "ALLARDJ", project: "PRJ-2026-02", declarationType: "OV", startDate: "2026-10-01", endDate: "2026-10-31" },
];

export function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}

// Lege waarden zijn bewuste AFAS-wildcards. Ontbrekende kolommen zijn een fout.
export function matchesCombination(combination: ValidityCombination, employee: string, date: string, declarationType?: string, project?: string): boolean {
  const matches = (rule: string, value: string | undefined) => value === undefined || !rule || rule.toUpperCase() === value.toUpperCase();
  return validDate(date) && matches(combination.employee, employee)
    && (!combination.startDate || date >= combination.startDate)
    && (!combination.endDate || date <= combination.endDate)
    && matches(combination.declarationType, declarationType)
    && matches(combination.project, project);
}

export function parseCombinations(rows: Record<string, unknown>[], fields?: Partial<Record<keyof ValidityCombination, string>>): ValidityCombination[] {
  if (!rows.length) return [];
  const columns: Record<keyof ValidityCombination, string> = {
    employee: "Medewerker", project: "Project", declarationType: "Declaratiesoort", startDate: "Begindatum", endDate: "Einddatum", ...fields,
  };
  return rows.map((row, index) => {
    const result = {} as ValidityCombination;
    for (const key of Object.keys(columns) as (keyof ValidityCombination)[]) {
      const column = columns[key];
      if (!Object.prototype.hasOwnProperty.call(row, column)) throw new Error(`Regel ${index + 2}: kolom '${column}' ontbreekt. Gebruik uitgewerkte combinaties met Medewerker, Project, Declaratiesoort, Begindatum en Einddatum.`);
      const value = row[column];
      result[key] = value == null ? "" : String(value).trim();
      if (key === "startDate" || key === "endDate") {
        if (/^\d{4}-\d{2}-\d{2}T/.test(result[key])) result[key] = result[key].slice(0, 10);
        if (result[key] && !validDate(result[key])) throw new Error(`Regel ${index + 2}: ${column} moet JJJJ-MM-DD zijn.`);
      }
    }
    if (result.startDate && result.endDate && result.startDate > result.endDate) throw new Error(`Regel ${index + 2}: einddatum ligt vóór begindatum.`);
    return result;
  });
}
