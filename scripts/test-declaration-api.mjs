// Tegen een lokale productiepreview met SITE_PASSWORD_HASH voor local-declarations-qa.
import assert from "node:assert/strict";
const base = "http://localhost:3001";
assert.equal((await fetch(`${base}/api/distance`)).status, 401);
const login = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: "local-declarations-qa" }) });
assert.equal(login.status, 200);
const cookie = login.headers.get("set-cookie").split(";")[0];
async function get(path) { return fetch(`${base}${path}`, { headers: { Cookie: cookie } }); }
async function post(body, status = 200) {
  const response = await fetch(`${base}/api/distance`, { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) });
  assert.equal(response.status, status);
  return response.json();
}
const config = await (await get("/api/distance")).json();
assert.equal(typeof config.google, "boolean"); assert.equal(typeof config.tomtom, "boolean");
const combinations = await (await get("/api/afas/lookups?type=validityCombinations")).json();
assert.equal(combinations.source, "demo"); assert.equal(combinations.model.version, 1);
assert.deepEqual(combinations.model.bases, ["projectGroup", "integrationGroup"]);
assert.equal(combinations.model.rules.length, 4);
assert.equal((await get("/api/afas/lookups?type=unknown")).status, 400);
const single = await post({ provider: "demo", from: "Enter", to: "Utrecht" });
assert.equal(single.kilometers, 126); assert.equal(single.roundTrip, false); assert.equal(single.demo, true);
assert.equal(single.preference, "shortest"); assert.equal(single.calculationVersion, 2);
assert.equal(single.parity, "afas-reference-not-verified");
const fastest = await post({ provider: "demo", from: "Enter", to: "Utrecht", preference: "fastest", roundTrip: true });
assert.equal(fastest.kilometers, 276); assert.equal(fastest.returnMethod, "double-single");
const retour = await post({ provider: "demo", from: "Enter", to: "Utrecht", roundTrip: true });
assert.equal(retour.kilometers, 252); assert.equal(retour.outboundKilometers, 126); assert.equal(retour.returnKilometers, 126);
await post({ provider: "demo", from: "Enter", to: "Amsterdam" }, 502);
await post({ provider: "google", from: "", to: "Utrecht" }, 400);
await post({ provider: "unofficial", from: "Enter", to: "Utrecht" }, 400);
await post({ provider: "demo", from: "Enter", to: "Utrecht", roundTrip: "false" }, 400);
await post({ provider: "demo", from: "Enter", to: "Utrecht", decimals: 7 }, 400);
await post("{", 400);
await post("x".repeat(5000), 413);
if (!config.google) await post({ provider: "google", from: "Enter", to: "Utrecht" }, 503);
if (!config.tomtom) await post({ provider: "tomtom", from: "Enter", to: "Utrecht" }, 503);
console.log("Declaratie-API: authenticatie, filters, enkele/retourrit, invoerfouten en ontbrekende keys geslaagd.");
