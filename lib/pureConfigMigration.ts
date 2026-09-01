import { pure10StandardSettings } from "../data/pure10StandardSettings";

export type Pure9Setting = {
  key: string;
  value: string;
};

export type Pure9Config = {
  fileName: string;
  settings: Pure9Setting[];
};

export type Pure10ConfigItem = {
  key: string;
  value: string;
  label: null;
  content_type: string;
  tags: Record<string, never>;
};

export type ConfigMapping = {
  sourceKey: string;
  sourceValue: string;
  targetKey: string;
  targetValue: string;
  origin: "PURE 9" | "Berekend" | "PURE 10-standaard";
  note: string;
};

export type ConfigMigrationResult = {
  items: Pure10ConfigItem[];
  mappings: ConfigMapping[];
  errors: string[];
  warnings: string[];
  unmapped: Pure9Setting[];
  stats: {
    sourceKeys: number;
    generatedKeys: number;
    mappedSourceKeys: number;
    unmappedSourceKeys: number;
    planningTypes: number;
    standardKeys: number;
  };
  highlights: {
    projectTemplate: string;
    employeeTemplate: string;
    useBudgetValidation: string;
    useRealisation: string;
    viewerGroup: string;
    projectManagerGroup: string;
    adminGroup: string;
    plannerGroup: string;
  };
};

type TargetSetting = {
  value: string;
  sourceKey: string;
  sourceValue: string;
  origin: ConfigMapping["origin"];
  note: string;
};

const KNOWN_SOURCE_KEYS = new Set([
  "ApplicationLicense",
  "ApplicationEmployeeDisplayNameFormat",
  "ApplicationExtendedProjectDisplayNameFormat",
  "ContextUrlsProjectRow",
  "ApplicationIgnoreBudgets",
  "ApplicationPlanningEnableRequirement",
  "ApplicationPlanningUseRealizationForDayLevelPlanning",
  "ApplicationPlanningShowAbsence",
  "PlanningBudgetRowColors",
  "PlanningEmployeeRowColors",
  "HourTypes",
  "ApplicationHourInputRemarksType",
  "ApplicationHourInputRequireDescription",
  "ApplicationPlanningMilestoneTypes",
  "ApplicationPlanningDaysNumberOptions",
  "ApplicationPlanningDayLevelAmount",
  "ApplicationPlanningWeeksNumberOptions",
  "ApplicationPlanningWeekLevelAmount",
  "AuthorisationGroupViewer",
  "AuthorisationGroupProjectManager",
  "AuthorisationGroupAdmin",
  "AuthorisationGroupPlanner",
  "ApplicationEmployeesCanApproveOccupations",
  "ApplicationProjectManagersCanApproveOccupations",
  "ApplicationProjectPlannersCanApproveOccupations",
]);

const NAMED_COLORS: Record<string, string> = {
  aquamarine: "#7FFFD4",
  black: "#000000",
  blue: "#0000FF",
  burlywood: "#DEB887",
  darkorange: "#FF8C00",
  gray: "#808080",
  grey: "#808080",
  green: "#008000",
  mediumorchid: "#BA55D3",
  orange: "#FFA500",
  pink: "#FFC0CB",
  purple: "#800080",
  red: "#FF0000",
  skyblue: "#87CEEB",
  slategrey: "#708090",
  slategray: "#708090",
  white: "#FFFFFF",
  yellow: "#FFFF00",
};

export async function readPure9Config(file: File): Promise<Pure9Config> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !["config", "xml", "txt"].includes(extension)) {
    throw new Error("Gebruik het PURE 9 app.config-, XML- of tekstbestand.");
  }
  return parsePure9Xml(await file.text(), file.name);
}

export function parsePure9Xml(xml: string, fileName = "PURE9_app.config"): Pure9Config {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.querySelector("parsererror")) {
    throw new Error("Het bestand bevat geen geldige XML.");
  }
  const settings = Array.from(document.querySelectorAll("appSettings > add"))
    .map((node) => ({ key: node.getAttribute("key")?.trim() ?? "", value: node.getAttribute("value") ?? "" }))
    .filter((setting) => setting.key);
  if (!settings.length) throw new Error("Geen appSettings/add-instellingen gevonden.");

  const duplicates = settings
    .map((setting) => setting.key)
    .filter((key, index, keys) => keys.indexOf(key) !== index);
  if (duplicates.length) {
    throw new Error(`Dubbele PURE 9-key gevonden: ${Array.from(new Set(duplicates)).join(", ")}.`);
  }
  return { fileName, settings };
}

