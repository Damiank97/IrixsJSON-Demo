import { BI_STORAGE, demoWorkspace, validateWorkspace, type Filters, type Measure, type Visual, type Workspace } from "./model";
import { METRICS, STUDIO_STORAGE, SOURCE_STORAGE, validateDashboard, type Dashboard, type MetricId, type Widget } from "@/lib/studio/model";
import { demoDashboards } from "@/lib/studio/planner";

export const UNIFIED_STORAGE="irixs-studio-v2";
export const CUSTOMER_STORAGE="irixs-studio-customer-v2";
export type Board={id:string;title:string;description:string;owner:string;shared:boolean;updatedAt:string|null;filters:Filters};
export type StudioWorkspace=Workspace&{studioVersion:2;dashboards:Board[];disabledSources:string[]};
const defaultFilters=():Filters=>({year:"2026",administration:"all",fromMonth:1,toMonth:12});

export function measureForMetric(metric:MetricId):Measure {
  const format=METRICS[metric].format;
  if(metric==="margin")return {field:"profit",aggregation:"formula",expression:"[profit]/[revenue]*100",format};
  if(metric==="utilization")return {field:"billableHours",aggregation:"formula",expression:"[billableHours]/[hours]*100",format};
  if(metric==="customers")return {field:"customer",aggregation:"distinct",positiveOnly:"revenue",format};
  if(metric==="growth")return {field:"revenue",aggregation:"growth",format};
  return {field:metric,aggregation:"sum",format};
}
export function fromDashboard(input:Dashboard):{board:Board;visuals:Visual[]} {
  const d=validateDashboard(input),source=d.dataset==="revenue"?"finance":"hours";
  return {board:{id:d.id,title:d.title,description:d.description,owner:d.owner,shared:d.shared,updatedAt:d.updatedAt,filters:{...d.filters,year:String(d.filters.year)}},visuals:d.widgets.map(w=>({id:`${d.id}::${w.id}`,title:w.title,source,dimension:w.dimension,measure:measureForMetric(w.metric),kind:w.kind,top:w.top,width:w.width,page:d.id,...(w.compare?{compare:{source,measure:measureForMetric(w.metric),period:"previousYear" as const}}:{})}))};
}
// Only offer follow-up AI when the entire current dashboard fits its documented
// contract. Never send an outdated copy or silently discard custom components.
export function toDashboard(workspace:StudioWorkspace,board:Board):Dashboard|null {
  const visuals=workspace.visuals.filter(v=>v.page===board.id);
  if(!visuals.length)return null;
  const source=visuals[0].source;if(!["finance","hours"].includes(source))return null;
  const dataset=source==="finance"?"revenue":"hours";
  const widgets:Widget[]=[];
  for(const v of visuals){
    const metric=(Object.keys(METRICS) as MetricId[]).find(id=>METRICS[id].dataset===dataset&&sameMeasure(measureForMetric(id),v.measure));
    if(v.source!==source||!metric||!["kpi","line","bar","table"].includes(v.kind)||!["month","customer","project","administration"].includes(v.dimension)||v.top>12||v.compare&&(v.compare.source!==source||v.compare.period!=="previousYear"||!sameMeasure(v.compare.measure,v.measure)||v.compare.dimension&&v.compare.dimension!==v.dimension))return null;
    widgets.push({id:v.id,title:v.title,kind:v.kind as Widget["kind"],metric,dimension:v.dimension as Widget["dimension"],compare:!!v.compare,width:v.width??"half",top:v.top});
  }
  try{return validateDashboard({...board,dataset,widgets,filters:{...board.filters,year:Number(board.filters.year),fromMonth:board.filters.fromMonth??1,toMonth:board.filters.toMonth??12}});}catch{return null;}
}
function sameMeasure(a:Measure,b:Measure){return a.field===b.field&&a.aggregation===b.aggregation&&(a.expression??"").replace(/\s/g,"")===(b.expression??"").replace(/\s/g,"")&&a.positiveOnly===b.positiveOnly&&(b.format===undefined||a.format===b.format);}
export function addDashboard(workspace:StudioWorkspace,d:Dashboard):StudioWorkspace {
  const converted=fromDashboard(d);
  // Preserve stable visual ids on follow-up, avoiding nested migration prefixes.
  converted.visuals=converted.visuals.map((v,i)=>({...v,id:workspace.visuals.some(old=>old.id===d.widgets[i].id&&old.page===d.id)?d.widgets[i].id:v.id}));
  return validateStudio({...workspace,dashboards:workspace.dashboards.some(b=>b.id===d.id)?workspace.dashboards.map(b=>b.id===d.id?converted.board:b):[converted.board,...workspace.dashboards],visuals:[...workspace.visuals.filter(v=>v.page!==d.id),...converted.visuals]});
}
export function newBoard():Board{return {id:crypto.randomUUID(),title:"Nieuw dashboard",description:"Je eigen KPI’s, grafieken en vergelijkingen.",owner:"eigenaar",shared:false,updatedAt:null,filters:defaultFilters()};}

