import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../app/api/distance/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function load(fetch) {
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: createRequire(import.meta.url), process: { env: { GOOGLE_MAPS_API_KEY: "test-google", TOMTOM_API_KEY: "test-tomtom" } }, fetch, AbortSignal, URL, URLSearchParams });
  return exports;
}
const request = (body) => new Request("http://localhost/api/distance", { method: "POST", body: JSON.stringify(body) });

test("Google gebruikt Routes API en berekent een afwijkende terugrit afzonderlijk", async () => {
  const calls = [];
  const route = load(async (url, options) => {
    calls.push({ url: String(url), ...options, body: JSON.parse(options.body) });
    return Response.json({ routes: [{ distanceMeters: calls.length === 1 ? 10010 : 11220 }] });
  });
  const response = await route.POST(request({ provider: "google", from: "Adres A", to: "Adres B", roundTrip: true }));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.outboundKilometers, 10.01); assert.equal(result.returnKilometers, 11.22); assert.equal(result.kilometers, 21.23);
  assert.equal(calls[0].url, "https://routes.googleapis.com/directions/v2:computeRoutes");
  assert.equal(calls[0].headers["X-Goog-FieldMask"], "routes.distanceMeters");
  assert.equal(calls[0].body.origin.address, "Adres A"); assert.equal(calls[1].body.origin.address, "Adres B");
  assert.equal(calls[0].body.routingPreference, "TRAFFIC_UNAWARE");
});

test("TomTom vertaalt adressen naar coördinaten en past kortste route toe", async () => {
  const routes = [];
  const route = load(async (input) => {
    const url = new URL(input);
    if (url.pathname.includes("/geocode/")) return Response.json({ results: [{ position: { lat: url.pathname.includes("Adres%20A") ? 52 : 53, lon: 5 }, address: { freeformAddress: "Gevonden adres" } }] });
    routes.push(url);
    return Response.json({ routes: [{ summary: { lengthInMeters: routes.length === 1 ? 14400 : 14700 } }] });
  });
  const response = await route.POST(request({ provider: "tomtom", from: "Adres A", to: "Adres B", roundTrip: true, preference: "shortest" }));
  const result = await response.json();
  assert.equal(response.status, 200); assert.equal(result.kilometers, 29.1);
  assert.equal(routes[0].pathname, "/routing/1/calculateRoute/52,5:53,5/json");
  assert.equal(routes[1].pathname, "/routing/1/calculateRoute/53,5:52,5/json");
  assert.equal(routes[0].searchParams.get("routeType"), "shortest");
  assert.equal(routes[0].searchParams.get("traffic"), "false");
});

test("providerfout lekt geen sleutel of ruwe externe response", async () => {
  const route = load(async () => { throw new Error("Secret in external URL: test-google"); });
  const response = await route.POST(request({ provider: "google", from: "A", to: "B" }));
  assert.equal(response.status, 502);
  assert.equal(JSON.stringify(await response.json()).includes("test-google"), false);
});

test("Google kortste route wordt niet ten onrechte als ondersteund aangeboden", async () => {
  const route = load(async () => { throw new Error("Mag niet worden aangeroepen"); });
  assert.equal((await route.POST(request({ provider: "google", from: "A", to: "B", preference: "shortest" }))).status, 400);
});
