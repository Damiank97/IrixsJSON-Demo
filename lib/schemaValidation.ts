export type ValidationIssue = {
  path: string;
  message: string;
};

type JSONSchema = {
  type?: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  enum?: unknown[];
  maxLength?: number;
  minLength?: number;
  format?: string;
  additionalProperties?: boolean;
};

const ENVIRONMENT_FIELDS = new Set([
  "AcNr", "BiId", "CcId", "CrId", "CuId", "DbId", "DiC1", "DiC2", "DiC3",
  "EmId", "EnSe", "ItCd", "JoCo", "OuId", "PrId", "PjId", "VaId", "ViGr",
]);

export function validatePayload(schema: unknown, payload: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const records = Array.isArray(payload) ? payload : [payload];
  records.forEach((record, index) => {
    validateNode(schema as JSONSchema, record, records.length > 1 ? `$[${index}]` : "$", issues);
  });
  return issues;
}

export function countEnvironmentCodes(schema: unknown, payload: unknown): number {
  let count = 0;
  const records = Array.isArray(payload) ? payload : [payload];
  for (const record of records) walkReferences(schema as JSONSchema, record);
  return count;

  function walkReferences(node: JSONSchema, value: unknown): void {
    if (!node || value === null || value === undefined) return;
    if (node.type === "array" && node.items && Array.isArray(value)) {
      value.forEach((item) => walkReferences(node.items!, item));
      return;
    }
    if (node.type === "object" && Array.isArray(value)) {
      value.forEach((item) => walkReferences(node, item));
      return;
    }
    if (node.type !== "object" || !node.properties || typeof value !== "object" || Array.isArray(value)) return;
    for (const [key, child] of Object.entries(node.properties)) {
      const childValue = (value as Record<string, unknown>)[key];
      if (childValue === undefined) continue;
      if (ENVIRONMENT_FIELDS.has(key) && childValue !== "" && childValue !== null) count++;
      walkReferences(child, childValue);
    }
  }
}

function validateNode(schema: JSONSchema, value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!schema || value === undefined) return;
  if (schema.type === "object") {
    // AFAS staat voor `Element` ook een array toe om meerdere records in één
    // geldige UpdateConnector-call te verwerken, hoewel het OpenAPI-schema
    // het element als object beschrijft.
    if (Array.isArray(value) && path.endsWith(".Element")) {
      value.forEach((item, index) => validateNode(schema, item, `${path}[${index}]`, issues));
      return;
    }
    if (!isPlainObject(value)) {
      issues.push({ path, message: "moet een object zijn" });
      return;
    }
    const object = value as Record<string, unknown>;
    for (const required of schema.required || []) {
      if (!(required in object) || object[required] === null || object[required] === "") {
        issues.push({ path: `${path}.${required}`, message: "verplicht veld ontbreekt of is leeg" });
      }
    }
    for (const [key, childValue] of Object.entries(object)) {
      const childSchema = schema.properties?.[key];
      if (!childSchema) {
        if (schema.additionalProperties === false) issues.push({ path: `${path}.${key}`, message: "veld staat niet in het AFAS-schema" });
        continue;
      }
      validateNode(childSchema, childValue, `${path}.${key}`, issues);
    }
    return;
  }
  if (schema.type === "array") {
    if (!Array.isArray(value)) {
      issues.push({ path, message: "moet een array zijn" });
      return;
    }
    value.forEach((item, index) => validateNode(schema.items || {}, item, `${path}[${index}]`, issues));
    return;
  }

  if (!matchesType(schema.type, value)) {
    issues.push({ path, message: `verwacht ${schema.type || "een geldige waarde"}, kreeg ${typeName(value)}` });
    return;
  }
  if (schema.enum && !schema.enum.some((allowed) => Object.is(allowed, value))) {
    issues.push({ path, message: `waarde moet één van ${schema.enum.map(String).join(", ")} zijn` });
  }
  if (typeof value === "string") {
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      issues.push({ path, message: `maximaal ${schema.maxLength} tekens (nu ${value.length})` });
    }
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      issues.push({ path, message: `minimaal ${schema.minLength} tekens` });
    }
    if (schema.format === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) issues.push({ path, message: "datum moet JJJJ-MM-DD zijn" });
    if (schema.format === "date-time" && Number.isNaN(Date.parse(value))) issues.push({ path, message: "ongeldige datum/tijd" });
    if (schema.format === "uuid" && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) issues.push({ path, message: "ongeldige GUID" });
    if (schema.format === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) issues.push({ path, message: "ongeldig e-mailadres" });
  }
}

function matchesType(type: string | undefined, value: unknown): boolean {
  if (!type) return true;
  if (type === "integer") return typeof value === "number" && Number.isInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "string") return typeof value === "string";
  if (type === "boolean") return typeof value === "boolean";
  if (type === "object") return isPlainObject(value);
  if (type === "array") return Array.isArray(value);
  return true;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function typeName(value: unknown): string {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}
