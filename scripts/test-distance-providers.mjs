import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTsModule } from "./load-ts-module.mjs";
const load = (fetch, env = { GOOGLE_MAPS_API_KEY: "test-google", TOMTOM_API_KEY: "test-tomtom" }) => loadTsModule("app/api/distance/route.ts", { fetch, env });
const request = (body) => new Request("http://localhost/api/distance", { method: "POST", body: JSON.stringify(body) });
const candidates = [{ distanceMeters: 14010, staticDuration: "600s" }, { distanceMeters: 10010, staticDuration: "900s" }, { distanceMeters: 12000, staticDuration: "700s" }];

test("Google shortest from alternatives; return doubles the single route with only one request", async () => {
  const calls = [];
  const route = load(async (url, options) => {
    calls.push({ url: String(url), ...options, body: JSON.parse(options.body) });
    return Response.json({ routes: candidates });
  });
  const response = await route.POST(request({ provider: "google", from: "Adres A", to: "Adres B", roundTrip: true }));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.outboundKilometers, 10.01); assert.equal(result.returnKilometers, 10.01); assert.equal(result.kilometers, 20.02);
  assert.equal(calls.length, 1); assert.equal(result.candidateCount, 3);
  assert.equal(result.returnMethod, "double-single"); assert.equal(result.parity, "afas-reference-not-verified");
  assert.equal(calls[0].url, "https://routes.googleapis.com/directions/v2:computeRoutes");
  assert.equal(calls[0].headers["X-Goog-FieldMask"], "routes.distanceMeters,routes.staticDuration");
  assert.equal(calls[0].body.origin.address, "Adres A");
  assert.equal(calls[0].body.computeAlternativeRoutes, true);
  assert.equal(calls[0].body.routingPreference, "TRAFFIC_UNAWARE");
});

test("Google fastest uses static duration, not candidate order or shortest distance", async () => {
  const route = load(async () => Response.json({ routes: [...candidates].reverse() }));
  const result = await (await route.POST(request({ provider: "google", from: "A", to: "B", preference: "fastest", roundTrip: true, decimals: 1 }))).json();
  assert.equal(result.outboundKilometers, 14.01); assert.equal(result.kilometers, 28); assert.equal(result.kilometerDecimals, 1);
});

test("missing or malformed Google candidate metadata blocks instead of silently falling back", async () => {
  for (const routes of [[], [{ distanceMeters: 1000 }], [...candidates, { distanceMeters: 10, staticDuration: "bad" }], [{ distanceMeters: -1, staticDuration: "60s" }]]) {
    const route = load(async () => Response.json({ routes }));
    assert.equal((await route.POST(request({ provider: "google", from: "A", to: "B" }))).status, 502);
  }
});

test("TomTom geocodes once per address and applies shortest/fastest without live traffic", async () => {
  for (const preference of ["shortest", "fastest"]) {
    const routes = [], geocodes = [];
    const route = load(async (input) => {
      const url = new URL(input);
      if (url.pathname.includes("/geocode/")) {
        geocodes.push(url);
        return Response.json({ results: [{ position: { lat: url.pathname.includes("Adres%20A") ? 52 : 53, lon: 5 }, address: { freeformAddress: "Gevonden adres" } }] });
      }
      routes.push(url);
      return Response.json({ routes: [{ summary: { lengthInMeters: 14415 } }] });
    });
    const response = await route.POST(request({ provider: "tomtom", from: "Adres A", to: "Adres B", roundTrip: true, preference, decimals: 2 }));
    const result = await response.json();
    assert.equal(response.status, 200); assert.equal(result.kilometers, 28.83);
    assert.equal(routes.length, 1); assert.equal(geocodes.length, 2);
    assert.equal(routes[0].pathname, "/routing/1/calculateRoute/52,5:53,5/json");
    assert.equal(routes[0].searchParams.get("routeType"), preference);
    assert.equal(routes[0].searchParams.get("traffic"), "false");
  }
});

test("provider failure never exposes keys or raw errors", async () => {
  const route = load(async () => { throw new Error("Secret in external URL: test-google"); });
  const response = await route.POST(request({ provider: "google", from: "A", to: "B" }));
  assert.equal(response.status, 502);
  assert.equal(JSON.stringify(await response.json()).includes("test-google"), false);
});

test("invalid precision, choices and missing keys fail closed", async () => {
  const route = load(undefined, {});
  for (const changes of [{ decimals: -1 }, { decimals: 7 }, { decimals: "2" }, { decimals: 1.5 }, { preference: "scenic" }, { roundTrip: "false" }])
    assert.equal((await route.POST(request({ provider: "demo", from: "Enter", to: "Utrecht", ...changes }))).status, 400);
  assert.equal((await route.POST(request({ provider: "google", from: "A", to: "B" }))).status, 503);
});

test("demo explicitly uses fictitious candidates and return doubling", async () => {
  const route = load();
  for (const preference of ["shortest", "fastest"]) {
    const result = await (await route.POST(request({ provider: "demo", from: "Enter", to: "Utrecht", preference, roundTrip: true }))).json();
    assert.equal(result.kilometers, preference === "shortest" ? 252 : 276); assert.equal(result.demo, true);
  }
  assert.equal((await route.POST(request({ provider: "demo", from: "Amsterdam", to: "Utrecht" }))).status, 502);
});

test("precision, stale measurements, reference mismatch and tie-breaking", () => {
  const m = loadTsModule("lib/mileageRules.ts");
  assert.equal(m.mileageTotal(14.415, true, 2), 28.83);
  assert.equal(m.mileageTotal(14.415, false, 0), 14);
  assert.equal(m.durationSeconds("123.456s"), 123.456); assert.equal(m.durationSeconds("NaNs"), null);
  const list = [{ meters: 500, seconds: 20 }, { meters: 500, seconds: 10 }];
  assert.equal(m.selectRoute(list, "shortest").seconds, 10); assert.equal(list[0].seconds, 20);
  const line = { kilometers: 28.83, outboundKilometers: 14.415, roundTrip: true, kilometerDecimals: 2, distanceSource: "google", calculationVersion: 2 };
  assert.equal(m.mileageConsistent(line, 2), "");
  assert.match(m.mileageConsistent({ ...line, calculationVersion: 1 }, 2), /oude route/);
  assert.match(m.mileageConsistent({ ...line, kilometers: 28.82 }, 2), /totaal/);
  assert.match(m.mileageConsistent({ ...line, outboundKilometers: NaN }, 2), /totaal/);
  assert.match(m.mileageConsistent({ ...line, afasReferenceKilometers: 29 }, 2), /AFAS-referentie/);
  assert.equal(m.mileageConsistent({ ...line, afasReferenceKilometers: 28.83 }, 2), "");
  assert.match(m.mileageConsistent({ kilometers: 1.234, distanceSource: "importbestand" }, 2), /decimalen/);
});
