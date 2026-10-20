import { demoRows } from "@/lib/studio/analytics";
import { compileFormula, type Cell } from "./formula";
export type { Cell } from "./formula";
export type Column = { id:string; label:string; type:"number"|"text"|"boolean"; format?:"currency"|"percent"|"number"; formula?:string };
export type RecordRow = { id:string; values:Record<string,Cell> };
export type Dataset = { id:string; name:string; origin:"demo"|"import"|"derived"; columns:Column[]; rows:RecordRow[]; view?:{source:string;field:string;value:Cell}; derive?:{groupBy:string[];left:{source:string;measure:Measure;output:string};right:{source:string;measure:Measure;output:string}} };
export type Relation = { id:string; from:string; to:string; pairs:{from:string;to:string}[] };
export type Measure = { field:string; aggregation:"sum"|"average"|"count"|"distinct"|"min"|"max"|"formula"|"growth"; expression?:string; format?:Column["format"]; positiveOnly?:string };
export type Visual = { id:string; title:string; source:string; dimension:string; measure:Measure; kind:"kpi"|"bar"|"line"|"area"|"table"|"scatter"; compare?:{source:string;measure:Measure;dimension?:string;period?:"previousYear"}; top:number; page?:string;width?:"half"|"full" };
export type Edit = { id:string; dataset:string; row:string; column:string; before:Cell; after:Cell; at:string };
export type Workspace = { version:1; name:string; datasets:Dataset[]; relations:Relation[]; visuals:Visual[]; edits:Edit[]; savedAt:string|null };
export type Filters = { year:string; administration:string; fromMonth?:number; toMonth?:number; selection?:{field:string;value:Cell;year?:number} };
export const BI_STORAGE="irixs-data-studio-v1";

export function demoWorkspace():Workspace {
  // Keep the original 2025/26 row ids stable; append history for prior-year KPIs.
  const financial=[...demoRows("revenue").filter(r=>r.year>=2025),...demoRows("revenue").filter(r=>r.year===2024)],hours=[...demoRows("hours").filter(r=>r.year>=2025),...demoRows("hours").filter(r=>r.year===2024)];
  const clients=[...new Set(financial.map(r=>r.customer))];
  const money=(id:string,label:string):Column=>({id,label,type:"number",format:"currency"});
  const period:Column[]=[{id:"year",label:"Jaar",type:"number"},{id:"month",label:"Maand",type:"number"},{id:"administration",label:"Administratie",type:"text"}];
  const budgets=new Map<string,Record<string,Cell>>();
  for(const row of financial){const key=JSON.stringify([row.year,row.month,row.administration]);const previous=budgets.get(key);budgets.set(key,{year:row.year,month:row.month,administration:row.administration,budget:Number(previous?.budget??0)+row.revenue*(row.month%3===0?1.04:.96)});}
  const datasets:Dataset[]=[
    {id:"finance",name:"Omzetregels",origin:"demo",columns:[...period,{id:"customer",label:"Klant",type:"text"},money("revenue","Omzet"),money("profit","Brutowinst"),money("costs","Directe kosten"),{id:"margin",label:"Marge % per regel",type:"number",format:"percent",formula:"IF([revenue] = 0; NULL; [profit] / [revenue] * 100)"}],rows:financial.map((r,i)=>({id:`f-${i}`,values:{year:r.year,month:r.month,administration:r.administration,customer:r.customer,revenue:r.revenue,profit:r.profit,costs:Math.round((r.revenue-r.profit)*100)/100}}))},
    {id:"budgets",name:"Omzetbudgetten",origin:"demo",columns:[...period,money("budget","Omzetbudget")],rows:[...budgets.values()].map((r,i)=>({id:`b-${i}`,values:{...r,budget:Math.round(Number(r.budget)*100)/100}}))},
    {id:"customers",name:"Klanten",origin:"demo",columns:[{id:"customer",label:"Klant",type:"text"},{id:"region",label:"Regio",type:"text"},{id:"sector",label:"Sector",type:"text"}],rows:clients.map((customer,i)=>({id:`c-${i}`,values:{customer,region:["Noord","Midden","Zuid"][i%3],sector:["Advies","Techniek","Dienstverlening"][i%3]}}))},
    {id:"hours",name:"Projecturen",origin:"demo",columns:[...period,{id:"project",label:"Project",type:"text"},{id:"hours",label:"Geschreven uren",type:"number"},{id:"billableHours",label:"Declarabele uren",type:"number"}],rows:hours.map((r,i)=>({id:`h-${i}`,values:{year:r.year,month:r.month,administration:r.administration,project:r.project,hours:r.hours,billableHours:r.billableHours}}))},
  ];
  const planning=planningSources(); datasets.push(...planning.datasets);
  return {version:1,name:"Planning, behoefte & resultaat",datasets,relations:[{id:"rel-customers",from:"finance",to:"customers",pairs:[{from:"customer",to:"customer"}]},...planning.relations],visuals:[...([
    {id:"bi-month",title:"Omzet versus budget",source:"finance",dimension:"month",measure:{field:"revenue",aggregation:"sum"},kind:"bar",compare:{source:"budgets",measure:{field:"budget",aggregation:"sum"}},top:12},
    {id:"bi-region",title:"Omzet per regio",source:"finance",dimension:"customers.region",measure:{field:"revenue",aggregation:"sum"},kind:"bar",top:12},
    {id:"bi-customers",title:"Brutowinst per klant",source:"finance",dimension:"customer",measure:{field:"profit",aggregation:"sum"},kind:"table",top:12},
    {id:"bi-hours",title:"Geschreven versus declarabele uren",source:"hours",dimension:"month",measure:{field:"hours",aggregation:"sum"},kind:"line",compare:{source:"hours",measure:{field:"billableHours",aggregation:"sum"}},top:12},
  ] as Visual[]).map(v=>({...v,page:"finance" as const})),...planning.visuals],edits:[],savedAt:null};
}