export function migratePure9Config(source: Pure9Config, rawPrefix: string): ConfigMigrationResult {
  const prefix = normalizePrefix(rawPrefix);
  const errors: string[] = [];
  const warnings: string[] = [];
  const targets = new Map<string, TargetSetting>();
  const sourceValues = new Map(source.settings.map((setting) => [setting.key, setting.value]));

  const setTarget = (
    suffix: string,
    value: string,
    origin: ConfigMapping["origin"],
    sourceKey = "",
    sourceValue = "",
    note = "",
  ) => {
    targets.set(suffix, { value, sourceKey, sourceValue, origin, note });
  };

  const get = (key: string) => sourceValues.get(key)?.trim() ?? "";
  const has = (key: string) => sourceValues.has(key);

  for (const item of pure10StandardSettings.items) {
    setTarget(item.key, item.value, "PURE 10-standaard", "", "", "Neutrale PURE 10-basiswaarde.");
  }

  const license = get("ApplicationLicense");
  setTarget("App:License", license, "PURE 9", "ApplicationLicense", license, "Licentie één-op-één overgenomen.");
  if (!license) warnings.push("ApplicationLicense is leeg in PURE 9.");

  const employeeSource = get("ApplicationEmployeeDisplayNameFormat");
  const employeeTemplate = mapEmployeeTemplate(employeeSource, warnings);
  setTarget(
    "Employee:DisplayNameTemplate",
    employeeTemplate,
    employeeSource ? "Berekend" : "PURE 10-standaard",
    "ApplicationEmployeeDisplayNameFormat",
    employeeSource,
    employeeSource ? "Alleen ondersteunde PURE 10-velden blijven staan." : "PURE 10-standaard omdat PURE 9 leeg is.",
  );

  const projectSource = get("ApplicationExtendedProjectDisplayNameFormat");
  setTarget(
    "Project:DisplayNameTemplate",
    "{Id}: {Name}",
    projectSource ? "Berekend" : "PURE 10-standaard",
    "ApplicationExtendedProjectDisplayNameFormat",
    projectSource,
    "PURE 9-klantvelden worden niet letterlijk in de PURE 10-weergave gezet.",
  );

  const projectUrl = cleanProjectUrl(get("ContextUrlsProjectRow"));
  if (projectUrl) {
    setTarget("Project:UrlTemplate", projectUrl, "Berekend", "ContextUrlsProjectRow", get("ContextUrlsProjectRow"), "{0} is vervangen door {Id}.");
  }

  const ignoreBudgets = parseBoolean(get("ApplicationIgnoreBudgets"), false, "ApplicationIgnoreBudgets", errors);
  setTarget(
    "Planning:UseBudgetValidation",
    String(!ignoreBudgets),
    "Berekend",
    "ApplicationIgnoreBudgets",
    get("ApplicationIgnoreBudgets"),
    "UseBudgetValidation is het omgekeerde van ApplicationIgnoreBudgets.",
  );

  setBooleanFromPure9(
    "ApplicationPlanningEnableRequirement",
    "Planning:UseRequirement",
    false,
    "Ontbrekend of leeg wordt veilig false.",
  );
  setBooleanFromPure9(
    "ApplicationPlanningUseRealizationForDayLevelPlanning",
    "Planning:UseRealisation",
    false,
    "Ontbrekend of leeg wordt veilig false; er wordt geen klantwaarde geleend.",
  );

  const showAbsence = has("ApplicationPlanningShowAbsence")
    ? parseBoolean(get("ApplicationPlanningShowAbsence"), true, "ApplicationPlanningShowAbsence", errors)
    : true;
  setTarget("Employee:Colors:Absent:IsEnabled", String(showAbsence), has("ApplicationPlanningShowAbsence") ? "PURE 9" : "PURE 10-standaard", "ApplicationPlanningShowAbsence", get("ApplicationPlanningShowAbsence"));
  setTarget("Employee:Colors:OnLeave:IsEnabled", String(showAbsence), has("ApplicationPlanningShowAbsence") ? "PURE 9" : "PURE 10-standaard", "ApplicationPlanningShowAbsence", get("ApplicationPlanningShowAbsence"));

  mapColorLevels(
    get("PlanningBudgetRowColors"),
    "PlanningBudgetRowColors",
    "Planning:Colors:AllocationLevels",
    false,
  );
  mapColorLevels(
    get("PlanningEmployeeRowColors"),
    "PlanningEmployeeRowColors",
    "Employee:Colors:OccupancyLevels",
    true,
  );
  mapHourTypes(get("HourTypes"));

  const remarksType = get("ApplicationHourInputRemarksType") || "1";
  setTarget(
    "Planning:Fields:CommentsInternal:IsEnabled",
    String(["2", "3", "4"].includes(remarksType)),
    "Berekend",
    "ApplicationHourInputRemarksType",
    get("ApplicationHourInputRemarksType"),
    `PURE 9 RemarksType ${remarksType}.`,
  );
  setBooleanFromPure9(
    "ApplicationHourInputRequireDescription",
    "Planning:Fields:Comments:IsRequired",
    false,
    "Ontbrekend of leeg wordt false.",
  );

  mapPeriod("Day", "ApplicationPlanningDaysNumberOptions", "ApplicationPlanningDayLevelAmount", false);
  mapPeriod("Week", "ApplicationPlanningWeeksNumberOptions", "ApplicationPlanningWeekLevelAmount", true);

  if (get("ApplicationPlanningMilestoneTypes")) {
    warnings.push("Milestonetypes zijn niet naar PURE 10 gemapt; deze functie bestaat daar niet op dezelfde manier.");
  }

  applyAuthorisation();

  for (const [suffix, setting] of targets) {
    if (/:(Color|ColorText)$/.test(suffix)) {
      const normalized = normalizeColor(setting.value);
      if (!normalized) {
        errors.push(`${setting.sourceKey || suffix}: '${setting.value}' is geen geldige kleur.`);
      } else {
        targets.set(suffix, { ...setting, value: normalized });
      }
    }
  }

  const mappings = Array.from(targets.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([suffix, setting]) => ({
      sourceKey: setting.sourceKey,
      sourceValue: setting.sourceValue,
      targetKey: `${prefix}:${suffix}`,
      targetValue: setting.value,
      origin: setting.origin,
      note: setting.note,
    }));

  const items = mappings.map<Pure10ConfigItem>((mapping) => ({
    key: mapping.targetKey,
    value: mapping.targetValue,
    label: null,
    content_type: "",
    tags: {},
  }));
  const unmapped = source.settings.filter((setting) => !KNOWN_SOURCE_KEYS.has(setting.key));
  const mappedSourceKeys = source.settings.length - unmapped.length;
  const planningTypes = items.filter((item) => /:Planning:Types:\d+:Id$/.test(item.key)).length;
  const standardKeys = mappings.filter((mapping) => mapping.origin === "PURE 10-standaard").length;

  return {
    items,
    mappings,
    errors: Array.from(new Set(errors)),
    warnings: Array.from(new Set(warnings)),
    unmapped,
    stats: {
      sourceKeys: source.settings.length,
      generatedKeys: items.length,
      mappedSourceKeys,
      unmappedSourceKeys: unmapped.length,
      planningTypes,
      standardKeys,
    },
    highlights: {
      projectTemplate: targets.get("Project:DisplayNameTemplate")?.value ?? "",
      employeeTemplate: targets.get("Employee:DisplayNameTemplate")?.value ?? "",
      useBudgetValidation: targets.get("Planning:UseBudgetValidation")?.value ?? "",
      useRealisation: targets.get("Planning:UseRealisation")?.value ?? "",
      viewerGroup: targets.get("Authorisation:Roles:0:Name")?.value ?? "",
      projectManagerGroup: targets.get("Authorisation:Roles:2:Name")?.value ?? "",
      adminGroup: targets.get("Authorisation:Roles:3:Name")?.value ?? "",
      plannerGroup: targets.get("Authorisation:Roles:4:Name")?.value ?? "",
    },
  };

  function setBooleanFromPure9(sourceKey: string, targetSuffix: string, fallback: boolean, note: string) {
    const value = parseBoolean(get(sourceKey), fallback, sourceKey, errors);
    setTarget(targetSuffix, String(value), has(sourceKey) && get(sourceKey) ? "PURE 9" : "Berekend", sourceKey, get(sourceKey), note);
  }

  function mapColorLevels(raw: string, sourceKey: string, targetRoot: string, includeText: boolean) {
    if (!raw) {
      errors.push(`${sourceKey} is leeg; de kleuren kunnen niet worden opgebouwd.`);
      return;
    }
    const rows = raw.split(";").map((part) => part.trim()).filter(Boolean);
    let validRows = 0;
    rows.forEach((row) => {
      const parts = row.split(",").map((part) => part.trim());
      if (parts.length < 2 || !parts[0] || !parts[1]) {
        warnings.push(`${sourceKey}: los onderdeel '${row}' is overgeslagen omdat percentage of kleur ontbreekt.`);
        return;
      }
      const targetIndex = validRows;
      validRows += 1;
      setTarget(`${targetRoot}:${targetIndex}:Color`, parts[1], "PURE 9", sourceKey, raw, "Kleur uit PURE 9; wordt naar HEX genormaliseerd.");
      setTarget(`${targetRoot}:${targetIndex}:PercentageStart`, parts[0], "PURE 9", sourceKey, raw, "Grenspercentage uit PURE 9.");
      if (includeText) {
        const textColor = parts[2] && normalizeColor(parts[2]) ? parts[2] : "black";
        if (parts[2] && !normalizeColor(parts[2])) {
          warnings.push(`${sourceKey}: tekstkleur '${parts[2]}' is ongeldig; #000000 wordt gebruikt.`);
        }
        setTarget(`${targetRoot}:${targetIndex}:ColorText`, textColor, parts[2] ? "Berekend" : "PURE 10-standaard", sourceKey, raw, parts[2] ? "Tekstkleur uit PURE 9 of veilige fallback." : "Ontbrekende tekstkleur wordt zwart.");
      }
    });
    if (!validRows) errors.push(`${sourceKey} bevat geen enkele geldige kleurregel.`);
  }

  function mapHourTypes(raw: string) {
    if (!raw) {
      warnings.push("HourTypes is leeg; één planningstype 'Standaard' is toegevoegd.");
      addType(0, ["1", "Standaard", "#FFFFFF", "1"], "PURE 10-standaard", "");
      return;
    }
    const rows = raw.split(";").map((part) => part.trim()).filter(Boolean);
    rows.forEach((row, index) => {
      const parts = row.split(",").map((part) => part.trim());
      if (parts.length < 4 || parts.slice(0, 4).some((part) => !part)) {
        errors.push(`HourTypes: onderdeel '${row}' moet Id, naam, kleur en uurtype bevatten.`);
        return;
      }
      addType(index, parts, "PURE 9", raw);
    });
  }

  function addType(index: number, parts: string[], origin: ConfigMapping["origin"], sourceValue: string) {
    setTarget(`Planning:Types:${index}:Id`, parts[0], origin, "HourTypes", sourceValue);
    setTarget(`Planning:Types:${index}:Name`, parts[1], origin, "HourTypes", sourceValue);
    setTarget(`Planning:Types:${index}:Color`, parts[2], origin, "HourTypes", sourceValue, "Kleur wordt naar HEX genormaliseerd.");
    setTarget(`Planning:Types:${index}:HourType`, parts[3], origin, "HourTypes", sourceValue);
  }

  function mapPeriod(type: "Day" | "Week", optionsKey: string, amountKey: string, enabledFallback: boolean) {
    const options = get(optionsKey);
    const amount = get(amountKey);
    const values = options
      ? options.split(",").map((value) => value.trim()).filter(Boolean)
      : amount && amount !== "0" ? [amount] : [];
    const enabled = values.length > 0 ? true : has(optionsKey) || has(amountKey) ? false : enabledFallback;
    const sourceKey = options ? optionsKey : amountKey;
    const sourceValue = options || amount;
    setTarget(`Planning:PeriodTypes:${type}:Enabled`, String(enabled), sourceValue ? "PURE 9" : "Berekend", sourceKey, sourceValue, sourceValue ? "Niveau en opties uit PURE 9." : "Veilige PURE 10-standaard.");

    if (values.length) {
      for (const suffix of Array.from(targets.keys())) {
        if (suffix.startsWith(`Planning:PeriodTypes:${type}:DisplayNumberOptions:`)) targets.delete(suffix);
      }
      values.forEach((value, index) => {
        setTarget(`Planning:PeriodTypes:${type}:DisplayNumberOptions:${index}`, value, "PURE 9", sourceKey, sourceValue);
      });
    }
  }

  function applyAuthorisation() {
    const roleGroups: Array<[number, string, string]> = [
      [0, "AuthorisationGroupViewer", "Iedereen"],
      [2, "AuthorisationGroupProjectManager", ""],
      [3, "AuthorisationGroupAdmin", ""],
      [4, "AuthorisationGroupPlanner", ""],
    ];
    for (const [role, sourceKey, fallback] of roleGroups) {
      const sourceValue = normalizeGroup(get(sourceKey));
      const value = sourceValue || fallback;
      setTarget(`Authorisation:Roles:${role}:Name`, value, sourceValue ? "PURE 9" : "Berekend", sourceKey, get(sourceKey), sourceValue ? "AFAS-groep uit PURE 9." : "PURE 9-groep is leeg; veilige fallback toegepast.");
      if (role > 1 && value.toLowerCase() === "iedereen") {
        const label = role === 2 ? "Projectleider" : role === 3 ? "Manager/Admin" : "Planner";
        warnings.push(`${label} is in PURE 9 gekoppeld aan 'Iedereen'. Daardoor krijgt iedereen deze rol ook in PURE 10.`);
      } else if (role > 1 && !value) {
        warnings.push(`Autorisatiegroep ${sourceKey} is leeg; controleer deze rol na import.`);
      }
    }

    const approvalMappings: Array<[number, string]> = [
      [1, "ApplicationEmployeesCanApproveOccupations"],
      [2, "ApplicationProjectManagersCanApproveOccupations"],
      [4, "ApplicationProjectPlannersCanApproveOccupations"],
    ];
    for (const [role, sourceKey] of approvalMappings) {
      const value = parseBoolean(get(sourceKey), false, sourceKey, errors);
      setTarget(`Authorisation:Roles:${role}:Planning:Day:AllowApprove`, String(value), has(sourceKey) && get(sourceKey) ? "PURE 9" : "Berekend", sourceKey, get(sourceKey), "Ontbrekend of leeg wordt false.");
    }
  }
}

