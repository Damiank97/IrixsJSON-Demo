import { NextRequest, NextResponse } from "next/server";
import { durationSeconds, MILEAGE_VERSION, mileageTotal, selectRoute, type RoutePreference } from "@/lib/mileageRules";

export const runtime = "nodejs";
export const maxDuration = 60;
type Provider = "google" | "tomtom" | "demo";
type Distance = { meters: number; from: string; to: string; candidates:number };

export async function GET() {
  return NextResponse.json({ google: Boolean(process.env.GOOGLE_MAPS_API_KEY), tomtom: Boolean(process.env.TOMTOM_API_KEY) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 4096) return NextResponse.json({ error: "Aanvraag is te groot." }, { status: 413 });
    const raw = await request.text();
    if (raw.length > 4096) return NextResponse.json({ error: "Aanvraag is te groot." }, { status: 413 });
    let body;
    try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "Ongeldige JSON." }, { status: 400 }); }
    const from = typeof body?.from === "string" ? body.from.trim() : "";
    const to = typeof body?.to === "string" ? body.to.trim() : "";
    const provider = body?.provider as Provider;
    const preference = (body?.preference ?? "shortest") as RoutePreference;
    // AFAS's decimal count belongs to the cost type. Three here preserves
    // metre precision when no cost-type configuration has been supplied.
    const decimals = body?.decimals ?? 3;
    if (!["google", "tomtom", "demo"].includes(provider) || !from || !to || from.length > 255 || to.length > 255 || !["fastest", "shortest"].includes(preference) || !Number.isInteger(decimals)||decimals<0||decimals>6 || (body.roundTrip !== undefined && typeof body.roundTrip !== "boolean")) {
      return NextResponse.json({ error: "Kies een bron en vul twee adressen in (maximaal 255 tekens)." }, { status: 400 });
    }
    const key = provider === "google" ? process.env.GOOGLE_MAPS_API_KEY : process.env.TOMTOM_API_KEY;
    if (provider !== "demo" && !key) return NextResponse.json({ error: `${provider === "google" ? "Google Routes" : "TomTom"} is nog niet aangesloten. Stel de API-key in of kies expliciet het demovoorbeeld.` }, { status: 503 });
    const getDistance = (origin: string, destination: string) => provider === "google" ? googleDistance(origin, destination, key!, preference) : provider === "tomtom" ? tomtomDistance(origin, destination, key!, preference) : demoDistance(origin, destination,preference);
    const outbound = await getDistance(from, to);
    const single=outbound.meters/1000;
    return NextResponse.json({ provider, from: outbound.from, to: outbound.to, outboundKilometers: single, returnKilometers: body.roundTrip?single:0, kilometers: mileageTotal(single,!!body.roundTrip,decimals), rawMeters:outbound.meters,roundTrip:Boolean(body.roundTrip),preference,kilometerDecimals:decimals,candidateCount:outbound.candidates,returnMethod:"double-single",calculationVersion:MILEAGE_VERSION,parity:"afas-reference-not-verified",calculatedAt:new Date().toISOString(),demo:provider==="demo" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Afstand berekenen mislukt.";
    // Externe foutresponses/URL's kunnen sleutels bevatten; stuur die nooit door.
    return NextResponse.json({ error: message.startsWith("Afstand:") ? message.slice(9).trim() : "Afstandsbron is niet bereikbaar. Probeer opnieuw of vul de gereden kilometers handmatig in." }, { status: 502 });
  }
}

async function googleDistance(from: string, to: string, key: string,preference:RoutePreference): Promise<Distance> {
  const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "routes.distanceMeters,routes.staticDuration" },
    body: JSON.stringify({ origin: { address: from }, destination: { address: to }, travelMode: "DRIVE", routingPreference: "TRAFFIC_UNAWARE", computeAlternativeRoutes: true, languageCode: "nl-NL", regionCode: "NL", units: "METRIC" }),
    cache: "no-store", signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Afstand: Google Routes gaf status ${response.status}. Controleer de serverkey, Routes API en billing.`);
  const data = await response.json();
  const candidates=Array.isArray(data.routes)?data.routes.map((r:{distanceMeters?:unknown;staticDuration?:unknown})=>({meters:typeof r.distanceMeters==="number"?r.distanceMeters:NaN,seconds:durationSeconds(r.staticDuration)??NaN})):[];
  const selected=selectRoute(candidates,preference);
  return { meters:selected.meters,from,to,candidates:candidates.length };
}

async function tomtomDistance(from: string, to: string, key: string, preference: string): Promise<Distance> {
  const geocode = async (address: string) => {
    const url = new URL(`https://api.tomtom.com/search/2/geocode/${encodeURIComponent(address)}.json`);
    url.search = new URLSearchParams({ key, limit: "1", language: "nl-NL" }).toString();
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error(`Afstand: TomTom adreszoeken gaf status ${response.status}. Controleer de Geocoding API en key.`);
    const data = await response.json();
    const result = data.results?.[0];
    if (!Number.isFinite(result?.position?.lat) || !Number.isFinite(result?.position?.lon)) throw new Error("Afstand: TomTom kan een adres niet vinden. Vul straat, huisnummer en plaats in.");
    return { position: `${result.position.lat},${result.position.lon}`, address: result.address?.freeformAddress || result.address?.freeFormAddress || address };
  };
  const [origin, destination] = await Promise.all([geocode(from), geocode(to)]);
  const url = new URL(`https://api.tomtom.com/routing/1/calculateRoute/${origin.position}:${destination.position}/json`);
  url.search = new URLSearchParams({ key, routeType: preference, traffic: "false", travelMode: "car", routeRepresentation: "summaryOnly" }).toString();
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`Afstand: TomTom Routing gaf status ${response.status}. Controleer de Routing API en key.`);
  const data = await response.json();
  const meters = data.routes?.[0]?.summary?.lengthInMeters;
  if (typeof meters !== "number" || !Number.isFinite(meters) || meters <= 0) throw new Error("Afstand: TomTom heeft geen bruikbare autoroute gevonden.");
  return { meters, from: origin.address, to: destination.address,candidates:1 };
}

async function demoDistance(from: string, to: string,preference:RoutePreference): Promise<Distance> {
  const locations = [from.toLowerCase(), to.toLowerCase()].sort().join("|");
  if (locations !== "enter|utrecht") throw new Error("Afstand: Het demovoorbeeld werkt uitsluitend met Enter ↔ Utrecht. Voor andere adressen is een eigen Google- of TomTom-key nodig.");
  const selected=selectRoute([{meters:126000,seconds:7200},{meters:138000,seconds:6000},{meters:132000,seconds:6600}],preference);
  return { meters:selected.meters,from,to,candidates:3 };
}
