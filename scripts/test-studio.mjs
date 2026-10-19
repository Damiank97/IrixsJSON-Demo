import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

const root = process.cwd(), nativeRequire = createRequire(import.meta.url);
function loader(environment = { IRIXS_AI_PROVIDER: "disabled" }, fakeFetch = () => { throw new Error("Geen externe aanvragen in deze test"); }) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(root, file); if (cache.has(file)) return cache.get(file);
    const exports = {}; cache.set(file, exports);
    const compiled = ts.transpileModule(readFileSync(file,"utf8"), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
    const require = (id) => id === "server-only" ? {} : id.startsWith("@/") ? load(`${id.slice(2)}.ts`) : id.startsWith(".") ? load(path.resolve(path.dirname(file),`${id}.ts`)) : nativeRequire(id);
    vm.runInNewContext(compiled, {exports,require,process:{env:environment,cwd:()=>root},crypto,structuredClone,fetch:fakeFetch,URL,AbortSignal,console}, {filename:file});
    return exports;
  }
  return load;
}
const load = loader();
const model = load("lib/studio/model.ts"), planner = load("lib/studio/planner.ts"), analytics = load("lib/studio/analytics.ts");

test("demodata is reproduceerbaar, filters gelden ook voor de vergelijkingsperiode", () => {
  assert.equal(analytics.demoRows("revenue").length,864);
  assert.equal(JSON.stringify(analytics.demoRows("revenue")),JSON.stringify(analytics.demoRows("revenue")));
  const d=planner.makeDashboard(); d.filters={year:2026,administration:model.ADMINS[0],fromMonth:2,toMonth:4};
  const rows=analytics.selectedRows(d), previous=analytics.selectedRows(d,2025);
  assert.equal(rows.length,36);assert.equal(previous.length,36);
  assert.equal(rows.every(r=>r.month>=2&&r.month<=4&&r.administration===model.ADMINS[0]),true);
  const growth=analytics.calculateMetric("growth",rows,previous), sum=r=>r.reduce((t,x)=>t+x.revenue,0);
  assert.equal(growth,(sum(rows)-sum(previous))/sum(previous)*100);
});
test("marges en declarabiliteit worden gewogen, nulnoemers geven geen verzonnen percentage", () => {
  const rows=[{revenue:100,profit:50,hours:10,billableHours:8},{revenue:900,profit:90,hours:90,billableHours:36}];
  assert.equal(analytics.calculateMetric("margin",rows,[]),14.000000000000002);
  assert.equal(analytics.calculateMetric("utilization",rows,[]),44);
  assert.equal(analytics.calculateMetric("growth",rows,[]),null);
  assert.equal(analytics.calculateMetric("margin",[],[]),null);
});
test("top-10 en maandindeling komen uit de gefilterde rijen", () => {
  const d=planner.makeDashboard(); const top=d.widgets.find(w=>w.dimension==="customer");
  const result=analytics.widgetData(d,top);assert.equal(result.series.length,10);
  assert.equal(result.series.every((x,i,a)=>!i||a[i-1].value>=x.value),true);
  assert.equal(analytics.widgetData(d,d.widgets.find(w=>w.kind==="bar"&&w.dimension==="month")).series.length,12);
});
test("vervolgvraag wijzigt componenten met behoud van id, filters en handmatige titels", () => {
  const d=planner.makeDashboard(); d.widgets[0].title="Mijn eigen KPI";d.filters.administration=model.ADMINS[1];
  const changed=planner.planQuestion("Verander de maandgrafiek naar een lijndiagram en voeg een KPI voor groei toe",d);
  assert.equal(changed.widgets[0].title,"Mijn eigen KPI");assert.equal(changed.filters.administration,model.ADMINS[1]);
  assert.equal(changed.widgets.every(w=>d.widgets.some(x=>x.id===w.id)),true);
  assert.equal(changed.widgets.find(w=>w.dimension==="month"&&w.kind!=="kpi").kind,"line");
});
test("ontbrekende bronnen en onbekende vragen worden zichtbaar, geen fictieve echte GetConnector", () => {
  assert.ok(planner.missingForQuestion("Verzuim per afdeling").length);
  assert.ok(planner.verifyKnowledge(planner.makeDashboard(),["hours"],"deterministic").missing);
  assert.throws(()=>planner.planQuestion("Een banaan"),/demo ondersteunt/);
  const result=planner.verifyKnowledge(planner.makeDashboard(),["revenue"],"deterministic");
  assert.ok(result.trace.fields.includes("revenue"));assert.equal(result.trace.checks.length,5);
});
test("schema weigert onbekende KPI, dimensie, dubbele id en ongeldige filters", () => {
  const d=planner.makeDashboard();
  assert.throws(()=>model.validateDashboard({...d,widgets:[{...d.widgets[0],metric:"salaris"}]}));
  assert.throws(()=>model.validateDashboard({...d,widgets:[{...d.widgets[0],dimension:"project"}]}));
  assert.throws(()=>model.validateDashboard({...d,widgets:[d.widgets[0],d.widgets[0]]}));
  assert.throws(()=>model.validateDashboard({...d,filters:{...d.filters,fromMonth:12,toMonth:1}}));
  assert.throws(()=>planner.applyAiPlan({title:d.title,description:d.description,dataset:d.dataset,widgets:[d.widgets[0]]},d),/behouden/);
});
test("knowledge gebruikt de bestaande officiële schema’s en markeert GetConnectoren als te bevestigen",async()=>{
  const knowledge=load("lib/studio/knowledge.ts");
  const evidence=await knowledge.getEvidence("KnOrganisation");assert.equal(evidence.id,"KnOrganisation");
  assert.ok(evidence.fields.some(f=>f.code==="Nm"&&f.type==="string"));assert.ok(evidence.version);
  const advice=await knowledge.integrationAdvice("CRM organisaties naar AFAS synchroniseren");
  assert.ok(advice.evidence.some(e=>e.id==="KnOrganisation"));assert.match(advice.candidate,/nog per omgeving/);
  assert.equal(await knowledge.getEvidence("../../.env"),null);
});
test("provider en bonmodel zijn verwisselbaar; uitgeschakeld betekent geen externe aanvraag",async()=>{
  const off=load("lib/aiProvider.ts");assert.equal(off.aiConfiguration().configured,false);
  await assert.rejects(()=>off.completeJson([{role:"user",content:"demo"}]),/niet geconfigureerd/);
  let seen;
  const custom=loader({IRIXS_AI_PROVIDER:"compatible",IRIXS_AI_BASE_URL:"https://example.invalid/v1",IRIXS_AI_API_KEY:"dummy",IRIXS_AI_MODEL:"text-model",IRIXS_RECEIPT_AI_MODEL:"vision-model"}, async(url,options)=>{seen={url:String(url),body:JSON.parse(options.body)};return Response.json({choices:[{message:{content:'{"description":"Voorbeeld","amount":12.5}'}}]});})("lib/aiProvider.ts");
  await custom.completeJson([{role:"user",content:[{type:"image_url",image_url:{url:"data:image/png;base64,DEMO"}}]}],{purpose:"receipt"});
  assert.equal(seen.url,"https://example.invalid/v1/chat/completions");assert.equal(seen.body.model,"vision-model");
});
test("bonherkenning en JSON-verbetering gebruiken het bestaande contract via de nieuwe adapter",async()=>{
  let seen=[];
  const configured=loader({IRIXS_AI_PROVIDER:"compatible",IRIXS_AI_BASE_URL:"https://example.invalid/v1",IRIXS_AI_API_KEY:"dummy",IRIXS_AI_MODEL:"text",IRIXS_RECEIPT_AI_MODEL:"vision"},async(url,options)=>{
    const body=JSON.parse(options.body);seen.push(body);
    return Response.json({choices:[{message:{content:JSON.stringify(body.model==="vision"?{description:"Parkeerbon",amount:12.5,date:"2026-10-19",merchant:"Demo",confidence:"hoog"}:{improved:{Demo:{Element:{Fields:{Nm:"Voorbeeld"}}}},notes:["Controleer de code"]})}}]});
  });
  const receipt=configured("app/api/receipt/route.ts");
  const response=await receipt.POST(new Request("http://localhost/api/receipt",{method:"POST",body:JSON.stringify({fileName:"demo.png",dataUrl:"data:image/png;base64,DEMO"})}));
  assert.equal(response.status,200);const result=await response.json();assert.equal(result.amount,12.5);assert.equal(seen[0].model,"vision");
  const improve=configured("app/api/improve/route.ts");
  const improved=await improve.POST(new Request("http://localhost/api/improve",{method:"POST",body:JSON.stringify({connectorId:"Demo",method:"POST",schema:{type:"object"},currentPayload:{Demo:{Element:{Fields:{Nm:""}}}}})}));
  assert.equal(improved.status,200);assert.equal((await improved.json()).improved.Demo.Element.Fields.Nm,"Voorbeeld");assert.equal(seen[1].model,"text");
});
