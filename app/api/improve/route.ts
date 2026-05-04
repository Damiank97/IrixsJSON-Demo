import { NextRequest, NextResponse } from "next/server";

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
 * Returns: { improved: unknown }
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "GROQ_API_KEY ontbreekt. Voeg 'm toe in Vercel → Settings → Environment Variables.",
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

  const systemPrompt = `Je bent een expert in AFAS Profit UpdateConnectors. Je krijgt een JSON-schema en een minimale payload als startpunt. Je vervangt dummy-waarden door realistische test-data zodat de payload een geldige AFAS-call wordt.

Belangrijke regels:
- Behoud de exacte structuur van het JSON-object — geen velden toevoegen of weggooien tenzij voor een geldige call écht nodig
- Vul lege strings ("") met realistische codes (bv. JoCo dagboekcode, AcNr grootboeknummer)
- Zorg dat AmDe en AmCr opgeteld kloppen per boeking (de balans van debet/credit)
- Voor financiële boekingen (Fi*): geef realistische bedragen (€100-€10.000), geldige datums (huidige periode), en een logische BpNr/InId
- Voor stamdata (Kn*): Nederlandse namen, geldige IBAN, geldige BSN met 11-proef, NL-adressen
- Voor verwijzingsvelden naar tabellen: gebruik plausibele codes ("1", "VRK", etc.)
- Geen Lorem Ipsum, geen "test1234" placeholders — geef écht-lijkende data
- Antwoord ALLEEN met de verbeterde JSON, geen uitleg, geen markdown code blocks`;

  const userPrompt = `Connector: ${connectorId} (${method})

Huidige minimale payload:
${JSON.stringify(currentPayload, null, 2)}

Relevant deel van het schema (alleen properties + required + descriptions):
${JSON.stringify(extractSchemaSummary(schema), null, 2)}

Geef de verbeterde payload terug als JSON-object.`;

  let groqResponse: Response;
  try {
    groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.3,
          max_tokens: 4000,
        }),
        // Vercel timeout safety
        signal: AbortSignal.timeout(30_000),
      }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Groq onbereikbaar: " + (err instanceof Error ? err.message : String(err)) },
      { status: 502 }
    );
  }

  if (!groqResponse.ok) {
    const errText = await groqResponse.text();
    return NextResponse.json(
      { error: `Groq fout (${groqResponse.status}): ${errText.slice(0, 300)}` },
      { status: 502 }
    );
  }

  const data = await groqResponse.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    return NextResponse.json({ error: "Lege response van Groq" }, { status: 502 });
  }

  let improved: unknown;
  try {
    improved = JSON.parse(content);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Groq gaf geen geldige JSON terug",
        raw: content.slice(0, 500),
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ improved });
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
