import { NextRequest, NextResponse } from "next/server";
import { getEvidence, integrationAdvice } from "@/lib/studio/knowledge";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id") ?? "";
  const result = await getEvidence(id);
  return NextResponse.json(result ?? { error: "Connector niet gevonden." }, { status: result ? 200 : 404, headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: NextRequest) {
  try {
    const raw = await request.text();
    if (raw.length > 8000) return NextResponse.json({ error: "Vraag is te groot." }, { status: 413 });
    const body = JSON.parse(raw);
    if (typeof body.question !== "string" || !body.question.trim() || body.question.length > 2000) return NextResponse.json({ error: "Stel een vraag van maximaal 2.000 tekens." }, { status: 400 });
    return NextResponse.json(await integrationAdvice(body.question, Array.isArray(body.missing) ? body.missing.filter((v: unknown) => typeof v === "string").slice(0, 12) : []));
  } catch { return NextResponse.json({ error: "Het voorstel kon niet worden samengesteld." }, { status: 400 }); }
}
