import { readTable } from "@/lib/pureMigration";
import { type Cell, type Column, type Dataset, type RecordRow } from "./model";

export async function importDataset(file:File):Promise<Dataset> {
  if(file.size>10*1024*1024)throw new Error("Gebruik een bestand van maximaal 10 MB.");
  const table=await readTable(file);
  return datasetFromTable(table.fileName,table.headers,table.rows);
}
export function datasetFromTable(name:string,headers:string[],records:Record<string,unknown>[]):Dataset {
  if(!headers.length||headers.length>80||!records.length||records.length>5000)throw new Error("Importeer 1 t/m 5.000 regels en maximaal 80 kolommen. Het eerste werkblad wordt gebruikt.");
  const used=new Set<string>();
  const columns:Column[]=headers.map((label,index)=>{
    let id=label.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9_]/g,"_").replace(/_+/g,"_").replace(/^_|_$/g,"").slice(0,60)||`kolom_${index+1}`;
    id=({jaar:"year",maand:"month",administratie:"administration"} as Record<string,string>)[id]??id;
    if(["__proto__","constructor","prototype"].includes(id)||/^\d/.test(id))id=`kolom_${id}`;
    const base=id;let suffix=2;while(used.has(id))id=`${base}_${suffix++}`;used.add(id);
    const values=records.map(row=>row[label]).filter(v=>v!==null&&v!==undefined&&v!=="");
    const type=values.length&&values.every(v=>typeof v==="boolean")?"boolean":values.length&&values.every(isNumeric)?"number":"text";
    return {id,label:label.slice(0,100),type};
  });
  const rows:RecordRow[]=records.map((record,index)=>({id:`import-row-${index}`,values:Object.fromEntries(columns.map((column,i)=>{
    const value=record[headers[i]];
    if(value===null||value===undefined||value==="")return [column.id,null];
    if(column.type==="number")return [column.id,typeof value==="number"?value:Number(String(value).replace(",","."))];
    if(column.type==="boolean")return [column.id,Boolean(value)];
    const text=value instanceof Date?value.toISOString():String(value);if(text.length>10000)throw new Error("Een cel bevat meer dan 10.000 tekens.");return [column.id,text];
  }))}));
  return {id:`import_${crypto.randomUUID()}`,name:name.replace(/\.[^.]+$/,"").slice(0,100),origin:"import",columns,rows};
}
function isNumeric(value:unknown) {
  if(typeof value==="number")return Number.isFinite(value);
  return typeof value==="string"&&/^[+-]?(?:0|[1-9]\d*)(?:[.,]\d+)?$/.test(value.trim());
}
export function csvFromRows(columns:Column[],rows:RecordRow[]):string {
  const escape=(value:Cell)=>{let text=value===null?"":typeof value==="number"?String(value).replace(".",","):String(value);if(typeof value==="string"&&/^[\s\t\r]*[=+\-@]/.test(value))text=`'${text}`;return /[;"\r\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text;};
  return "\uFEFF"+[columns.map(c=>escape(c.label)).join(";"),...rows.map(r=>columns.map(c=>escape(r.values[c.id]??null)).join(";"))].join("\r\n");
}
export function downloadLocal(filename:string,content:string,type="application/json") {
  const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement("a");a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
