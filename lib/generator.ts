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
  /** Set met namen van optionele objects die meegenomen moeten worden (bv. FiPrjEntries) */
  includeOptional?: Set<string>;
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

  // Pre-compute welke entity-namen toggleable zijn. Alleen die worden via
  // includeOptional gestuurd; alle andere optionele objecten gaan met de
  // gewone minimal/full logica mee.
  const toggleable = new Set(findOptionalEntities(rootSchema).map((e) => e.name));
  const include = options.includeOptional ?? new Set<string>();

  for (let i = 0; i < count; i++) {
    const seedRow = options.seedRows?.[i];
    const overrides = mergeOverrides(options.overrides, seedRow);
    records.push(
      generateValue(rootSchema, options.mode, i + 1, overrides, "", false, {
        toggleable,
        included: include,
      })
    );
  }

  return count === 1 ? records[0] : records;
}

function mergeOverrides(
  manual: Record<string, unknown> | undefined,
  csv: Record<string, unknown> | undefined
): Record<string, unknown> {
  return { ...(manual ?? {}), ...(csv ?? {}) };
}

type ToggleContext = {
  toggleable: Set<string>;
  included: Set<string>;
};

function generateValue(
  schema: JSONSchema,
  mode: "minimal" | "full",
  index: number,
  overrides: Record<string, unknown>,
  fieldName = "",
  parentRequired = false,
  toggle: ToggleContext = { toggleable: new Set(), included: new Set() }
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

      // Toggleable optionele entity? Alleen meenemen als de gebruiker hem aangevinkt heeft.
      if (toggle.toggleable.has(key) && !isRequired) {
        if (!toggle.included.has(key)) continue;
      }

      const includeField =
        toggle.included.has(key) ||
        toggle.toggleable.has(key) ||
        mode === "full" ||
        isRequired ||
        isStructural(key, child) ||
        // Container 'Objects' meenemen als er aangevinkte kinderen zijn
        // (anders is de container leeg en kunnen we 'm overslaan)
        (key === "Objects" && hasIncludedChild(child, toggle, mode));

      if (!includeField) continue;

      const value = generateValue(
        child,
        mode,
        index,
        overrides,
        key,
        isRequired,
        toggle
      );
      if (value === undefined) continue;
      // Skip lege Objects-containers zodat we geen `"Objects": [{}]` of `"Objects": {}` krijgen
      if (key === "Objects" && isEmptyContainer(value)) continue;
      out[key] = value;
    }
    return out;
  }

  // Array: één item is genoeg voor minimal, in full geven we ook één item
  // (anders krijg je oneindige nesting bij regels-onder-regels).
  if (schema.type === "array" && schema.items) {
    const item = generateValue(
      schema.items,
      mode,
      index,
      overrides,
      fieldName,
      parentRequired,
      toggle
    );
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
 * Vind alle toggleable optionele entities in een schema — gebruikt door de UI
 * om checkboxes te genereren. Skipt single-child Objects-containers (zoals
 * FiEntryPar.Objects.FiEntries) want die hoofdrecord is niet écht optioneel.
 */
export function findOptionalEntities(
  schema: unknown
): { name: string; description: string }[] {
  const found = new Map<string, string>();
  walk(schema, new Set(), false);

  function walk(
    node: unknown,
    required: Set<string>,
    insideObjectsContainer: boolean
  ): void {
    if (!node || typeof node !== "object") return;
    const n = node as JSONSchema & Record<string, unknown>;

    const localRequired = new Set(required);
    if (Array.isArray(n.required)) {
      for (const r of n.required as string[]) localRequired.add(r);
    }

    if (n.properties && typeof n.properties === "object") {
      const childKeys = Object.keys(n.properties);
      const multiChildObjects =
        insideObjectsContainer && childKeys.length > 1;

      for (const [name, child] of Object.entries(
        n.properties as Record<string, JSONSchema>
      )) {
        const childIsRequired = localRequired.has(name);
        if (
          multiChildObjects &&
          isOptionalNestedEntity(name, child, childIsRequired)
        ) {
          const desc = (child.description ?? "").slice(0, 80);
          if (!found.has(name)) found.set(name, desc);
        }
        const nextInsideObjects = name === "Objects";
        walk(child, localRequired, nextInsideObjects);
      }
    }
    if (n.items) walk(n.items, localRequired, insideObjectsContainer);
  }

  return Array.from(found.entries()).map(([name, description]) => ({
    name,
    description,
  }));
}

/**
 * Heuristiek: een nested entity is "potentieel toggleable" — gebruikt door
 * findOptionalEntities() om alleen multi-child Objects-containers te kandideren.
 */
function isOptionalNestedEntity(
  key: string,
  child: JSONSchema,
  isRequired: boolean
): boolean {
  if (isRequired) return false;
  if (key === "Element" || key === "Fields" || key === "Objects") return false;
  const isObject = child.type === "object" && child.properties;
  const isArray = child.type === "array" && child.items;
  if (!isObject && !isArray) return false;
  return /^[A-Z]/.test(key);
}

/**
 * Check of een Objects-container kinderen heeft die meegenomen moeten worden.
 * Voorkomt dat we een leeg Objects-blok in de output plaatsen.
 */
function hasIncludedChild(
  objectsSchema: JSONSchema,
  toggle: ToggleContext,
  mode: "minimal" | "full"
): boolean {
  if (mode === "full") return true;
  const target =
    objectsSchema.type === "array"
      ? (objectsSchema.items as JSONSchema | undefined)
      : objectsSchema;
  if (!target?.properties) return false;
  const required = new Set(target.required ?? []);
  for (const [key, child] of Object.entries(target.properties)) {
    if (required.has(key)) return true;
    if (toggle.included.has(key)) return true;
    if (isStructural(key, child)) return true;
    // Single-child Objects: hoofdrecord (zoals FiEntries) — altijd meenemen
    if (Object.keys(target.properties).length === 1) return true;
  }
  return false;
}

/**
 * Structurele containers in AFAS-schema's die geen eigen veld zijn maar wrappers.
 * Die laten we altijd door, ook als 'required' niet expliciet is.
 */
/**
 * Is dit een lege wrapper zoals `{}` of `[{}]`? Dan willen we 'm niet in de output.
 */
function isEmptyContainer(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.every((v) => isEmptyContainer(v));
  }
  if (value && typeof value === "object") {
    return Object.keys(value).length === 0;
  }
  return false;
}

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