export function serializePure10Config(result: ConfigMigrationResult): string {
  return JSON.stringify({ items: result.items }, null, 2);
}

export function serializeConfigReport(source: Pure9Config, prefix: string, result: ConfigMigrationResult): string {
  return JSON.stringify({
    sourceFile: source.fileName,
    prefix: normalizePrefix(prefix),
    stats: result.stats,
    warnings: result.warnings,
    errors: result.errors,
    highlights: result.highlights,
    mappings: result.mappings,
    unmapped: result.unmapped,
  }, null, 2);
}

export function normalizePrefix(rawPrefix: string): string {
  const prefix = rawPrefix.trim().replace(/:+$/, "");
  if (!prefix) throw new Error("Vul eerst de klantprefix in.");
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(prefix)) {
    throw new Error("Gebruik voor de prefix alleen letters, cijfers, een streepje of underscore.");
  }
  return prefix;
}

function parseBoolean(value: string, fallback: boolean, key: string, errors: string[]): boolean {
  if (!value) return fallback;
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  errors.push(`${key}: '${value}' is geen geldige true/false-waarde.`);
  return fallback;
}

function normalizeGroup(value: string): string {
  return ["leeg", "(leeg)"].includes(value.trim().toLowerCase()) ? "" : value.trim();
}

function mapEmployeeTemplate(value: string, warnings: string[]): string {
  if (!value) return "{Name}";
  const unsupported = Array.from(value.matchAll(/\[([^\]]+)]/g))
    .map((match) => match[1])
    .filter((field) => !["employeeid", "name", "firstname", "lastname"].includes(field.toLowerCase()));
  if (unsupported.length) {
    warnings.push(`Niet-ondersteunde medewerkerweergavevelden verwijderd: ${Array.from(new Set(unsupported)).join(", ")}.`);
  }
  const mapped = value
    .replace(/\[EmployeeID]|\[EmployeeId]/gi, "{Id}")
    .replace(/\[Name]/gi, "{Name}")
    .replace(/\[FirstName]/gi, "{FirstName}")
    .replace(/\[LastName]/gi, "{LastName}")
    .replace(/\[[^\]]+]/g, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s*[-|]\s*$/g, "")
    .replace(/^\s*[-|]\s*/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return mapped.includes("{") ? mapped : "{Name}";
}

function cleanProjectUrl(raw: string): string {
  let value = raw.replace(/&quot;/gi, '"');
  const href = value.match(/href\s*=\s*["']([^"']+)["']/i);
  value = href ? href[1] : value.replace(/<[^>]*>/g, "").trim();
  return value.split(",")[0].trim().replace(/^["']|["']$/g, "").replaceAll("{0}", "{Id}");
}

function normalizeColor(value: string): string | null {
  const color = value.trim();
  const named = NAMED_COLORS[color.toLowerCase()];
  if (named) return named;
  const shortHex = color.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (shortHex) return `#${shortHex[1]}${shortHex[1]}${shortHex[2]}${shortHex[2]}${shortHex[3]}${shortHex[3]}`.toUpperCase();
  if (/^#[0-9a-f]{6}$/i.test(color)) return color.toUpperCase();
  return null;
}
