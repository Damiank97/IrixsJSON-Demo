import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import path from "node:path";
import vm from "node:vm";
import {createRequire} from "node:module";
import ts from "typescript";
const native=createRequire(import.meta.url),cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);const require=id=>id.startsWith("@/")?load(`${id.slice(2)}.ts`):id.startsWith(".")?load(path.resolve(path.dirname(file),`${id}.ts`)):native(id);vm.runInNewContext(ts.transpileModule(readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{exports,require,crypto,structuredClone,console,Intl,Date,setTimeout,URL,Blob});return exports;}
const f=load("lib/bi/formula.ts"),m=load("lib/bi/model.ts"),files=load("lib/bi/files.ts"),studio=load("lib/bi/studio.ts"),planner=load("lib/studio/planner.ts"),oldModel=load("lib/studio/model.ts"),analytics=load("lib/studio/analytics.ts");
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

test("één Studio neemt beide oude opslagen over zonder de originelen te schrijven",()=>{
  const bi=m.demoWorkspace(),old=planner.demoDashboards();
  bi.datasets.find(d=>d.id==="pure").rows[0].values.amount=99;
  bi.datasets.find(d=>d.id==="finance").columns.push({id:"extra",label:"Eigen formule",type:"number",formula:"[profit]*2"});
  old[0].title="Mijn bewaarde dashboard";old[0].widgets[0].title="Handmatige KPI-titel";
  const data=new Map([[m.BI_STORAGE,JSON.stringify(bi)],[oldModel.STUDIO_STORAGE,JSON.stringify(old)]]),snapshot=JSON.stringify([...data]);
  const loaded=studio.loadStudio({getItem:key=>data.get(key)??null},true),w=loaded.workspace;
  assert.equal(w.dashboards.length,5);assert.ok(loaded.migrated);assert.equal(w.datasets.find(d=>d.id==="pure").rows[0].values.amount,99);
  assert.equal(w.datasets.find(d=>d.id==="finance").columns.at(-1).id,"extra");assert.equal(w.dashboards.find(d=>d.id===old[0].id).title,old[0].title);
  assert.ok(w.visuals.some(v=>v.title==="Handmatige KPI-titel"));assert.equal(JSON.stringify([...data]),snapshot);
  const reloaded=studio.loadStudio({getItem:key=>key===studio.UNIFIED_STORAGE?JSON.stringify(w):data.get(key)??null},true).workspace;
  assert.equal(reloaded.visuals.length,w.visuals.length);assert.equal(reloaded.dashboards.length,w.dashboards.length);
});

test("oude KPI’s en vorig-jaar vergelijkingen behouden hun betekenis in de gedeelde grafiekkern",()=>{
  let w=studio.defaultStudio();
  for(const dataset of ["revenue","hours"]){const d=planner.makeDashboard(dataset);d.filters={year:2025,administration:oldModel.ADMINS[0],fromMonth:2,toMonth:7};d.widgets=Object.entries(oldModel.METRICS).filter(([,m])=>m.dataset===dataset).map(([metric])=>({...oldModel.newWidget(metric,"line","month"),compare:true}));w=studio.addDashboard(w,d);
    for(const widget of d.widgets){const visual=w.visuals.find(v=>v.id===`${d.id}::${widget.id}`),actual=m.visualData(w,visual,{...d.filters,year:String(d.filters.year)}),before=analytics.widgetData(d,widget);
      assert.ok(Math.abs(actual.total-before.value)<1e-8,widget.metric);assert.ok(Math.abs(actual.comparison-before.previous)<1e-8,`${widget.metric} prior`);
      for(let i=0;i<before.series.length;i++){assert.ok(Math.abs(actual.points[i].value-before.series[i].value)<1e-8,`${widget.metric} group`);assert.ok(Math.abs(actual.points[i].comparison-before.series[i].previous)<1e-8,`${widget.metric} prior group`);}
    }
  }
});

test("bewerkte brongegevens voeden zowel gemigreerde dashboards als eigen analyses",()=>{
  const w=studio.defaultStudio(),board=w.dashboards.find(b=>b.id==="demo-omzet"),visual=w.visuals.find(v=>v.page===board.id&&v.measure.field==="revenue"&&v.kind==="kpi"),filters={year:"2026",administration:"all"};
  const row=w.datasets.find(d=>d.id==="finance").rows.find(r=>r.values.year===2026),before=m.visualData(w,visual,filters).total,next=m.editCell(w,"finance",row.id,"revenue",String(row.values.revenue+123));
  assert.equal(m.visualData(next,visual,filters).total,before+123);
  const budget=w.visuals.find(v=>v.id==="bi-month");assert.equal(m.visualData(next,budget,filters).total-m.visualData(w,budget,filters).total,123);
});

test("AI-vervolgopdrachten gebruiken actuele instellingen, behouden ids en weigeren onveilige contractvertaling",()=>{
  const w=studio.defaultStudio(),board=w.dashboards.find(b=>b.id==="demo-omzet"),legacy=studio.toDashboard(w,board);assert.ok(legacy);
  legacy.widgets[0].title="Mijn nieuwe titel";
  const changed=studio.addDashboard(w,legacy);assert.equal(changed.visuals.find(v=>v.id===legacy.widgets[0].id).title,"Mijn nieuwe titel");
  assert.equal(studio.toDashboard(changed,board).widgets[0].id,legacy.widgets[0].id);
  changed.visuals.find(v=>v.page===board.id).kind="scatter";assert.equal(studio.toDashboard(changed,board),null);
});

test("klantdemo leest geen interne imports of oude interne opslag",()=>{
  const reads=[],loaded=studio.loadStudio({getItem:key=>{reads.push(key);return null;}},false);
  assert.equal(reads.length,1);assert.equal(reads[0],studio.CUSTOMER_STORAGE);assert.equal(loaded.workspace.datasets.some(d=>d.origin==="import"),false);
});

test("nieuwe opslag en back-ups weigeren verweesde grafieken en te veel componenten",()=>{
  const w=studio.defaultStudio();w.visuals[0].page="niet-bestaand";assert.throws(()=>studio.validateStudio(w),/bestaand/);
  const many=studio.defaultStudio(),v=many.visuals[0];many.visuals.push(...Array.from({length:25},(_,i)=>({...v,id:`extra-${i}`})));assert.throws(()=>studio.validateStudio(many),/dashboard/);
  const converted=studio.importStudio(m.demoWorkspace());assert.ok(converted.dashboards.some(b=>b.id==="planning"));
  const f={year:"all",administration:"all"},growth=studio.defaultStudio().visuals.find(v=>v.measure.aggregation==="growth");assert.throws(()=>m.visualData(studio.defaultStudio(),growth,f),/één jaar/);
});
