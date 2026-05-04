/**
 * Slimme dummy-data generator voor AFAS-velden.
 *
 * Werkt in twee lagen:
 *   1. Match op exacte veldnaam (AFAS-conventies zoals 'EmAd', 'BcCo', 'IbBC')
 *   2. Match op patroon (substring, suffix) als geen exacte hit
 *   3. Fallback op JSON-Schema type/format
 */

export type FieldSchema = {
  type?: string;
  format?: string;
  maxLength?: number;
  description?: string;
  enum?: unknown[];
};

// Reproduceerbare pseudo-random op basis van een seed.
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Eleven-proof BSN, deterministisch op index.
function generateBSN(seed: number): string {
  const rng = mulberry32(seed + 1);
  for (let attempt = 0; attempt < 100; attempt++) {
    const digits = Array.from({ length: 8 }, () => Math.floor(rng() * 10));
    const sum = digits.reduce((acc, d, i) => acc + d * (9 - i), 0);
    const check = sum % 11;
    if (check < 10) {
      return digits.join("") + check;
    }
  }
  return "123456782";
}

function generateIBAN(seed: number): string {
  // NL-IBAN met dummy bank en valide controlecijfer (mod-97).
  const rng = mulberry32(seed + 2);
  const bank = "INGB";
  const account = Array.from({ length: 10 }, () => Math.floor(rng() * 10)).join("");
  // Versimpelde mod-97 berekening — voor demo data prima.
  const numeric = bank
    .split("")
    .map((c) => (c.charCodeAt(0) - 55).toString())
    .join("") + account + "232100"; // NL = 23,21
  let mod = 0;
  for (const ch of numeric) mod = (mod * 10 + parseInt(ch, 10)) % 97;
  const check = (98 - mod).toString().padStart(2, "0");
  return `NL${check}${bank}${account}`;
}

const FIRST_NAMES = ["Jan", "Eva", "Piet", "Sara", "Tom", "Lotte", "Bas", "Anouk", "Daan", "Iris"];
const LAST_NAMES = ["de Vries", "Jansen", "Bakker", "Visser", "van Dijk", "Smit", "Meijer", "de Boer", "Mulder", "de Groot"];
const STREETS = ["Hoofdstraat", "Dorpsweg", "Schoolstraat", "Kerkplein", "Beatrixlaan", "Wilhelminastraat"];
const CITIES = ["Amsterdam", "Rotterdam", "Den Haag", "Utrecht", "Eindhoven", "Lelystad", "Leusden", "Zwolle"];

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

function isoDate(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().slice(0, 10);
}

function isoDateTime(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().slice(0, 19);
}

/**
 * Genereer een waarde voor een specifiek veld.
 *
 * @param fieldName  AFAS-veldnaam (bv. 'EmAd', 'BcCo', 'PrId')
 * @param schema     JSON-schema voor dit veld
 * @param index      Rij-index (1, 2, 3 ...) — gebruikt voor unieke waarden over rijen
 * @param description Description-tekst uit het schema (handig voor heuristiek)
 */
export function dummyForField(
  fieldName: string,
  schema: FieldSchema,
  index: number,
  description = ""
): unknown {
  const lower = fieldName.toLowerCase();
  const desc = description.toLowerCase();

  // Specifieke AFAS-veldnamen — exact match
  switch (fieldName) {
    case "BcCo": case "BSN":
      return generateBSN(index);
    case "EmAd":
      return `testpersoon${index}@irixs.test`;
    case "TeNr": case "TeN2": case "MbNr":
      return `0612${String(345600 + index).padStart(6, "0")}`;
    case "IbBC": case "Iban":
      return generateIBAN(index);
    case "ZpCd": case "ZipCode":
      return `${1000 + index}AB`;
    case "Ad": case "Adres": case "HmAd":
      return `${pick(STREETS, index)} ${index}`;
    case "Rs": case "Plaats": case "City":
      return pick(CITIES, index);
    case "FiNm": case "Voornaam":
      return pick(FIRST_NAMES, index);
    case "LaNm": case "Achternaam":
      return pick(LAST_NAMES, index);
    case "Nm":
      return `${pick(FIRST_NAMES, index)} ${pick(LAST_NAMES, index)}`;
    case "BcId":
      return "TEST" + String(1000 + index);
    case "ItCd":
      return "ART" + String(100 + index);
    case "DbId":
      return "DEB" + String(1000 + index);
    case "CrId":
      return "CRE" + String(1000 + index);
    case "PrId":
      return "PRJ" + String(1000 + index);
    case "EmId":
      return "EMP" + String(100 + index);
    case "VaGe": case "Geslacht":
      return index % 2 === 0 ? "M" : "V";
    case "ChlD": case "Geboortedatum": case "DaBi":
      return isoDate(-365 * 30 - index * 100);
    case "Lw": case "Land": case "CoId":
      return "NL";
    case "AutoNum":
      return true;
    case "MatchPer":
      return "0";
    case "MatchOga":
      return "0";
    case "AddToPortal":
      return false;
  }

  // Pattern-match op naam-suffixen (AFAS-conventies)
  if (lower.endsWith("nm") || lower.includes("naam") || lower.includes("name")) {
    return `${pick(FIRST_NAMES, index)} ${pick(LAST_NAMES, index)}`;
  }
  if (lower.endsWith("ad") || lower.includes("email") || lower.includes("mail")) {
    return `test${index}@irixs.test`;
  }
  if (lower.includes("iban") || lower.includes("bankrek")) {
    return generateIBAN(index);
  }
  if (lower.includes("postcode") || lower.endsWith("zp")) {
    return `${1000 + index}AB`;
  }
  if (lower.includes("phone") || lower.includes("tel")) {
    return `0612${String(345600 + index).padStart(6, "0")}`;
  }
  if (lower.includes("plaats") || lower.includes("city")) {
    return pick(CITIES, index);
  }

  // Op basis van type/format
  if (schema.format === "date" || lower.startsWith("da")) {
    return isoDate(-index);
  }
  if (schema.format === "date-time" || lower.includes("dttime")) {
    return isoDateTime(-index);
  }

  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return schema.enum[index % schema.enum.length];
  }

  switch (schema.type) {
    case "string": {
      // Check description voor 'verwijzing naar tabel' → leeg laten lukt vaak niet, dus geef code
      if (desc.includes("verwijzing")) return "1";
      const max = schema.maxLength ?? 16;
      const base = `Test${index}`;
      return base.length > max ? base.slice(0, max) : base;
    }
    case "integer":
      return index;
    case "number":
      return Number((index * 10.5).toFixed(2));
    case "boolean":
      return false;
    default:
      return null;
  }
}
