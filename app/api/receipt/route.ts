import { NextRequest, NextResponse } from "next/server";

type ReceiptResult = {
  description: string;
  amount: number | null;
  date: string | null;
  merchant: string | null;
  confidence: "laag" | "middel" | "hoog";
};

export async function POST(request: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Bonherkenning is nog niet geconfigureerd." }, { status: 503 });

  let body: { dataUrl?: string; fileName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  if (!body.dataUrl?.startsWith("data:image/") || body.dataUrl.length > 4_200_000) {
    return NextResponse.json({ error: "Gebruik een JPG, PNG of WEBP van maximaal 3 MB." }, { status: 400 });
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "qwen/qwen3.8-27b",
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: `Lees deze declaratiebon uit. Antwoord uitsluitend als JSON met: description (korte Nederlandse omschrijving), amount (totaalbedrag inclusief btw als getal), date (YYYY-MM-DD of null), merchant (naam leverancier of null), confidence (laag, middel of hoog). Bestandsnaam: ${body.fileName ?? "onbekend"}. Raad niets als het niet leesbaar is.`,
            },
            { type: "image_url", image_url: { url: body.dataUrl } },
          ],
        }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_completion_tokens: 500,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) throw new Error(`Bonherkenning gaf status ${response.status}`);
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("Geen resultaat ontvangen");
    const parsed = JSON.parse(content) as Partial<ReceiptResult>;
    const result: ReceiptResult = {
      description: String(parsed.description ?? "").slice(0, 100),
      amount: typeof parsed.amount === "number" && Number.isFinite(parsed.amount) ? parsed.amount : null,
      date: typeof parsed.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : null,
      merchant: parsed.merchant ? String(parsed.merchant).slice(0, 100) : null,
      confidence: parsed.confidence === "hoog" || parsed.confidence === "middel" ? parsed.confidence : "laag",
    };
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Bonherkenning mislukt" }, { status: 502 });
  }
}