function planningSources():{datasets:Dataset[];relations:Relation[];visuals:Visual[]} {
  const functions=["Adviseur","Consultant","Engineer","Projectleider"],projects=["Implementatie","Optimalisatie","Ondersteuning","Doorontwikkeling"];
  const people=["Alex","Bo","Charlie","Dani","Eli","Fay","Gio","Harper","Isa","Jules","Kim","Lou"];
  const employees:Dataset={id:"employees",name:"Medewerkers",origin:"demo",columns:[{id:"employeeId",label:"Medewerkercode",type:"text"},{id:"employeeName",label:"Medewerker",type:"text"},{id:"functionId",label:"Functiecode",type:"text"},{id:"weeklyCapacity",label:"Capaciteit per week",type:"number"}],rows:people.map((name,i)=>({id:`emp-${i}`,values:{employeeId:`DEMO${String(i+1).padStart(3,"0")}`,employeeName:`${name} Demo`,functionId:`F${i%4+1}`,weeklyCapacity:i%3===0?32:40}}))};
  const period:Column[]=[{id:"year",label:"Jaar",type:"number"},{id:"week",label:"Week",type:"number"},{id:"administration",label:"Administratie",type:"text"},{id:"project",label:"Project",type:"text"},{id:"functionId",label:"Functiecode",type:"text"}];
  const pure:Dataset={id:"pure",name:"PURE vrije bestandsregels",origin:"demo",columns:[{id:"sequence",label:"Volgnummer (demo)",type:"number"},{id:"date",label:"Weekdatum",type:"text"},...period,{id:"recordType",label:"Soort regel",type:"text"},{id:"employeeId",label:"Medewerkercode",type:"text"},{id:"amount",label:"Aantal uren",type:"number"}],rows:[]};
  let sequence=1;
  for(let week=36;week<=48;week++)for(let p=0;p<projects.length;p++)for(let f=0;f<functions.length;f++){
    const date=new Date(Date.UTC(2026,7,31+(week-36)*7)).toISOString().slice(0,10),required=12+p*3+f*2+((week*2+p+f)%5)*2;
    const planned=(week+p+f)%11===0?0:(week+p+f)%9===0?required+4:Math.max(0,required-((week+p*2+f)%5)*3);
    const values={year:2026,week,administration:"Irixs Demo Noord",project:projects[p],functionId:`F${f+1}`,date};
    pure.rows.push({id:`pure-${sequence}`,values:{...values,sequence:sequence++,recordType:"Behoefte",employeeId:null,amount:required}});
    if(planned>0)for(let allocation=0;allocation<2;allocation++){const employee=employees.rows.filter(r=>r.values.functionId===values.functionId)[(week+p+allocation)%3];pure.rows.push({id:`pure-${sequence}`,values:{...values,sequence:sequence++,recordType:"Planning",employeeId:employee.values.employeeId,amount:Math.round(planned*(allocation===0?.6:.4)*100)/100}});}
  }
  const needs:Dataset={id:"needs",name:"Behoefte (uit PURE)",origin:"derived",columns:pure.columns,rows:[],view:{source:"pure",field:"recordType",value:"Behoefte"}};
  const planned:Dataset={id:"planned",name:"Ingepland (uit PURE)",origin:"derived",columns:pure.columns,rows:[],view:{source:"pure",field:"recordType",value:"Planning"}};
  const coverage:Dataset={id:"coverage",name:"Planningsdekking",origin:"derived",columns:[...period,{id:"requiredHours",label:"Benodigd",type:"number"},{id:"plannedHours",label:"Ingepland",type:"number"},{id:"openHours",label:"Openstaand",type:"number",formula:"MAX([requiredHours] - [plannedHours]; 0)"},{id:"overHours",label:"Meer dan behoefte",type:"number",formula:"MAX([plannedHours] - [requiredHours]; 0)"}],rows:[],derive:{groupBy:["year","week","administration","project","functionId"],left:{source:"needs",measure:{field:"amount",aggregation:"sum"},output:"requiredHours"},right:{source:"planned",measure:{field:"amount",aggregation:"sum"},output:"plannedHours"}}};
  const functionTable:Dataset={id:"functions",name:"Functies",origin:"demo",columns:[{id:"functionId",label:"Functiecode",type:"text"},{id:"functionName",label:"Functie",type:"text"}],rows:functions.map((name,i)=>({id:`function-${i}`,values:{functionId:`F${i+1}`,functionName:name}}))};
  const relations:Relation[]=[{id:"planned-employee",from:"planned",to:"employees",pairs:[{from:"employeeId",to:"employeeId"}]},{id:"coverage-function",from:"coverage",to:"functions",pairs:[{from:"functionId",to:"functionId"}]},{id:"pure-employee",from:"pure",to:"employees",pairs:[{from:"employeeId",to:"employeeId"}]},{id:"planned-function",from:"planned",to:"functions",pairs:[{from:"functionId",to:"functionId"}]},{id:"pure-function",from:"pure",to:"functions",pairs:[{from:"functionId",to:"functionId"}]}];
  const visuals:Visual[]=[{id:"planning-week",title:"Behoefte versus ingepland per week",source:"coverage",dimension:"week",measure:{field:"requiredHours",aggregation:"sum"},compare:{source:"coverage",measure:{field:"plannedHours",aggregation:"sum"}},kind:"bar",top:20,page:"planning"},{id:"planning-open",title:"Openstaande uren per functie",source:"coverage",dimension:"functions.functionName",measure:{field:"openHours",aggregation:"sum"},kind:"bar",top:12,page:"planning"},{id:"planning-people",title:"Ingeplande uren per medewerker",source:"planned",dimension:"employees.employeeName",measure:{field:"amount",aggregation:"sum"},kind:"table",top:20,page:"planning"},{id:"planning-project",title:"Planning per project",source:"coverage",dimension:"project",measure:{field:"requiredHours",aggregation:"sum"},compare:{source:"coverage",measure:{field:"plannedHours",aggregation:"sum"}},kind:"table",top:20,page:"planning"}];
  return {datasets:[employees,functionTable,pure,needs,planned,coverage],relations,visuals};
}

