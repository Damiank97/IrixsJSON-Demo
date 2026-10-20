import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server.js";
import { loadTsModule } from "./load-ts-module.mjs";
const request = (type) => new NextRequest("http://localhost/api/afas/lookups?type=" + type);

test("demo lookups share one grounded model only when AFAS is completely unconfigured", async () => {
  const { GET } = loadTsModule("app/api/afas/lookups/route.ts");
  const data = await (await GET(request("validityCombinations"))).json();
  assert.equal(data.source, "demo"); assert.equal(data.model.bases.join(","), "projectGroup,integrationGroup");
  const types = await (await GET(request("declarationTypes"))).json();
  assert.equal(types.options.find(t => t.code === "ZK").decimals, 3);
});

test("partial AFAS configuration never falls back to demo permissions", async () => {
  for (const env of [{ AFAS_TOKEN: "test" }, { AFAS_PROJECTS_GETCONNECTOR: "Projects" }, { AFAS_BASE_URL: "https://example.test" }]) {
    const { GET } = loadTsModule("app/api/afas/lookups/route.ts", { env });
    for (const type of ["projects", "declarationTypes", "validityCombinations"]) assert.equal((await GET(request(type))).status, 503);
  }
});

test("cost-type precision is read explicitly; invalid precision fails closed", async () => {
  const env = { AFAS_TOKEN: "test", AFAS_BASE_URL: "https://example.test", AFAS_DECLARATION_TYPES_GETCONNECTOR: "Types" };
  for (const [decimals, status] of [[0, 200], [2, 200], [3, 200], ["", 200], [7, 502], [1.5, 502]]) {
    const { GET } = loadTsModule("app/api/afas/lookups/route.ts", { env, fetch: async () => Response.json({ rows: [{ BiId: "ZK", Omschrijving: "Km", Invoertype: "kilometers", Decimalen: decimals }] }) });
    const response = await GET(request("declarationTypes")); assert.equal(response.status, status);
    const body = await response.json();
    if (status === 200) assert.equal(body.options[0].decimals, decimals === "" ? undefined : decimals);
    else assert.equal(body.source, "error");
  }
});
