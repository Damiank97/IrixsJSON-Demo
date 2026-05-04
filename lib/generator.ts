import { dummyForField, type FieldSchema } from "./dummyData";

export type GeneratorOptions = {
  /** Alleen verplichte velden, of alle velden? */
  mode: "minimal" | "full";
  /** Aantal records — 1 = single object, >1 = array van payloads */
  count: number;
  /** Override-waarden per veldnaam (laagste niveau, geen path) */
  overrides?: Record<string, unknown>;
  /** Eén rij per record — komt uit CSV upload */
  seedRows?: Record<string, unknown>[];
};

type JSONSchema = {
  type?: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  format?: string;
  maxLength?: number;
  description?: string;
  enum?: unknown[];
};

/**
 * Genereer een payload (of array van payloads) op basis van het JSON-schema.
 */
export function generatePayload(
  rootSchema: JSONSchema,
  options: GeneratorOptions
): unknown {
  const count = Math.max(1, Math.min(100, Math.floor(options.count)));
  const records: unknown[] = [];

  for (let i = 0; i < count; i++) {
    const seedRow = options.seedRows?.[i];
    const overrides = mergeOverrides(options.overrides, seedRow);
    records.push(generateValue(rootSchema, options.mode, i + 1, overrides));
  }

  return count === 1 ? records[0] : records;
}

function mergeOverrides(
  manual: Record<string, unknown> | undefined,
  csv: Record<string, unknown> | undefined
): Record<string, unknown> {
  return { ...(manual ?? {}), ...(csv ?? {}) };
}

function generateValue(
  schema: JSONSchema,
  mode: "minimal" | "full",
  index: number,
  overrides: Record<string, unknown>,
  fieldName = "",
  parentRequired = false
): unknown {
  // Overrides hebben voorrang — als de gebruiker een waarde voor dit veld heeft
  // opgegeven, gebruik die ongeacht het type.
  if (fieldName && fieldName in overrides) {
    return overrides[fieldName];
  }

  // Object: recurse over properties
  if (schema.type === "object" && schema.properties) {
    const out: Record<string, unknown> = {};
    const required = new Set(schema.required ?? []);

    for (const [key, child] of Object.entries(schema.properties)) {
      const isRequired = required.has(key);
      const includeField =
        mode === "full" ||
        isRequired ||
        // Container-properties (Element, Fields, Objects, en eigennaam-wrappers)
        // zijn structureel — die moeten altijd mee, ook in minimal mode.
        isStructural(key, child);

      if (!includeField) continue;

      const value = generateValue(child, mode, index, overrides, key, isRequired);
      if (value !== undefined) {
        out[key] = value;
      }
    }
    return out;
  }

  // Array: één item is genoeg voor minimal, in full geven we ook één item
  // (anders krijg je oneindige nesting bij regels-onder-regels).
  if (schema.type === "array" && schema.items) {
    const item = generateValue(schema.items, mode, index, overrides, fieldName, parentRequired);
    return [item];
  }

  // Primitief: gebruik smart dummy data
  if (fieldName) {
    return dummyForField(
      fieldName,
      schema as FieldSchema,
      index,
      schema.description ?? ""
    );
  }

  return undefined;
}

/**
 * Structurele containers in AFAS-schema's die geen eigen veld zijn maar wrappers.
 * Die laten we altijd door, ook als 'required' niet expliciet is.
 */
function isStructural(key: string, child: JSONSchema): boolean {
  // Element en Fields zijn ALTIJD structureel — die wrappen de data.
  if (key === "Element" || key === "Fields") return true;
  // Top-level wrapper (bv. 'KnPerson', 'FbSales') — herkenbaar aan een object
  // dat zelf weer een Element-property heeft
  if (
    child.type === "object" &&
    child.properties &&
    "Element" in child.properties
  ) {
    return true;
  }
  // 'Objects' (nested entiteiten) is NIET structureel — alleen meenemen in full mode
  // of als 'required' het expliciet noemt.
  return false;
}

/**
 * Parse een eenvoudige CSV (komma- of puntkomma-gescheiden) met header-rij.
 * Returns: array van objects met header-namen als keys.
 *
 * Houdt rekening met:
 *   - Beide separators (komma, puntkomma)
 *   - Quoted values met komma's erin
 *   - BOM aan het begin
 *   - Lege regels
 */
export function parseCsv(text: string): Record<string, string>[] {
  // BOM strip
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  // Detecteer separator op basis van de header
  const sep = lines[0].includes(";") && !lines[0].includes(",") ? ";" : ",";

  const parseRow = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === sep && !inQuotes) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };

  const headers = parseRow(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseRow(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? "";
    });
    return row;
  });
}
