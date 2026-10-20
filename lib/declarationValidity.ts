import { validDate } from "./declarationRules";
export type Basis = "employee" | "function" | "project" | "projectGroup" | "item" | "integrationGroup";
export const BASIS_LABELS: Record<Basis, string> = { employee: "Medewerker", function: "Functie", project: "Project", projectGroup: "Projectgroep", item: "Item (type + kostensoort)", integrationGroup: "Integratiegroep" };
type Period = {
    startDate: string;
    endDate: string;
};
export type DemoEmployee = {
    code: string;
    label: string;
    functionCode: string;
    canDeclare: boolean;
};
export type ValidityProject = {
    code: string;
    label: string;
    group: string;
    teamOnly: boolean;
    blocked: boolean;
};
export type DeclarationType = {
    code: string;
    label: string;
    kind: "kosten" | "kilometers";
    itemCode: string;
    itemType: "Kst";
    integrationGroup: string;
    projectRequired: boolean;
    blocked: boolean;
    decimals: number;
};
export type GroundRule = Period & {
    id: string;
    values: string[];
};
export type ValidityModel = {
    version: 1;
    enabled: boolean;
    bases: Basis[];
    rules: GroundRule[];
    employees: DemoEmployee[];
    projects: ValidityProject[];
    declarationTypes: DeclarationType[];
    teams: (Period & {
        employee: string;
        project: string;
    })[];
};
export type ValidityInput = {
    employee: string;
    date: string;
    declarationType?: string;
    project?: string;
};
export type ValidityCheck = {
    label: string;
    passed: boolean;
    detail: string;
};
export type ValidityResult = {
    allowed: boolean;
    reason: string;
    checks: ValidityCheck[];
    ruleId?: string;
    values: Partial<Record<Basis, string>>;
};
const code = (value: string) => value.trim().toUpperCase();
const inPeriod = (period: Period, date: string) => (!period.startDate || date >= period.startDate) && (!period.endDate || date <= period.endDate);
// This is a documented subset, not an implementation of all AFAS permissions.
// Declaration code BiId and underlying cost-item code are deliberately separate.
export function checkValidity(model: ValidityModel, input: ValidityInput): ValidityResult {
    const checks: ValidityCheck[] = [], values: Partial<Record<Basis, string>> = {};
    const fail = (reason: string): ValidityResult => ({ allowed: false, reason, checks, values });
    if (!validDate(input.date))
        return fail("Kies een geldige declaratiedatum.");
    checks.push({ label: "Datum", passed: true, detail: input.date });
    const employee = model.employees.find(e => code(e.code) === code(input.employee));
    checks.push({ label: "Medewerker en declaratierecht", passed: !!employee?.canDeclare, detail: employee ? `${employee.code} · ${employee.canDeclare ? "mag declareren in dit demoprofiel" : "geen declaratierecht in dit demoprofiel"}` : "Onbekende medewerker" });
    if (!employee?.canDeclare)
        return fail("Deze medewerker heeft in het demoprofiel geen declaratierecht.");
    values.employee = employee.code;
    values.function = employee.functionCode;
    const type = input.declarationType === undefined ? undefined : model.declarationTypes.find(t => code(t.code) === code(input.declarationType!));
    if (input.declarationType !== undefined) {
        checks.push({ label: "Declaratiesoort → kostensoort", passed: !!type && !type.blocked, detail: type ? `${type.code} → ${type.itemType}:${type.itemCode} → ${type.integrationGroup}${type.blocked ? " · geblokkeerd" : ""}` : "Kies een bestaande declaratiesoort" });
        if (!type || type.blocked)
            return fail("Deze declaratiesoort bestaat niet of is geblokkeerd.");
        values.item = `${type.itemType}:${type.itemCode}`;
        values.integrationGroup = type.integrationGroup;
    }
    const project = input.project ? model.projects.find(p => code(p.code) === code(input.project!)) : undefined;
    if (input.project !== undefined) {
        if (!input.project && type?.projectRequired)
            return fail("Voor deze declaratiesoort is een project verplicht.");
        checks.push({ label: "Project", passed: input.project === "" || !!project && !project.blocked, detail: project ? `${project.code} · projectgroep ${project.group}${project.blocked ? " · geblokkeerd" : ""}` : input.project ? "Onbekend project" : "Geen project" });
        if (input.project && (!project || project.blocked))
            return fail("Dit project bestaat niet of is geblokkeerd.");
        values.project = project?.code ?? "";
        values.projectGroup = project?.group ?? "";
        if (project?.teamOnly) {
            const member = model.teams.some(t => code(t.employee) === code(employee.code) && code(t.project) === code(project.code) && inPeriod(t, input.date));
            checks.push({ label: "Aanvullende teamcontrole", passed: member, detail: member ? "Teamlid op de declaratiedatum" : "Alleen teamleden mogen op dit project boeken; geen geldig lidmaatschap op deze datum" });
            if (!member)
                return fail("Geen geldig projectteamlidmaatschap op deze datum. Een geldigheidscombinatie heft de teambeperking niet op.");
        }
    }
    if (!model.enabled) {
        checks.push({ label: "Geldigheidscombinaties", passed: true, detail: "Niet ingericht; de stamgegevens- en teamcontroles blijven gelden" });
        return { allowed: true, reason: "Geen geldigheidscombinaties ingericht; overige democontroles geslaagd.", checks, values };
    }
    const matched = model.rules.find(rule => inPeriod(rule, input.date) && model.bases.every((basis, index) => values[basis] === undefined || !rule.values[index] || code(rule.values[index]) === code(values[basis]!)));
    checks.push({ label: "Grondslagen en geldigheidsperiode", passed: !!matched, detail: matched ? `${matched.id} · ${matched.startDate || "geen begindatum"} t/m ${matched.endDate || "geen einddatum"}` : "Geen actieve regel met alle geselecteerde grondslagen; lege grondslagwaarden zijn wildcards" });
    return matched ? { allowed: true, reason: `Toegestaan via ${matched.id}.`, checks, values, ruleId: matched.id } : fail("Geen juiste geldigheidscombinatie voor deze datum en selectie.");
}
// An option is shown only if there is at least one COMPLETE permitted booking.
// This prevents dangling types that have matching rules but no accessible project.
export function allowedDeclarationTypes(model: ValidityModel, employee: string, date: string): DeclarationType[] {
    return model.declarationTypes.filter(type => [...model.projects.map(p => p.code), ...(!type.projectRequired ? [""] : [])].some(project => checkValidity(model, { employee, date, declarationType: type.code, project }).allowed));
}
export function allowedProjects(model: ValidityModel, employee: string, date: string, declarationType: string): ValidityProject[] {
    return model.projects.filter(project => checkValidity(model, { employee, date, declarationType, project: project.code }).allowed);
}
export type DemoProfile = "groups" | "individual" | "function" | "disabled";
export function demoValidityModel(profile: DemoProfile = "groups"): ValidityModel {
    const period = { startDate: "2026-01-01", endDate: "" };
    const model: ValidityModel = { version: 1, enabled: profile !== "disabled", bases: ["projectGroup", "integrationGroup"], rules: [], employees: [
            { code: "ALLARDJ", label: "Allard Jansen (demo)", functionCode: "CONSULTANT", canDeclare: true },
            { code: "MARA", label: "Mara de Vries (demo)", functionCode: "ENGINEER", canDeclare: true },
            { code: "GEENRECHT", label: "Sam zonder declaratierecht (demo)", functionCode: "CONSULTANT", canDeclare: false },
        ], projects: [
            { code: "300000", label: "Intern project", group: "INT", teamOnly: false, blocked: false },
            { code: "PRJ-2026-01", label: "Implementatie · teamproject", group: "CONS", teamOnly: true, blocked: false },
            { code: "PRJ-2026-02", label: "Procesoptimalisatie · ander team", group: "CONS", teamOnly: true, blocked: false },
            { code: "PRJ-GEBLOKKEERD", label: "Afgerond project · geblokkeerd", group: "CONS", teamOnly: false, blocked: true },
        ], declarationTypes: [
            { code: "K01", label: "Overige kosten", kind: "kosten", itemCode: "KOST-ALG", itemType: "Kst", integrationGroup: "ALG", projectRequired: true, blocked: false, decimals: 2 },
            { code: "ZK", label: "Zakelijke kilometers", kind: "kilometers", itemCode: "KM-ZAK", itemType: "Kst", integrationGroup: "REIS", projectRequired: true, blocked: false, decimals: 3 },
            { code: "OV", label: "Openbaar vervoer · tijdelijk", kind: "kosten", itemCode: "OV-KOST", itemType: "Kst", integrationGroup: "OV", projectRequired: true, blocked: false, decimals: 2 },
            { code: "VERVALLEN", label: "Vervallen kostensoort", kind: "kosten", itemCode: "OUD", itemType: "Kst", integrationGroup: "ALG", projectRequired: true, blocked: true, decimals: 2 },
        ], teams: [
            { employee: "ALLARDJ", project: "PRJ-2026-01", ...period },
            { employee: "MARA", project: "PRJ-2026-02", ...period },
            { employee: "MARA", project: "PRJ-2026-01", startDate: "2026-10-15", endDate: "2026-12-31" },
        ] };
    if (profile === "individual") {
        model.bases = ["employee", "project", "item"];
        model.rules = [
            { id: "PERS-KM-INT", values: ["ALLARDJ", "300000", "Kst:KM-ZAK"], ...period },
            { id: "PERS-KM-PRJ", values: ["ALLARDJ", "PRJ-2026-01", "Kst:KM-ZAK"], ...period },
            { id: "PERS-KOST", values: ["", "", "Kst:KOST-ALG"], ...period },
            { id: "PERS-OV", values: ["", "PRJ-2026-01", "Kst:OV-KOST"], startDate: "2026-10-01", endDate: "2026-10-15" },
        ];
    }
    else if (profile === "function") {
        model.bases = ["function", "projectGroup", "integrationGroup"];
        model.rules = [{ id: "FUN-CONS-REIS", values: ["CONSULTANT", "CONS", "REIS"], ...period }, { id: "FUN-KOST", values: ["", "", "ALG"], ...period }];
    }
    else if (profile !== "disabled") {
        model.rules = [{ id: "GROEP-KOST", values: ["", "ALG"], ...period }, { id: "GROEP-REIS-INT", values: ["INT", "REIS"], ...period }, { id: "GROEP-REIS-CONS", values: ["CONS", "REIS"], ...period }, { id: "GROEP-OV-TIJDELIJK", values: ["CONS", "OV"], startDate: "2026-10-01", endDate: "2026-10-15" }];
    }
    return model;
}
export function parseValidityModel(value: unknown): ValidityModel {
    if (!value || typeof value !== "object")
        throw new Error("Het grondslagenmodel ontbreekt.");
    const m = value as ValidityModel;
    if (m.version !== 1 || typeof m.enabled !== "boolean" || !Array.isArray(m.bases) || m.bases.length > 3 || m.enabled && !m.bases.length || new Set(m.bases).size !== m.bases.length || m.bases.some(b => !Object.hasOwn(BASIS_LABELS, b)))
        throw new Error("Gebruik maximaal drie verschillende, aansluitende ondersteunde grondslagen. Dimensies moeten eerst in de GetConnector worden uitgewerkt.");
    const arrays = [m.rules, m.employees, m.projects, m.declarationTypes, m.teams];
    if (arrays.some(a => !Array.isArray(a) || a.length > 50000) || JSON.stringify(m).length > 3000000)
        throw new Error("Ongeldig of te groot grondslagenmodel.");
    const string = (v: unknown, empty = false) => typeof v === "string" && (empty || !!v.trim()) && v.length <= 255;
    const checkPeriod = (r: Period) => string(r.startDate, true) && string(r.endDate, true) && (!r.startDate || validDate(r.startDate)) && (!r.endDate || validDate(r.endDate)) && (!r.startDate || !r.endDate || r.startDate <= r.endDate);
    for (const entries of [m.rules.map(r => r.id), m.employees.map(e => e.code), m.projects.map(p => p.code), m.declarationTypes.map(t => t.code)])
        if (entries.some(v => !string(v)) || new Set(entries.map(code)).size !== entries.length)
            throw new Error("Het model bevat lege of dubbele codes.");
    if (m.rules.some(r => !Array.isArray(r.values) || r.values.length !== m.bases.length || r.values.some(v => !string(v, true)) || !checkPeriod(r)))
        throw new Error("Elke regel vereist precies de ingerichte grondslagen en geldige begin-/einddatums.");
    if (m.employees.some(e => !string(e.label) || !string(e.functionCode) || typeof e.canDeclare !== "boolean") || m.projects.some(p => !string(p.label) || !string(p.group) || typeof p.teamOnly !== "boolean" || typeof p.blocked !== "boolean") || m.declarationTypes.some(t => !string(t.label) || !string(t.itemCode) || t.itemType !== "Kst" || !string(t.integrationGroup) || !["kosten", "kilometers"].includes(t.kind) || typeof t.projectRequired !== "boolean" || typeof t.blocked !== "boolean" || !Number.isInteger(t.decimals) || t.decimals < 0 || t.decimals > 6))
        throw new Error("Stamgegevens, kostensoortkoppeling of afronding ontbreken in het model.");
    if (m.teams.some(t => !m.employees.some(e => code(e.code) === code(t.employee)) || !m.projects.some(p => code(p.code) === code(t.project)) || !checkPeriod(t)))
        throw new Error("Ongeldig teamlidmaatschap.");
    return m;
}