function withBoards(workspace:Workspace):StudioWorkspace {
  const pages=[...new Set(workspace.visuals.map(v=>v.page??"custom"))];
  const known:Record<string,{title:string;description:string}>={planning:{title:"PURE planning & behoefte",description:"Benodigd, ingepland en openstaand per week, functie en project."},finance:{title:"Resultaat & budget",description:"Omzet, budget en projecturen uit dezelfde gedeelde databronnen."},custom:{title:"Eigen analyse",description:"Je eerder opgebouwde grafieken uit de werkplek."}};
  if(!pages.includes("planning")&&workspace.datasets.some(d=>d.id==="coverage"))pages.unshift("planning");
  const dashboards=pages.map(id=>({id,...(known[id]??{title:id,description:"Bestaand dashboard"}),owner:"eigenaar",shared:true,updatedAt:workspace.savedAt,filters:defaultFilters()}));
  const visuals:Visual[]=workspace.visuals.map(v=>({...v,page:v.page??"custom",width:v.width??(v.kind!=="kpi"&&workspace.visuals.find(other=>other.page===v.page)?.id===v.id?"full":undefined)}));
  // Turn the previously hard-coded headline figures into ordinary editable KPIs.
  const presets:{page:string;source:string;title:string;field:string;expression?:string;format?:Measure["format"]}[]=[
    {page:"planning",source:"coverage",title:"Benodigde uren",field:"requiredHours"},{page:"planning",source:"coverage",title:"Ingeplande uren",field:"plannedHours"},{page:"planning",source:"coverage",title:"Openstaande uren",field:"openHours"},{page:"planning",source:"coverage",title:"Meer dan behoefte",field:"overHours"},
    {page:"finance",source:"finance",title:"Omzet",field:"revenue",format:"currency"},{page:"finance",source:"finance",title:"Brutowinst",field:"profit",format:"currency"},{page:"finance",source:"finance",title:"Gewogen marge",field:"profit",expression:"[profit]/[revenue]*100",format:"percent"},
  ];
  for(const p of [...presets].reverse())if(pages.includes(p.page)&&workspace.datasets.some(d=>d.id===p.source)&&visuals.filter(v=>v.page===p.page).length<24)visuals.unshift({id:`summary-${p.page}-${p.field}-${p.expression?"ratio":"total"}`,page:p.page,title:p.title,source:p.source,dimension:p.page==="planning"?"week":"month",measure:{field:p.field,aggregation:p.expression?"formula":"sum",...(p.expression?{expression:p.expression}:{}),format:p.format},kind:"kpi",top:12});
  return {...workspace,visuals,studioVersion:2,dashboards,disabledSources:[]};
}
export function defaultStudio():StudioWorkspace {
  let workspace=withBoards(demoWorkspace());
  for(const d of demoDashboards())workspace=addDashboard(workspace,d);
  return validateStudio(workspace);
}
type StorageReader=Pick<Storage,"getItem">;
export function loadStudio(storage:StorageReader,internal:boolean):{workspace:StudioWorkspace;notice:string;migrated:boolean} {
  const key=internal?UNIFIED_STORAGE:CUSTOMER_STORAGE,current=storage.getItem(key);
  if(current){try{return {workspace:validateStudio(JSON.parse(current)),notice:"",migrated:false};}catch{return {workspace:defaultStudio(),notice:"De bewaarde Studio is niet leesbaar. Een demo is geladen; de oude opslag blijft onaangeraakt. Download eerst een back-up voordat je opslaat.",migrated:false};}}
  if(!internal)return {workspace:defaultStudio(),notice:"Klantdemo met afzonderlijke lokale opslag en fictieve gegevens.",migrated:false};
  let workspace:StudioWorkspace,notice="",migrated=false;
  const previous=storage.getItem(BI_STORAGE),legacy=storage.getItem(STUDIO_STORAGE);
  try{workspace=previous?withBoards(validateWorkspace(JSON.parse(previous))):withBoards(demoWorkspace());migrated=!!previous;}catch{workspace=withBoards(demoWorkspace());notice="De oude datawerkplek kon niet worden gelezen en is niet overschreven.";}
  // Append only missing demo history; retain all existing edits, formulas and ids.
  const fresh=demoWorkspace();
  for(const id of ["finance","hours","budgets"]){const target=workspace.datasets.find(d=>d.id===id&&d.origin==="demo"),history=fresh.datasets.find(d=>d.id===id)!;if(target&&!target.rows.some(r=>r.values.year===2024))target.rows.push(...history.rows.filter(r=>r.values.year===2024).map(r=>({...r,id:`history-${r.id}`})));}
  let old:unknown[]=demoDashboards();
  if(legacy){try{const parsed=JSON.parse(legacy);if(!Array.isArray(parsed))throw new Error();old=parsed;migrated=true;}catch{notice+=" De oude dashboardlijst is niet leesbaar en blijft bewaard.";}}
  for(const value of old){try{workspace=addDashboard(workspace,validateDashboard(value));}catch{notice+=" Een oud dashboard kon niet worden overgenomen; het origineel blijft in de oude opslag.";}}
  try{const config=JSON.parse(storage.getItem(SOURCE_STORAGE)??"{}");workspace.disabledSources=[config.revenue?.enabled===false?"finance":null,config.hours?.enabled===false?"hours":null].filter((s):s is string=>!!s);}catch{/* keep default sources */}
  return {workspace:validateStudio(workspace),notice:notice|| (migrated?"Je dashboards, tabellen, formules en relaties zijn samengebracht. Sla op om de nieuwe Studio te bewaren; de oorspronkelijke opslag blijft behouden.":""),migrated};
}
export function validateStudio(value:unknown):StudioWorkspace {
  const workspace=validateWorkspace(value) as StudioWorkspace;
  if(workspace.studioVersion!==2||!Array.isArray(workspace.dashboards)||!workspace.dashboards.length||workspace.dashboards.length>20||!Array.isArray(workspace.disabledSources)||workspace.disabledSources.some(id=>!workspace.datasets.some(d=>d.id===id)))throw new Error("Ongeldig Studio-overzicht.");
  const ids=new Set<string>();
  for(const b of workspace.dashboards){const f=b.filters;if(!b||typeof b.id!=="string"||!b.id||b.id.length>100||ids.has(b.id)||typeof b.title!=="string"||!b.title.trim()||b.title.length>100||typeof b.description!=="string"||b.description.length>500||typeof b.owner!=="string"||typeof b.shared!=="boolean"||b.updatedAt!==null&&!Number.isFinite(Date.parse(b.updatedAt))||!f||typeof f.year!=="string"||f.year!=="all"&&!/^\d{4}$/.test(f.year)||typeof f.administration!=="string"||!Number.isInteger(f.fromMonth??1)||!Number.isInteger(f.toMonth??12)||(f.fromMonth??1)<1||(f.toMonth??12)>12||(f.fromMonth??1)>(f.toMonth??12)||workspace.visuals.filter(v=>v.page===b.id).length>24)throw new Error("Ongeldig dashboard of dashboardfilter.");ids.add(b.id);}
  if(workspace.visuals.some(v=>!v.page||!ids.has(v.page)))throw new Error("Een grafiek moet bij een bestaand dashboard horen.");
  return workspace;
}
export function importStudio(value:unknown):StudioWorkspace {
  if(value&&typeof value==="object"&&"studioVersion" in value)return validateStudio(value);
  return validateStudio(withBoards(validateWorkspace(value)));
}
