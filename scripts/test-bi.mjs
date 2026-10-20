import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import path from "node:path";
import vm from "node:vm";
import {createRequire} from "node:module";
import ts from "typescript";
const native=createRequire(import.meta.url),cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);const require=id=>id.startsWith("@/")?load(`${id.slice(2)}.ts`):id.startsWith(".")?load(path.resolve(path.dirname(file),`${id}.ts`)):native(id);vm.runInNewContext(ts.transpileModule(readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{exports,require,crypto,structuredClone,console,Intl,Date,setTimeout,URL,Blob});return exports;}
const f=load("lib/bi/formula.ts"),m=load("lib/bi/model.ts"),files=load("lib/bi/files.ts");
test("veilige formules hebben rekenvolgorde, luie IF, Nederlandse functies en nulcontrole",()=>{
  for(const [input,want] of [["2+3*4",14],["-2^2",-4],["2^3^2",512],["ALS([n]=0; 8; 1/[n])",8],["AFRONDEN(10/3;2)",3.33],["IF([kind]=\"Behoefte\";1;0)",1]])assert.equal(f.compileFormula(input).evaluate({n:0,kind:"Behoefte"}),want);
  assert.equal(f.compileFormula("1/0").evaluate({}),null);assert.equal(f.compileFormula("[missing]+4").evaluate({}),null);
  for(const bad of ["fetch(1)","globalThis.alert(1)","[n];alert(1)","1e999","(".repeat(40)+"1"+")".repeat(40)])assert.throws(()=>f.compileFormula(bad));
});
test("berekende kolommen weigeren onbekende velden en kringverwijzingen",()=>{
  const c=(id,formula)=>({id,label:id,type:"number",formula});
  assert.throws(()=>m.orderedFormulas([c("a","[b]"),c("b","[a]")]));
  assert.throws(()=>m.orderedFormulas([c("a","[onbekend]")]));
  assert.equal(m.orderedFormulas([c("a","2"),c("b","[a]*3")])[1].id,"b");
});
test("PURE bevat behoefte zonder medewerker; afgeleide dekking rekent onmiddellijk door",()=>{
  const w=m.demoWorkspace();m.validateWorkspace(w);
  const pure=w.datasets.find(d=>d.id==="pure");assert.ok(pure.rows.some(r=>r.values.recordType==="Behoefte"&&r.values.employeeId===null));
  const before=m.modelRows(w,"coverage").reduce((n,r)=>n+r.values.openHours,0);
  const group=m.modelRows(w,"coverage").find(r=>r.values.openHours>0);
  const need=pure.rows.find(r=>r.values.recordType==="Behoefte"&&["year","week","project","functionId","administration"].every(key=>r.values[key]===group.values[key]));const next=m.editCell(w,"pure",need.id,"amount",String(need.values.amount+8));
  const after=m.modelRows(next,"coverage").reduce((n,r)=>n+r.values.openHours,0);
  assert.ok(Math.abs(after-before-8)<1e-8);assert.equal(next.edits.length,1);
  assert.throws(()=>m.editCell(w,"coverage","derived-0","openHours","10"));
});
test("relaties gebruiken unieke opzoeksleutels en maken geen verdubbelde bedragen",()=>{
  const w=m.demoWorkspace(),before=m.modelRows(w,"finance").reduce((n,r)=>n+r.values.revenue,0);
  assert.equal(before,w.datasets.find(d=>d.id==="finance").rows.reduce((n,r)=>n+r.values.revenue,0));
  assert.ok(m.modelRows(w,"finance")[0].values["customers.region"]);
  const customers=w.datasets.find(d=>d.id==="customers");customers.rows.push({...customers.rows[0],id:"duplicate"});
  assert.throws(()=>m.modelRows(w,"finance"),/dubbele/);assert.throws(()=>m.validateWorkspace(w));
});
test("bronnen worden apart geaggregeerd en daarna vergeleken, niet op factregelniveau gejoined",()=>{
  const w=m.demoWorkspace(),visual=w.visuals.find(v=>v.id==="bi-month"),result=m.visualData(w,visual,{year:"2026",administration:"all"});
  const left=w.datasets.find(d=>d.id==="finance").rows.filter(r=>r.values.year===2026&&r.values.month===1).reduce((n,r)=>n+r.values.revenue,0);
  const right=w.datasets.find(d=>d.id==="budgets").rows.filter(r=>r.values.year===2026&&r.values.month===1).reduce((n,r)=>n+r.values.budget,0);
  assert.equal(result.points[0].value,left);assert.equal(result.points[0].comparison,right);assert.equal(result.points.length,12);
});
test("formules over totalen geven gewogen marges; onverenigbare selectiefilters blokkeren",()=>{
  const rows=[{values:{revenue:100,profit:50}},{values:{revenue:900,profit:90}}];
  assert.equal(m.aggregate(rows,{field:"profit",aggregation:"formula",expression:"[profit]/[revenue]*100"}),14.000000000000002);
  const w=m.demoWorkspace(),visual=w.visuals.find(v=>v.id==="bi-month");
  assert.throws(()=>m.visualData(w,visual,{year:"2026",administration:"all",selection:{field:"customer",value:"Atlas Groep"}}),/filterveld/);
  const columns=m.modelColumns(w,"finance");assert.ok(m.filterRows(m.modelRows(w,"finance"),columns,{year:"all",administration:"all",selection:{field:"month",value:1,year:2026}}).every(r=>r.values.year===2026&&r.values.month===1));
});
test("import bewaart voorloopnullen, weigert te grote tabellen en CSV beschermt formulecellen",()=>{
  const data=files.datasetFromTable("Test.csv",["Code","Bedrag"],[{Code:"0012",Bedrag:"15,5"},{Code:"0013",Bedrag:"20"}]);
  assert.equal(data.columns[0].type,"text");assert.equal(data.rows[0].values.code,"0012");assert.equal(data.rows[0].values.bedrag,15.5);
  assert.throws(()=>files.datasetFromTable("groot",["a"],Array.from({length:5001},()=>({a:1}))));
  const csv=files.csvFromRows([{id:"x",label:"x",type:"text"}],[{id:"1",values:{x:"=HYPERLINK(1)"}}]);assert.ok(csv.includes("'=HYPERLINK"));
});
test("werkplek-back-ups valideren ook historie, celtypen, dubbele grafiek-id’s en afleidingscycli",()=>{
  const badHistory=m.demoWorkspace();badHistory.edits=[{id:"x",dataset:"pure",row:"1",column:"amount",at:new Date().toISOString(),before:{unexpected:true},after:1}];assert.throws(()=>m.validateWorkspace(badHistory),/historie/);
  const badType=m.demoWorkspace();badType.datasets[0].rows[0].values.revenue="geen bedrag";assert.throws(()=>m.validateWorkspace(badType),/Celtype/);
  const duplicate=m.demoWorkspace();duplicate.visuals.push(duplicate.visuals[0]);assert.throws(()=>m.validateWorkspace(duplicate),/grafiekinstelling/);
  const cycle=m.demoWorkspace();cycle.datasets.find(d=>d.id==="needs").view.source="needs";assert.throws(()=>m.validateWorkspace(cycle),/kringverwijzing/);
});
test("functieselectie filtert behoefte en medewerkerplanning via gedeelde dimensie",()=>{
  const w=m.demoWorkspace(),filters={year:"2026",administration:"all",selection:{field:"functions.functionName",value:"Engineer"}};
  const coverage=m.filterRows(m.modelRows(w,"coverage"),m.modelColumns(w,"coverage"),filters),planned=m.filterRows(m.modelRows(w,"planned"),m.modelColumns(w,"planned"),filters);
  assert.ok(coverage.length&&planned.length);assert.ok(coverage.every(r=>r.values.functionId==="F3"));assert.ok(planned.every(r=>r.values.functionId==="F3"));
});
test("vergelijkingsvelden kunnen verschillend heten; gekoppelde selectie vertaalt mee",()=>{
  const w=m.demoWorkspace(),extra=files.datasetFromTable("Andere klantnaam.csv",["Naam","Waarde"],[{Naam:"Atlas Groep",Waarde:20},{Naam:"Atlas Groep",Waarde:30}]);w.datasets.push(extra);
  const visual={id:"paired",title:"Gekoppelde groepen",source:"finance",dimension:"customer",measure:{field:"revenue",aggregation:"sum"},compare:{source:extra.id,dimension:"naam",measure:{field:"waarde",aggregation:"sum"}},kind:"table",top:20};
  const result=m.visualData(w,visual,{year:"all",administration:"all",selection:{field:"customer",value:"Atlas Groep"}});
  assert.equal(result.points.length,1);assert.equal(result.points[0].comparison,50);
});