export function orderedFormulas(columns:Column[], available:Column[]=columns):Column[] {
  const formulas=columns.filter(c=>c.formula),known=new Set(available.map(c=>c.id)),done=new Set<string>(),visiting=new Set<string>(),ordered:Column[]=[];
  const visit=(column:Column)=>{
    if(done.has(column.id))return;if(visiting.has(column.id))throw new Error("Er zit een kringverwijzing in de formules.");visiting.add(column.id);
    const compiled=compileFormula(column.formula!);
    for(const field of compiled.fields){if(!known.has(field))throw new Error(`Veld [${field}] bestaat niet in deze bron.`);const dependency=formulas.find(c=>c.id===field);if(dependency)visit(dependency);}
    visiting.delete(column.id);done.add(column.id);ordered.push(column);
  };
  formulas.forEach(visit);return ordered;
}
export function relationDiagnostics(workspace:Workspace,relation:Relation) {
  const left=workspace.datasets.find(d=>d.id===relation.from),right=workspace.datasets.find(d=>d.id===relation.to);
  if(!left||!right||left===right||!relation.pairs.length||relation.pairs.length>3)throw new Error("Kies twee verschillende bronnen en 1 t/m 3 sleutelparen.");
  for(const pair of relation.pairs)if(!left.columns.some(c=>c.id===pair.from&&!c.formula)||!right.columns.some(c=>c.id===pair.to&&!c.formula))throw new Error("Relaties gebruiken bestaande, niet-berekende sleutelvelden.");
  const keys=new Set<string>();let duplicates=0;
  if(right.origin==="derived")throw new Error("De opzoekkant van een relatie moet een gewone tabel met unieke sleutels zijn.");
  for(const row of right.rows){const key=relationKey(row.values,relation.pairs.map(p=>p.to));if(key===null)continue;if(keys.has(key))duplicates++;keys.add(key);}
  const leftRows=left.view?workspace.datasets.find(d=>d.id===left.view!.source)!.rows.filter(r=>r.values[left.view!.field]===left.view!.value):left.rows;
  const unmatched=leftRows.filter(row=>!keys.has(relationKey(row.values,relation.pairs.map(p=>p.from))??"__missing")).length;
  return {duplicates,unmatched,total:left.rows.length};
}
function relationKey(row:Record<string,Cell>,fields:string[]) {const values=fields.map(f=>row[f]);return values.some(v=>v===null||v===undefined||v==="")?null:JSON.stringify(values);}
export function modelColumns(workspace:Workspace,id:string):Column[] {
  const source=workspace.datasets.find(d=>d.id===id);if(!source)throw new Error("Gegevensbron bestaat niet.");
  return [...source.columns,...workspace.relations.filter(r=>r.from===id).flatMap(r=>{const target=workspace.datasets.find(d=>d.id===r.to)!;return target.columns.map(c=>({...c,id:`${target.id}.${c.id}`,label:`${target.name} · ${c.label}`,formula:undefined}));})];
}
export function modelRows(workspace:Workspace,id:string):RecordRow[] { return buildRows(workspace,id,new Map(),new Set()); }
function buildRows(workspace:Workspace,id:string,cache:Map<string,RecordRow[]>,visiting:Set<string>):RecordRow[] {
  if(cache.has(id))return cache.get(id)!;if(visiting.has(id))throw new Error("Er zit een kringverwijzing in het datamodel.");visiting.add(id);
  const source=workspace.datasets.find(d=>d.id===id);if(!source)throw new Error("Gegevensbron bestaat niet.");
  let inputRows=source.rows;
  if(source.view)inputRows=buildRows(workspace,source.view.source,cache,visiting).filter(r=>r.values[source.view!.field]===source.view!.value).map(r=>({id:r.id,values:Object.fromEntries(source.columns.filter(c=>!c.formula).map(c=>[c.id,r.values[c.id]??null]))}));
  if(source.derive){
    const derive=source.derive,collect=(id:string)=>{const map=new Map<string,RecordRow[]>();for(const row of buildRows(workspace,id,cache,visiting)){const key=JSON.stringify(derive.groupBy.map(f=>row.values[f]??null)),items=map.get(key);if(items)items.push(row);else map.set(key,[row]);}return map;};
    const a=collect(derive.left.source),b=collect(derive.right.source);
    inputRows=[...new Set([...a.keys(),...b.keys()])].map((key,i)=>({id:`derived-${i}`,values:{...Object.fromEntries(derive.groupBy.map((f,j)=>[f,JSON.parse(key)[j] as Cell])),[derive.left.output]:a.has(key)?aggregate(a.get(key)!,derive.left.measure):0,[derive.right.output]:b.has(key)?aggregate(b.get(key)!,derive.right.measure):0}}));
  }
  const columns=modelColumns(workspace,id),formulas=orderedFormulas(source.columns,columns).map(c=>({id:c.id,compiled:compileFormula(c.formula!)}));
  const lookups=workspace.relations.filter(r=>r.from===id).map(relation=>{
    const diagnostics=relationDiagnostics(workspace,relation);if(diagnostics.duplicates)throw new Error("Koppeling geblokkeerd: dubbele sleutels aan de opzoekkant zouden regels en bedragen verdubbelen.");
    const target=workspace.datasets.find(d=>d.id===relation.to)!;
    const map=new Map<string,Record<string,Cell>>();
    for(const record of buildRows(workspace,target.id,cache,visiting)){const key=relationKey(record.values,relation.pairs.map(p=>p.to));if(key!==null)map.set(key,record.values);}
    return {relation,target,map};
  });
  if(inputRows.length>5000)throw new Error("De afgeleide tabel bevat meer dan 5.000 regels. Gebruik minder groepen of splits de bron.");
  const result=inputRows.map(record=>{const values={...record.values};for(const {relation,target,map} of lookups){const match=map.get(relationKey(values,relation.pairs.map(p=>p.from))??"__missing");for(const column of target.columns)values[`${target.id}.${column.id}`]=match?.[column.id]??null;}for(const f of formulas){const value=f.compiled.evaluate(values),column=source.columns.find(c=>c.id===f.id)!;if(value!==null&&typeof value!==(column.type==="text"?"string":column.type))throw new Error(`Formule ${column.label} geeft een ander type dan de kolom. Gebruik hier een ${column.type==="number"?"getal":column.type==="text"?"tekst":"booleaanse waarde"}.`);values[f.id]=value;}return {id:record.id,values};});
  visiting.delete(id);cache.set(id,result);return result;
}
export function filterRows(rows:RecordRow[],columns:Column[],filters:Filters,strict=true):RecordRow[] {
  const has=(id:string)=>columns.some(c=>c.id===id);
  if(strict&&filters.selection&&!has(filters.selection.field))throw new Error("Deze bron bevat het geselecteerde filterveld niet. Wis de grafiekselectie om deze vergelijking te bekijken.");
  if(strict&&filters.selection?.year!==undefined&&!has("year"))throw new Error("Deze bron mist het jaar van de grafiekselectie. Wis de selectie om verder te gaan.");
  return rows.filter(r=>(filters.year==="all"||!has("year")||String(r.values.year)===filters.year)&&(filters.administration==="all"||!has("administration")||r.values.administration===filters.administration)&&(!has("month")||Number(r.values.month)>=(filters.fromMonth??1)&&Number(r.values.month)<=(filters.toMonth??12))&&(!filters.selection||!has(filters.selection.field)||r.values[filters.selection.field]===filters.selection.value&&(filters.selection.year===undefined||r.values.year===filters.selection.year)));
}
export function aggregate(rows:RecordRow[],measure:Measure,previous:RecordRow[]=[]):number|null {
  if(measure.positiveOnly)rows=rows.filter(r=>typeof r.values[measure.positiveOnly!]==="number"&&Number(r.values[measure.positiveOnly!])>0);
  if(measure.aggregation==="growth"){
    const before=aggregate(previous,{field:measure.field,aggregation:"sum"}),now=aggregate(rows,{field:measure.field,aggregation:"sum"});
    return before&&now!==null?(now-before)/before*100:null;
  }
  if(measure.aggregation==="formula"){
    const formula=compileFormula(measure.expression??""),totals:Record<string,Cell>={};
    for(const field of formula.fields)totals[field]=aggregate(rows,{field,aggregation:"sum"});
    const value=formula.evaluate(totals);return typeof value==="number"&&Number.isFinite(value)?value:null;
  }
  if(measure.aggregation==="count")return rows.length;
  if(measure.aggregation==="distinct")return new Set(rows.map(r=>r.values[measure.field]).filter(v=>v!==null&&v!==undefined)).size;
  const values=rows.map(r=>r.values[measure.field]).filter((v):v is number=>typeof v==="number"&&Number.isFinite(v));
  if(!values.length)return null;
  if(measure.aggregation==="min")return Math.min(...values);if(measure.aggregation==="max")return Math.max(...values);
  const sum=values.reduce((a,b)=>a+b,0);return Number.isFinite(sum)?measure.aggregation==="average"?sum/values.length:sum:null;
}
export type Point={key:string;label:string;raw:Cell;value:number|null;comparison:number|null;delta:number|null;percent:number|null};
export function visualData(workspace:Workspace,visual:Visual,filters:Filters):{points:Point[];primary:Column;secondary?:Column;total:number|null;comparison:number|null} {
  const leftColumns=modelColumns(workspace,visual.source),primaryColumn=leftColumns.find(c=>c.id===visual.measure.field),primary=primaryColumn?{...primaryColumn,format:visual.measure.format??(["count","distinct"].includes(visual.measure.aggregation)?"number":primaryColumn.format)}:undefined;
  if(!primary||!leftColumns.some(c=>c.id===visual.dimension))throw new Error("Kies een bestaand groeperingsveld en waardekolom.");
  const needsYear=visual.measure.aggregation==="growth"||visual.compare?.measure.aggregation==="growth"||visual.compare?.period==="previousYear";
  if(needsYear&&(filters.year==="all"||!leftColumns.some(c=>c.id==="year")))throw new Error("Kies één jaar voor groei of vergelijking met vorig jaar.");
  const priorFilters=(f:Filters,offset=1):Filters=>({...f,year:String(Number(f.year)-offset),selection:f.selection?.year!==undefined?{...f.selection,year:f.selection.year-offset}:f.selection});
  const allLeft=modelRows(workspace,visual.source),left=filterRows(allLeft,leftColumns,filters),previousLeft=needsYear?filterRows(allLeft,leftColumns,priorFilters(filters)):[],rightColumns=visual.compare?modelColumns(workspace,visual.compare.source):[];
  const rightDimension=visual.compare?.dimension??visual.dimension;
  const secondaryColumn=visual.compare?rightColumns.find(c=>c.id===visual.compare!.measure.field):undefined,secondary=secondaryColumn?{...secondaryColumn,format:visual.compare?.measure.format??(["count","distinct"].includes(visual.compare!.measure.aggregation)?"number":secondaryColumn.format)}:undefined;
  if(visual.compare&&(!secondary||!rightColumns.some(c=>c.id===rightDimension)))throw new Error("De vergelijkingsbron mist de gekozen groepering of waardekolom. Koppel een passend groeperingsveld voor reeks B.");
  if(visual.compare&&leftColumns.find(c=>c.id===visual.dimension)!.type!==rightColumns.find(c=>c.id===rightDimension)!.type)throw new Error("De groeperingsvelden hebben verschillende datatypen en kunnen niet veilig worden vergeleken.");
  for(const filter of [{field:"year",active:filters.year!=="all"},{field:"administration",active:filters.administration!=="all"}])if(visual.compare&&filter.active&&leftColumns.some(c=>c.id===filter.field)!==rightColumns.some(c=>c.id===filter.field))throw new Error("Beide bronnen moeten het actieve periode-/administratiefilter ondersteunen. Zet dat filter op ‘Alles’ of kies een andere bron.");
  const rightFilters=filters.selection?.field===visual.dimension?{...filters,selection:{...filters.selection,field:rightDimension}}:filters;
  const compareFilters=visual.compare?.period==="previousYear"?priorFilters(rightFilters):rightFilters;
  const allRight=visual.compare?modelRows(workspace,visual.compare.source):[];
  const right=visual.compare?filterRows(allRight,rightColumns,compareFilters):[];
  const previousRight=visual.compare?.measure.aggregation==="growth"?filterRows(allRight,rightColumns,priorFilters(compareFilters)):[];
  const groups=(records:RecordRow[],dimension:string)=>{const map=new Map<string,{raw:Cell;rows:RecordRow[]}>();for(const row of records){const raw=row.values[dimension]??null;const period=visual.dimension==="month"&&row.values.year!==undefined?`${row.values.year}-${String(raw).padStart(2,"0")}`:String(raw??"(leeg)");const entry=map.get(period)??{raw,rows:[]};entry.rows.push(row);map.set(period,entry);}return map;};
  // Aggregate each fact source first. Never join raw fact rows for comparisons.
  const shift=(records:RecordRow[],offset=1)=>records.map(r=>({...r,values:{...r.values,year:Number(r.values.year)+offset}}));
  const a=groups(left,visual.dimension),b=groups(visual.compare?.period==="previousYear"?shift(right):right,rightDimension),pa=groups(shift(previousLeft),visual.dimension),pb=groups(shift(previousRight,visual.compare?.period==="previousYear"?2:1),rightDimension),keys=[...new Set([...a.keys(),...b.keys()])];
  let points=keys.map(key=>{const l=a.get(key),r=b.get(key),value=l?aggregate(l.rows,visual.measure,pa.get(key)?.rows):null,comparison=r&&visual.compare?aggregate(r.rows,visual.compare.measure,pb.get(key)?.rows):null,delta=value!==null&&comparison!==null?value-comparison:null;return {key,label:key,raw:l?.raw??r?.raw??null,value,comparison,delta,percent:delta!==null&&comparison!==null&&comparison!==0?delta/Math.abs(comparison)*100:null};});
  points=["month","year","week","date"].includes(visual.dimension)?points.sort((x,y)=>x.key.localeCompare(y.key,undefined,{numeric:true})):points.sort((x,y)=>(y.value??-Infinity)-(x.value??-Infinity));
  if(primary&&visual.measure.aggregation==="formula")primary.label=visual.title;
  if(primary&&visual.measure.aggregation==="growth"){primary.label="Groei t.o.v. vorig jaar";primary.format="percent";}
  if(secondary&&visual.compare?.measure.aggregation==="formula")secondary.label=visual.title;
  if(secondary&&visual.compare?.measure.aggregation==="growth"){secondary.label="Groei t.o.v. vorig jaar";secondary.format="percent";}
  if(secondary&&visual.compare?.period==="previousYear")secondary.label=`${secondary.label} · vorig jaar`;
  return {points:points.slice(0,visual.top),primary:primary as Column,secondary:secondary as Column|undefined,total:aggregate(left,visual.measure,previousLeft),comparison:visual.compare?aggregate(right,visual.compare.measure,previousRight):null};
}
export function formatValue(value:Cell|undefined,column?:Pick<Column,"format">):string {
  if(value===null||value===undefined)return "—";if(typeof value==="boolean")return value?"Ja":"Nee";if(typeof value!=="number")return value;
  if(column?.format==="currency")return new Intl.NumberFormat("nl-NL",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(value);
  return new Intl.NumberFormat("nl-NL",{maximumFractionDigits:2}).format(value)+(column?.format==="percent"?" %":"");
}
export function editCell(workspace:Workspace,datasetId:string,rowId:string,columnId:string,input:string):Workspace {
  const dataset=workspace.datasets.find(d=>d.id===datasetId),column=dataset?.columns.find(c=>c.id===columnId),record=dataset?.rows.find(r=>r.id===rowId);
  if(!dataset||!column||!record||column.formula||dataset.origin==="derived")throw new Error("Dit veld is berekend of afgeleid. Bewerk de oorspronkelijke brontabel.");
  let value:Cell=input;
  if(!input.trim())value=null;
  else if(column.type==="number"){if(!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(input.trim()))throw new Error("Vul een geldig getal in, zonder duizendtalscheiding.");value=Number(input.replace(",","."));if(!Number.isFinite(value))throw new Error("Ongeldig getal.");}
  else if(column.type==="boolean"){if(!["true","false","ja","nee","1","0"].includes(input.toLowerCase()))throw new Error("Gebruik Ja/Nee of true/false.");value=["true","ja","1"].includes(input.toLowerCase());}
  if(record.values[columnId]===value)return workspace;
  const next=structuredClone(workspace),target=next.datasets.find(d=>d.id===datasetId)!.rows.find(r=>r.id===rowId)!;
  next.edits=[...next.edits,{id:crypto.randomUUID(),dataset:datasetId,row:rowId,column:columnId,before:record.values[columnId]??null,after:value,at:new Date().toISOString()}].slice(-500);
  target.values[columnId]=value;
  for(const relation of next.relations){if(relationDiagnostics(next,relation).duplicates)throw new Error("Deze wijziging zou dubbele relatiesleutels maken. Wijzig eerst het datamodel.");}
  return next;
}
export function validateWorkspace(value:unknown):Workspace {
  if(!value||typeof value!=="object")throw new Error("Ongeldige werkplek.");const w=value as Workspace;
  if(w.version!==1||typeof w.name!=="string"||!w.name.trim()||w.name.length>100||!Array.isArray(w.datasets)||!w.datasets.length||w.datasets.length>16||!Array.isArray(w.relations)||w.relations.length>20||!Array.isArray(w.visuals)||w.visuals.length>240||!Array.isArray(w.edits)||w.edits.length>500)throw new Error("Ongeldige werkplekstructuur.");
  if(JSON.stringify(w).length>2_000_000)throw new Error("Deze lokale werkplek is te groot om veilig te bewaren (maximaal 2 miljoen tekens). Splits grote bronnen over meerdere JSON-back-ups.");
  const ids=new Set<string>();for(const d of w.datasets){if(typeof d.id!=="string"||!d.id||ids.has(d.id)||typeof d.name!=="string"||d.name.length>100||!["demo","import","derived"].includes(d.origin)||!Array.isArray(d.columns)||!d.columns.length||d.columns.length>80||!Array.isArray(d.rows)||d.rows.length>5000)throw new Error("Ongeldige gegevensbron (maximaal 5.000 regels en 80 kolommen).");ids.add(d.id);const cols=new Set<string>();for(const c of d.columns){if(!c||typeof c.id!=="string"||!c.id||cols.has(c.id)||typeof c.label!=="string"||!["number","text","boolean"].includes(c.type)||c.formula!==undefined&&typeof c.formula!=="string")throw new Error("Ongeldige kolom.");cols.add(c.id);}const rowIds=new Set<string>();for(const r of d.rows){if(!r||typeof r.id!=="string"||rowIds.has(r.id)||!r.values||typeof r.values!=="object")throw new Error("Ongeldige regel.");rowIds.add(r.id);for(const [key,v] of Object.entries(r.values)){if(!cols.has(key)||!(v===null||typeof v==="string"&&v.length<=10000||typeof v==="boolean"||typeof v==="number"&&Number.isFinite(v)))throw new Error("Ongeldige celwaarde.");}}}
  if(w.savedAt!==null&&(typeof w.savedAt!=="string"||!Number.isFinite(Date.parse(w.savedAt))))throw new Error("Ongeldig opslagmoment.");
  const editIds=new Set<string>();for(const edit of w.edits){if(!edit||typeof edit.id!=="string"||editIds.has(edit.id)||typeof edit.dataset!=="string"||typeof edit.row!=="string"||typeof edit.column!=="string"||typeof edit.at!=="string"||!Number.isFinite(Date.parse(edit.at))||!validCell(edit.before)||!validCell(edit.after))throw new Error("Ongeldige wijzigingshistorie.");editIds.add(edit.id);}
  for(const d of w.datasets){for(const c of d.columns)if(["__proto__","constructor","prototype"].includes(c.id)||c.label.length>100||c.format!==undefined&&!["currency","percent","number"].includes(c.format))throw new Error("Ongeldige kolomnaam of getalopmaak.");if(d.origin==="derived"&&Boolean(d.view)===Boolean(d.derive)||d.origin!=="derived"&&(d.view||d.derive))throw new Error("Een afgeleide bron vereist precies één afleidingsregel.");for(const row of d.rows)for(const column of d.columns){const cell=row.values[column.id];if(cell!==null&&cell!==undefined&&!column.formula&&typeof cell!==(column.type==="text"?"string":column.type))throw new Error(`Celtype past niet bij kolom ${column.label}.`);}}
  const relationIds=new Set<string>();for(const r of w.relations){if(!r||typeof r.id!=="string"||relationIds.has(r.id)||!Array.isArray(r.pairs)||relationDiagnostics(w,r).duplicates)throw new Error("Ongeldige of dubbelzinnige relatie.");relationIds.add(r.id);}
  for(const d of w.datasets){if(d.view&&(!w.datasets.some(s=>s.id===d.view!.source)||!w.datasets.find(s=>s.id===d.view!.source)!.columns.some(c=>c.id===d.view!.field)))throw new Error("Ongeldige afgeleide selectie.");if(d.derive){const derive=d.derive;for(const side of [derive.left,derive.right]){const columns=modelColumns(w,side.source);if(!validMeasure(side.measure,columns)||!d.columns.some(c=>c.id===side.output)||!derive.groupBy.length||derive.groupBy.some(f=>!columns.some(c=>c.id===f)))throw new Error("Ongeldige afgeleide vergelijking.");}}orderedFormulas(d.columns,modelColumns(w,d.id));modelRows(w,d.id);}
  const visualIds=new Set<string>();for(const v of w.visuals){const fields=modelColumns(w,v.source);if(typeof v.id!=="string"||visualIds.has(v.id)||typeof v.title!=="string"||!v.title.trim()||v.title.length>100||v.page!==undefined&&(typeof v.page!=="string"||!v.page||v.page.length>100)||v.width!==undefined&&!["half","full"].includes(v.width)||!["kpi","bar","line","area","table","scatter"].includes(v.kind)||!fields.some(c=>c.id===v.dimension)||!validMeasure(v.measure,fields)||!Number.isInteger(v.top)||v.top<1||v.top>50||v.compare&&(!validMeasure(v.compare.measure,modelColumns(w,v.compare.source))||v.compare.period!==undefined&&v.compare.period!=="previousYear"||v.compare.dimension!==undefined&&!modelColumns(w,v.compare.source).some(c=>c.id===v.compare!.dimension)))throw new Error("Ongeldige grafiekinstelling.");visualIds.add(v.id);}
  return w;
}
function validCell(value:unknown) {return value===null||typeof value==="string"&&value.length<=10000||typeof value==="boolean"||typeof value==="number"&&Number.isFinite(value);}
function validMeasure(m:Measure,columns:Column[]) {if(!m||!["sum","average","count","distinct","min","max","formula","growth"].includes(m.aggregation)||m.format!==undefined&&!["number","percent","currency"].includes(m.format)||m.positiveOnly!==undefined&&!columns.some(c=>c.id===m.positiveOnly&&c.type==="number")||m.aggregation==="growth"&&!columns.some(c=>c.id==="year"&&c.type==="number")||!columns.some(c=>c.id===m.field&&(c.type==="number"||["count","distinct"].includes(m.aggregation))))return false;return m.aggregation!=="formula"||typeof m.expression==="string"&&compileFormula(m.expression).fields.every(field=>columns.some(c=>c.id===field&&c.type==="number"));}
