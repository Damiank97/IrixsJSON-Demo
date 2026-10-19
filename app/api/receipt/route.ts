import { NextRequest, NextResponse } from "next/server";
import { aiConfiguration, completeJson } from "@/lib/aiProvider";

type ReceiptResult = {
  description: string;
  amount: number | null;
  date: string | null;
  merchant: string | null;
  confidence: "laag" | "middel" | "hoog";
};

export async function POST(request: NextRequest) {
  if (!aiConfiguration("receipt").configured) return NextResponse.json({ error: "Bonherkenning is nog niet geconfigureerd of staat uit." }, { status: 503 });

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
    const parsed = await completeJson([{
          role: "user",
          content: [
            {
              type: "text",
              text: `Lees deze declaratiebon uit. Antwoord uitsluitend als JSON met: description (korte Nederlandse omschrijving), amount (totaalbedrag inclusief btw als getal), date (YYYY-MM-DD of null), merchant (naam leverancier of null), confidence (laag, middel of hoog). Bestandsnaam: ${body.fileName ?? "onbekend"}. Raad niets als het niet leesbaar is.`,
            },
            { type: "image_url", image_url: { url: body.dataUrl } },
          ],
        }], { purpose: "receipt", tokens: 500 }) as Partial<ReceiptResult>;
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
