"use client";
import { useMemo, useState } from "react";
import { formatValue, type Cell, type Column, type Dataset, type RecordRow } from "@/lib/bi/model";

export function WorkbenchGrid({dataset,columns,rows,onEdit,onAdd}:{dataset:Dataset;columns:Column[];rows:RecordRow[];onEdit:(row:string,column:string,value:string)=>boolean;onAdd:()=>void}) {
  const [search,setSearch]=useState(""),[page,setPage]=useState(0),[sort,setSort]=useState<{field:string;direction:number}|null>(null);
  const ordered=useMemo(()=>{
    const filtered=rows.filter(r=>!search||Object.values(r.values).some(value=>String(value??"").toLowerCase().includes(search.toLowerCase())));
    return sort?[...filtered].sort((a,b)=>{const x=a.values[sort.field],y=b.values[sort.field];return (typeof x==="number"&&typeof y==="number"?x-y:String(x??"").localeCompare(String(y??""),"nl",{numeric:true}))*sort.direction;}):filtered;
  },[rows,search,sort]);
  const currentPage=Math.min(page,Math.max(0,Math.ceil(ordered.length/25)-1)),start=currentPage*25,shown=ordered.slice(start,start+25);
  const inputText=(value:Cell|undefined)=>value===null||value===undefined?"":typeof value==="boolean"?value?"Ja":"Nee":String(value);
  return <section className="bi-data-panel">
    <div className="bi-data-toolbar"><div><h2>{dataset.name}</h2><p>{rows.length} regels in de selectie · {columns.length} velden · {dataset.origin==="derived"?"afgeleide tabel, bronregels blijven leidend":"bewerk een cel en verlaat deze om de wijziging door te rekenen"}</p></div><label>Zoek in deze tabel<input value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}} placeholder="Zoek een regel…"/></label>{dataset.origin!=="derived"&&<button className="bi-secondary" onClick={()=>{onAdd();setSearch("");setSort(null);setPage(Math.floor(rows.length/25));}}>+ Regel toevoegen</button>}</div>
    <div className="bi-table-scroll"><table className="bi-data-grid"><thead><tr><th>Regel</th>{columns.map(column=><th key={column.id}><button onClick={()=>setSort({field:column.id,direction:sort?.field===column.id?-sort.direction:1})}>{column.formula?"ƒ ":""}{column.label}{sort?.field===column.id?(sort.direction>0?" ↑":" ↓"):""}</button><small>{column.id}</small></th>)}</tr></thead><tbody>{shown.map((record,index)=><tr key={record.id}><th>{start+index+1}</th>{columns.map(column=>{
      const calculated=dataset.origin==="derived"||!!column.formula||!dataset.columns.some(c=>c.id===column.id),value=record.values[column.id];
      return <td key={column.id} className={calculated?"calculated":""}>{calculated?<span title={column.formula??"Veld uit een gekoppelde/afgeleide bron"}>{formatValue(value,column)}</span>:<input key={`${record.id}-${column.id}-${String(value)}`} aria-label={`${column.label}, regel ${start+index+1}`} defaultValue={inputText(value)} inputMode={column.type==="number"?"decimal":undefined} onBlur={e=>{if(!onEdit(record.id,column.id,e.currentTarget.value))e.currentTarget.value=inputText(value);}} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur();if(e.key==="Escape"){e.currentTarget.value=inputText(value);e.currentTarget.blur();}}}/>}</td>;
    })}</tr>)}{!shown.length&&<tr><td colSpan={columns.length+1}>Geen regels gevonden.</td></tr>}</tbody></table></div>
    <footer><span>{ordered.length?`${start+1}–${Math.min(start+25,ordered.length)} van ${ordered.length}`:"0 regels"} · grijze cellen zijn berekend of gekoppeld</span><div><button className="bi-secondary" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>Vorige</button><button className="bi-secondary" disabled={start+25>=ordered.length} onClick={()=>setPage(currentPage+1)}>Volgende</button></div></footer>
  </section>;
}
