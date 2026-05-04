import type { ConnectorDetail } from "./data";

/**
 * Bouw een prompt-klare markdown van een connector — schema (compact),
 * één representatief voorbeeld, en context. Bedoeld om in ChatGPT/Claude
 * te plakken voor hulp bij koppelingen, TO's, of debugging.
 *
 * Houdt grootte beperkt door alleen field-hints mee te geven (geen full schema tree).
 */
export function buildLlmPrompt(detail: ConnectorDetail): string {
  const { connector, schemas, examples } = detail;

  const lines: string[] = [];

  lines.push(`# AFAS UpdateConnector: ${connector.id}`);
  lines.push("");
  lines.push(`**Groep:** ${connector.group}`);
  lines.push(`**Methodes:** ${connector.methods.join(", ")}`);
  if (connector.description) {
    lines.push(`**Omschrijving:** ${connector.description}`);
  }
  lines.push("");

  // Schema's per methode — alleen veld-hints, niet de hele tree
  const postSchema = schemas.find((s) => s.method === "POST");
  if (postSchema) {
    lines.push(`## Velden (POST)`);
    lines.push("");
    const hints = collectFieldHints(postSchema.schema);
    const required = hints.filter((h) => h.required);
    const optional = hints.filter((h) => !h.required);

    if (required.length > 0) {
      lines.push(`### Verplicht (${required.length})`);
      lines.push("");
      for (const h of required) lines.push(formatHint(h));
      lines.push("");
    }
    if (optional.length > 0) {
      lines.push(`### Optioneel (${optional.length})`);
      lines.push("");
      for (const h of optional.slice(0, 50)) lines.push(formatHint(h));
      if (optional.length > 50) {
        lines.push(`- ... en ${optional.length - 50} meer optionele velden`);
      }
      lines.push("");
    }
  }

  // Eén voorbeeld payload (de eerste of de "maximaal" als die bestaat)
  if (examples.length > 0) {
    const preferred =
      examples.find((e) => e.name.toLowerCase().includes("maximaal")) ??
      examples[0];
    lines.push(`## Voorbeeld payload`);
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify(preferred.payload, null, 2));
    lines.push("```");
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("Help me met:");
  lines.push("");
  lines.push("[beschrijf wat je wil bereiken]");

  return lines.join("\n");
}

type FieldHint = {
  name: string;
  type: string;
  description: string;
  required: boolean;
  maxLength?: number;
  format?: string;
};

function collectFieldHints(schema: unknown): FieldHint[] {
  const out: FieldHint[] = [];
  walk(schema, out, new Set());
  // Dedupliceer op naam (eerste hit wint)
  const seen = new Set<string>();
  return out.filter((h) => {
    if (seen.has(h.name)) return false;
    seen.add(h.name);
    return true;
  });
}

function walk(node: unknown, acc: FieldHint[], required: Set<string>): void {
  if (!node || typeof node !== "object") return;
  const n = node as Record<string, unknown>;

  const localRequired = new Set(required);
  if (Array.isArray(n.required)) {
    for (const r of n.required as string[]) localRequired.add(r);
  }

  if (n.properties && typeof n.properties === "object") {
    for (const [name, child] of Object.entries(
      n.properties as Record<string, unknown>
    )) {
      const c = child as Record<string, unknown>;
      const hasNested =
        (c.type === "object" && c.properties) ||
        (c.type === "array" && c.items);

      // Skip structurele wrappers die geen veld zijn
      const isStructural =
        name === "Element" || name === "Fields" || name === "Objects";

      if (!hasNested && !isStructural) {
        acc.push({
          name,
          type: (c.type as string) ?? "any",
          description: ((c.description as string) ?? "").slice(0, 100),
          required: localRequired.has(name),
          maxLength: c.maxLength as number | undefined,
          format: c.format as string | undefined,
        });
      }
      walk(child, acc, localRequired);
    }
  }
  if (n.items) walk(n.items, acc, localRequired);
}

function formatHint(h: FieldHint): string {
  const parts: string[] = [];
  parts.push(`\`${h.name}\``);
  const typeInfo: string[] = [h.type];
  if (h.format) typeInfo.push(h.format);
  if (h.maxLength) typeInfo.push(`max ${h.maxLength}`);
  parts.push(`(${typeInfo.join(", ")})`);
  if (h.description) parts.push(`— ${h.description}`);
  return `- ${parts.join(" ")}`;
}
