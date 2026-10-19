import { NextRequest, NextResponse } from "next/server";
import { aiConfiguration, completeJson } from "@/lib/aiProvider";

/**
 * POST /api/improve
 *
 * Body: {
 *   connectorId: string,
 *   method: 'POST' | 'PUT' | 'DELETE',
 *   schema: object,         // het JSON-schema voor deze connector+methode
 *   currentPayload: unknown // de huidige minimal/full payload als startpunt
 * }
 *
 * Stuurt naar Groq een prompt om realistische test-data te vullen.
 * Returns: { improved: unknown, notes: string[] }
 */
export async function POST(req: NextRequest) {
  if (!aiConfiguration().configured) {
    return NextResponse.json(
      {
        error:
          "AI is niet geconfigureerd of staat uit. Controleer de providerinstellingen.",
      },
      { status: 500 }
    );
  }

  let body: {
    connectorId: string;
    method: string;
    schema: unknown;
    currentPayload: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON in request body" }, { status: 400 });
  }

  const { connectorId, method, schema, currentPayload } = body;
  if (!connectorId || !schema || !currentPayload) {
    return NextResponse.json(
      { error: "connectorId, schema en currentPayload zijn verplicht" },
      { status: 400 }
    );
  }

  const systemPrompt = `Je bent een expert in AFAS Profit UpdateConnectors. Je krijgt een officieel AFAS JSON-schema en een payload als startpunt. Verbeter alleen de waarden zodat de payload bruikbare, realistische testdata bevat.

Belangrijke regels:
- Behoud exact dezelfde objectstructuur en dezelfde veldnamen; verzin nooit AFAS-velden
- Respecteer type, enum, maxLength en format uit het schema strikt
- Laat bestaande primaire sleutels en door de gebruiker ingevulde waarden staan
- Vul alleen duidelijke dummywaarden en lege verplichte velden slimmer in
- Zorg alleen bij financiële boekingen met meerdere regels dat debet en credit in balans zijn
- Voor financiële boekingen (Fi*): geef realistische bedragen (€100-€10.000), geldige datums (huidige periode), en een logische BpNr/InId
- Voor stamdata (Kn*): Nederlandse namen, geldige IBAN, geldige BSN met 11-proef, NL-adressen
- Omgevingsafhankelijke codes (medewerker, project, dagboek, grootboek, typecode) mogen plausibel zijn maar moeten in AFAS worden gecontroleerd
- Geen Lorem Ipsum, geen "test1234" placeholders — geef écht-lijkende data
- Antwoord als JSON-object met exact twee keys: "improved" (de verbeterde payload) en "notes" (maximaal 3 korte Nederlandse controlepunten)`;

  const userPrompt = `Connector: ${connectorId} (${method})

Huidige minimale payload:
${JSON.stringify(currentPayload, null, 2)}

Relevant deel van het schema (alleen properties + required + descriptions):
${JSON.stringify(extractSchemaSummary(schema), null, 2)}

Geef één JSON-object terug in deze vorm:
{
  "improved": <de verbeterde payload met exact dezelfde structuur>,
  "notes": ["maximaal drie korte controlepunten"]
}`;

  let parsed: { improved?: unknown; notes?: unknown };
  try {
    parsed = await completeJson([
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ], { tokens: 5000, temperature: 0.3 }) as { improved?: unknown; notes?: unknown };
  } catch (err) {
    return NextResponse.json(
      { error: "AI-aanvraag mislukt: " + (err instanceof Error ? err.message : String(err)) },
      { status: 502 }
    );
  }

  if (!parsed || typeof parsed !== "object" || !("improved" in parsed)) {
    return NextResponse.json({ error: "Slimme controle gaf geen verbeterde payload terug" }, { status: 502 });
  }

  return NextResponse.json({
    improved: parsed.improved,
    notes: Array.isArray(parsed.notes) ? parsed.notes.map(String).slice(0, 3) : [],
    model: aiConfiguration().model,
  });
}

/**
 * Schema-samenvatting: alleen properties + required + descriptions, geen referenties.
 * Houdt de prompt klein zodat we binnen tokenlimiet blijven.
 */
function extractSchemaSummary(schema: unknown, depth = 0): unknown {
  if (depth > 6 || !schema || typeof schema !== "object") return schema;
  const node = schema as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  if (node.type) out.type = node.type;
  if (node.required) out.required = node.required;
  if (node.description) out.description = node.description;
  if (node.format) out.format = node.format;
  if (node.maxLength) out.maxLength = node.maxLength;
  if (node.enum) out.enum = node.enum;

  if (node.properties && typeof node.properties === "object") {
    const props: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node.properties as Record<string, unknown>)) {
      props[k] = extractSchemaSummary(v, depth + 1);
    }
    out.properties = props;
  }

  if (node.items) {
    out.items = extractSchemaSummary(node.items, depth + 1);
  }

  return out;
}
