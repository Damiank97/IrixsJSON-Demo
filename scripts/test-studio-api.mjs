import assert from "node:assert/strict";
const base="http://localhost:3001";
const login=await fetch(`${base}/api/auth/login`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:"local-studio-qa"})});
assert.equal(login.status,200);const internal=login.headers.get("set-cookie").split(";")[0];
async function call(path,body,cookie=internal){return fetch(`${base}${path}`,{method:body===undefined?"GET":"POST",headers:{Cookie:cookie,"Content-Type":"application/json"},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:"manual"});}
const request={question:"Omzet per maand, vorig jaar en top 10 klanten",available:["revenue","hours"]};
let response=await call("/api/studio/generate",request);assert.equal(response.status,200);const generated=await response.json();
assert.ok(generated.dashboard);assert.equal(generated.trace.source,"deterministic");assert.equal(generated.trace.checks.length,6);
assert.ok(generated.trace.checks.some(s=>s.label.includes("kennisbank")));
const d=generated.dashboard;d.widgets[0].title="Handmatig behouden";
response=await call("/api/studio/generate",{...request,current:d,question:"Verander de maandgrafiek naar een lijndiagram en voeg groei toe"});
const modified=await response.json();assert.equal(modified.dashboard.widgets[0].id,d.widgets[0].id);assert.equal(modified.dashboard.widgets[0].title,"Handmatig behouden");
assert.equal(modified.dashboard.widgets.find(w=>w.kind==="line"&&w.dimension==="month")!==undefined,true);
const missing=await(await call("/api/studio/generate",{...request,question:"Verzuimpercentage per afdeling"})).json();assert.ok(missing.missing);assert.equal(missing.dashboard,undefined);
const disabled=await(await call("/api/studio/generate",{...request,available:["hours"]})).json();assert.ok(disabled.missing);
assert.equal((await call("/api/studio/generate",{question:""})).status,400);
assert.equal((await call("/api/knowledge?id=KnOrganisation")).status,200);
assert.equal((await call("/studio/data")).status,200);
const advice=await(await call("/api/knowledge",{question:"CRM naar AFAS synchroniseren"})).json();assert.ok(advice.evidence.some(e=>e.id==="KnOrganisation"));
const scoped=await call("/api/studio/session",{});assert.equal(scoped.status,200);const customer=scoped.headers.get("set-cookie").split(";")[0];
assert.equal((await call("/studio",undefined,customer)).status,200);
for(const url of ["/internal","/studio/data","/","/connector/KnOrganisation"]){const r=await call(url,undefined,customer);assert.equal(r.status,307);assert.equal(new URL(r.headers.get("location"),base).pathname,"/studio");}
for(const url of ["/api/knowledge?id=KnOrganisation","/api/receipt","/api/improve","/api/studio/session"]){assert.equal((await call(url,url.includes("?")?undefined:{},customer)).status,403);}
assert.equal((await call("/api/studio/generate",request,customer)).status,200);
assert.equal((await fetch(`${base}/api/knowledge`)).status,401);
console.log("Studio API: genereren, wijzigen, ontbrekende bronnen en server-side klant/interne scheiding geslaagd.");
