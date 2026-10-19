import assert from "node:assert/strict";
import { test } from "node:test";
import { DEMO_COMBINATIONS, matchesCombination, parseCombinations, validDate } from "../lib/declarationRules.ts";

test("een regel vereist dezelfde medewerker, soort en project, op een geldige datum", () => {
  const rule = DEMO_COMBINATIONS[0];
  assert.equal(matchesCombination(rule, "ALLARDJ", "2026-10-19", "K01", "300000"), true);
  assert.equal(matchesCombination(rule, "ANDER", "2026-10-19", "K01", "300000"), false);
  assert.equal(matchesCombination(rule, "ALLARDJ", "2026-10-19", "ZK", "300000"), false);
  assert.equal(matchesCombination(rule, "ALLARDJ", "2026-10-19", "K01", "PRJ-2026-02"), false);
});

test("begin/einddatum zijn inclusief; buiten de periode is de combinatie ongeldig", () => {
  const rule = DEMO_COMBINATIONS.at(-1);
  for (const date of ["2026-10-01", "2026-10-31"]) assert.equal(matchesCombination(rule, "ALLARDJ", date, "OV", "PRJ-2026-02"), true);
  for (const date of ["2026-09-30", "2026-11-01", "2026-02-30", ""]) assert.equal(matchesCombination(rule, "ALLARDJ", date, "OV", "PRJ-2026-02"), false);
});

test("expliciet lege grondslagen zijn wildcards; ontbrekende kolommen niet", () => {
  const [rule] = parseCombinations([{ Medewerker: "", Project: "", Declaratiesoort: "ZK", Begindatum: "", Einddatum: "" }]);
  assert.equal(matchesCombination(rule, "ANDER", "2026-10-19", "ZK", "ANDER-PROJECT"), true);
  assert.equal(matchesCombination(rule, "ANDER", "2026-10-19", "K01", "ANDER-PROJECT"), false);
  assert.throws(() => parseCombinations([{ Declaratiesoort: "ZK" }]), /ontbreekt/);
  assert.throws(() => parseCombinations([{ VaV1: "Kst", BaV1: "ZK" }]), /ontbreekt/);
});

test("typefilter vóór projectkeuze geeft alleen toegestane soorten op datum", () => {
  const allowed = (date) => ["K01", "ZK", "OV"].filter((type) => DEMO_COMBINATIONS.some((rule) => matchesCombination(rule, "ALLARDJ", date, type)));
  assert.deepEqual(allowed("2026-09-30"), ["K01", "ZK"]);
  assert.deepEqual(allowed("2026-10-19"), ["K01", "ZK", "OV"]);
  const projects = ["300000", "PRJ-2026-01", "PRJ-2026-02"].filter((project) => DEMO_COMBINATIONS.some((rule) => matchesCombination(rule, "ALLARDJ", "2026-10-19", "OV", project)));
  assert.deepEqual(projects, ["PRJ-2026-02"]);
});

test("veldafbeelding en AFAS ISO-tijdstempels; foute datum of omgekeerde periode afkeuren", () => {
  const data = { EmId: "ALLARDJ", PrId: "300000", BiId: "ZK", DaBe: "2026-10-01T00:00:00", DaEn: "2026-10-31T00:00:00Z" };
  const fields = { employee: "EmId", project: "PrId", declarationType: "BiId", startDate: "DaBe", endDate: "DaEn" };
  assert.equal(parseCombinations([data], fields)[0].endDate, "2026-10-31");
  assert.throws(() => parseCombinations([{ ...data, DaEn: "2026-09-01" }], fields), /vóór/);
  assert.throws(() => parseCombinations([{ ...data, DaBe: "2026-02-30" }], fields), /JJJJ/);
  assert.equal(validDate("2028-02-29"), true);
  assert.equal(validDate("2026-02-29"), false);
  assert.deepEqual(parseCombinations([]), []);
});
