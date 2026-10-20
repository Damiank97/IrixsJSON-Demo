import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTsModule } from "./load-ts-module.mjs";
const { checkValidity, demoValidityModel, allowedDeclarationTypes, allowedProjects, parseValidityModel } = loadTsModule("lib/declarationValidity.ts");
const input = { employee: "ALLARDJ", date: "2026-10-10", declarationType: "ZK", project: "PRJ-2026-01" };
const check = (changes = {}, model = demoValidityModel()) => checkValidity(model, { ...input, ...changes });

test("AND inside a row, OR across rows; BiId resolves to a separate cost-item", () => {
  assert.equal(check().allowed, true);
  assert.equal(check().values.item, "Kst:KM-ZAK");
  assert.equal(check().values.integrationGroup, "REIS");
  assert.equal(check({ project: "300000" }).ruleId, "GROEP-REIS-INT");
  const model = demoValidityModel(); model.rules = model.rules.filter(r => r.id === "GROEP-REIS-CONS");
  assert.equal(check({ project: "300000" }, model).allowed, false);
  assert.equal(check({ declarationType: "K01" }, model).allowed, false);
});

test("begin/end inclusive; temporary OV disappears outside its period", () => {
  for (const date of ["2026-10-01", "2026-10-15"]) assert.equal(check({ date, declarationType: "OV" }).allowed, true);
  for (const date of ["2026-09-30", "2026-10-16", "2026-02-30"]) assert.equal(check({ date, declarationType: "OV" }).allowed, false);
  assert.equal(allowedDeclarationTypes(demoValidityModel(), "ALLARDJ", "2026-10-20").some(t => t.code === "OV"), false);
});

test("team membership is an additional dated restriction, not bypassed by wildcards", () => {
  assert.match(check({ project: "PRJ-2026-02" }).reason, /teamlidmaatschap/);
  assert.equal(check({ employee: "MARA", date: "2026-10-14" }).allowed, false);
  assert.equal(check({ employee: "MARA", date: "2026-10-15" }).allowed, true);
  assert.equal(check({ employee: "MARA", date: "2027-01-01" }).allowed, false);
  const model = demoValidityModel(); model.rules = [{ id: "ALL", values: ["", ""], startDate: "", endDate: "" }];
  assert.equal(check({ project: "PRJ-2026-02" }, model).allowed, false);
  assert.equal(check({ project: "300000", declarationType: "K01" }, model).allowed, true);
});

test("unconfigured differs from enabled-but-empty; basic checks always apply", () => {
  const model = demoValidityModel("disabled");
  assert.equal(check({}, model).allowed, true);
  assert.equal(check({ project: "PRJ-2026-02" }, model).allowed, false);
  assert.equal(check({ project: "PRJ-GEBLOKKEERD" }, model).allowed, false);
  assert.equal(check({ declarationType: "VERVALLEN" }, model).allowed, false);
  assert.equal(check({ employee: "GEENRECHT" }, model).allowed, false);
  const empty = demoValidityModel(); empty.rules = [];
  assert.equal(check({}, empty).allowed, false);
});

test("dropdowns only show options with at least one complete permitted booking", () => {
  const model = demoValidityModel("function");
  assert.equal(allowedDeclarationTypes(model, "ALLARDJ", "2026-10-20").some(t => t.code === "ZK"), true);
  assert.equal(allowedDeclarationTypes(model, "MARA", "2026-10-20").some(t => t.code === "ZK"), false);
  assert.equal(allowedDeclarationTypes(model, "GEENRECHT", "2026-10-20").length, 0);
  assert.equal(allowedProjects(model, "ALLARDJ", "2026-10-20", "ZK").map(p => p.code).join(","), "PRJ-2026-01");
  assert.equal(check({ project: "" }).allowed, false);
  assert.equal(check({ project: "UNKNOWN" }).allowed, false);
  assert.equal(check({ declarationType: "UNKNOWN" }).allowed, false);
});

test("employee/project/item profile uses cost-item mapping, not the declaration code", () => {
  const model = demoValidityModel("individual");
  assert.equal(check({}, model).allowed, true);
  assert.equal(check({ employee: "MARA", project: "PRJ-2026-02" }, model).allowed, false);
  assert.equal(check({ employee: "MARA", project: "PRJ-2026-02", declarationType: "K01" }, model).allowed, true);
  model.rules[0].values[2] = "ZK"; model.rules = [model.rules[0]];
  assert.equal(check({ project: "300000" }, model).allowed, false);
});

test("import validates max three unique supported bases, metadata, dates and memberships", () => {
  for (const profile of ["groups", "individual", "function", "disabled"]) assert.equal(parseValidityModel(JSON.parse(JSON.stringify(demoValidityModel(profile)))).version, 1);
  const bad = (change) => { const m = JSON.parse(JSON.stringify(demoValidityModel())); change(m); return m; };
  for (const change of [m => m.bases.push("employee", "item"), m => m.bases = ["project", "project"], m => m.bases = ["dimension1"], m => delete m.enabled, m => m.rules[0].values = [""], m => m.rules[0].endDate = "2025-01-01", m => m.declarationTypes[0].itemCode = "", m => m.declarationTypes[0].decimals = 7, m => m.projects.push(m.projects[0]), m => m.teams[0].employee = "UNKNOWN"]) assert.throws(() => parseValidityModel(bad(change)));
  assert.throws(() => parseValidityModel([{ VaV1: "Kst", BaV1: "ZK" }]));
});
