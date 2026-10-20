"use client";
import { useMemo } from "react";
import { formatValue, visualData, type Column, type Filters, type Point, type Visual, type Workspace } from "@/lib/bi/model";
import { StudioIcon } from "@/components/studio/StudioIcon";

type Data = ReturnType<typeof visualData>;
export function WorkbenchVisual({workspace,visual,filters,onSelect,onEdit,onMove,onRemove,editing,selected}:{workspace:Workspace;visual:Visual;filters:Filters;onSelect:(point:Point)=>void;onEdit:()=>void;onMove:(direction:number)=>void;onRemove:()=>void;editing:boolean;selected:boolean}) {
  const result=useMemo(()=>{try{return {data:visualData(workspace,visual,filters)};}catch(error){return {error:error instanceof Error?error.message:"Deze grafiek kan niet worden berekend."};}},[workspace,visual,filters]);
  const data=result.data;
  const sameUnit=!data?.secondary||data.primary.format===data.secondary.format;
  return <article id={`bi-visual-${visual.id}`} style={{scrollMarginTop:20}} className={`bi-visual ${visual.kind==="kpi"?"bi-kpi":""} ${visual.width==="full"?"bi-full":""} ${selected&&editing?"selected":""}`}>
    <header><div><h3>{visual.title}</h3><p>{workspace.datasets.find(d=>d.id===visual.source)?.name}{visual.compare?.period==="previousYear"?" · vergelijking met vorig jaar":visual.compare?` × ${workspace.datasets.find(d=>d.id===visual.compare!.source)?.name}`:""}</p></div>{editing&&<div className="bi-icon-actions"><button onClick={()=>onMove(-1)} aria-label={`${visual.title} omhoog`}>↑</button><button onClick={()=>onMove(1)} aria-label={`${visual.title} omlaag`}>↓</button><button onClick={onEdit} aria-label={`Instellingen ${visual.title}`}><StudioIcon name="edit" size={15}/></button><button onClick={onRemove} aria-label={`Verwijder ${visual.title}`}><StudioIcon name="close" size={15}/></button></div>}</header>
    {result.error?<div className="bi-chart-warning"><StudioIcon name="info"/><p>{result.error}</p></div>:data&&<>
      <div className="bi-chart-totals"><div><small>{visual.measure.aggregation==="formula"?"Formule over totalen":data.primary.label} · volledige selectie</small><strong>{formatValue(data.total,data.primary)}</strong></div>{data.secondary&&<div><small>{data.secondary.label}</small><strong className="secondary">{formatValue(data.comparison,data.secondary)}</strong></div>}</div>
      <div className="bi-legend"><span><i/>{data.primary.label}</span>{data.secondary&&<span><i className="secondary"/>{data.secondary.label}</span>}</div>
      {visual.kind==="kpi"?null:visual.kind==="table"?<ResultTable data={data} select={onSelect} sameUnit={sameUnit}/>:!sameUnit&&visual.kind!=="scatter"?<div className="bi-chart-warning">Deze waarden hebben verschillende eenheden. Kies een tabel of spreidingsdiagram; één gedeelde as zou misleiden.</div>:<Graphic data={data} kind={visual.kind} onSelect={onSelect}/>}
      {visual.kind!=="table"&&visual.kind!=="kpi"&&<details className="bi-chart-details"><summary>Gegevens achter deze grafiek</summary><ResultTable data={data} select={onSelect} sameUnit={sameUnit}/></details>}
      <footer>{visual.kind==="kpi"?"Gehele gefilterde bron, niet alleen de getoonde topgroepen":`Maximaal ${visual.top} groepen · klik een waarde om de andere grafieken te filteren`}{!sameUnit?" · geen verschilberekening bij verschillende eenheden":""}</footer>
    </>}
  </article>;
}
function ResultTable({data,select,sameUnit}:{data:Data;select:(point:Point)=>void;sameUnit:boolean}) {
  return <div className="bi-table-scroll"><table className="bi-result-table"><thead><tr><th>Groep</th><th>{data.primary.label}</th>{data.secondary&&<><th>{data.secondary.label}</th>{sameUnit&&<><th>Verschil A − B</th><th>Verschil %</th></>}</>}</tr></thead><tbody>{data.points.map(point=><tr key={point.key}><th><button onClick={()=>select(point)}>{point.label}</button></th><td>{formatValue(point.value,data.primary)}</td>{data.secondary&&<><td>{formatValue(point.comparison,data.secondary)}</td>{sameUnit&&<><td>{formatValue(point.delta,data.primary)}</td><td>{formatValue(point.percent,{format:"percent"})}</td></>}</>}</tr>)}{!data.points.length&&<tr><td colSpan={5}>Geen regels in deze selectie.</td></tr>}</tbody></table></div>;
}
function Graphic({data,kind,onSelect}:{data:Data;kind:Visual["kind"];onSelect:(point:Point)=>void}) {
  const width=660,height=260,left=62,right=18,top=16,bottom=46,plotW=width-left-right,plotH=height-top-bottom;
  const values=data.points.flatMap(p=>[p.value,p.comparison]).filter((v):v is number=>v!==null),minimum=Math.min(0,...values),maximum=Math.max(0,...values),range=maximum-minimum||1;
  const y=(value:number)=>top+(maximum-value)/range*plotH,slot=plotW/Math.max(1,data.points.length),x=(index:number)=>left+(index+.5)*slot;
  const compact=(value:number)=>new Intl.NumberFormat("nl-NL",{notation:"compact",maximumFractionDigits:1}).format(value);
  const title=(p:Point)=>`${p.label}: ${data.primary.label} ${formatValue(p.value,data.primary)}${data.secondary?`; ${data.secondary.label} ${formatValue(p.comparison,data.secondary)}`:""}`;
  const keyboard=(event:React.KeyboardEvent,point:Point)=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();onSelect(point);}};
  if(!data.points.length)return <div className="bi-chart-warning">Geen gegevens in deze selectie.</div>;
  if(kind==="scatter"){
    if(!data.secondary)return <div className="bi-chart-warning">Kies een tweede bron/waarde voor de Y-as van het spreidingsdiagram.</div>;
    const valid=data.points.filter(p=>p.value!==null&&p.comparison!==null),xMin=Math.min(0,...valid.map(p=>p.value!)),xMax=Math.max(1,...valid.map(p=>p.value!)),yMin=Math.min(0,...valid.map(p=>p.comparison!)),yMax=Math.max(1,...valid.map(p=>p.comparison!));
    return <svg className="bi-graphic" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Spreiding: X ${data.primary.label}, Y ${data.secondary.label}`}><line x1={left} y1={height-bottom} x2={width-right} y2={height-bottom} stroke="#DED6E2"/><line x1={left} y1={top} x2={left} y2={height-bottom} stroke="#DED6E2"/><text x={left} y={height-12} fontSize="11">X: {data.primary.label}</text><text x={left} y={12} fontSize="11">Y: {data.secondary.label}</text>{valid.map(p=><g key={p.key} role="button" tabIndex={0} aria-label={title(p)} onClick={()=>onSelect(p)} onKeyDown={e=>keyboard(e,p)}><circle cx={left+(p.value!-xMin)/(xMax-xMin)*plotW} cy={top+(yMax-p.comparison!)/(yMax-yMin)*plotH} r={7} fill="#6A538E" stroke="#340C46"><title>{title(p)}</title></circle><text x={left+(p.value!-xMin)/(xMax-xMin)*plotW+9} y={top+(yMax-p.comparison!)/(yMax-yMin)*plotH} fontSize="10">{p.label.slice(0,15)}</text></g>)}</svg>;
  }
  function segments(field:"value"|"comparison"){const output:{x:number;y:number}[][]=[];let current:{x:number;y:number}[]=[];data.points.forEach((p,i)=>{if(p[field]===null){if(current.length)output.push(current);current=[];}else current.push({x:x(i),y:y(p[field]!)});});if(current.length)output.push(current);return output;}
  const stroke=(field:"value"|"comparison")=>field==="value"?"#6A538E":"#E39C16";
  return <svg className="bi-graphic" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Interactieve ${kind==="bar"?"staafgrafiek":kind==="area"?"vlakgrafiek":"lijngrafiek"}`}>
    {[0,.25,.5,.75,1].map(f=>{const value=minimum+range*f;return <g key={f}><line x1={left} x2={width-right} y1={y(value)} y2={y(value)} stroke="#EEE8F1"/><text x={left-9} y={y(value)+4} textAnchor="end" fontSize="11" fill="#716677">{compact(value)}</text></g>;})}
    <line x1={left} x2={width-right} y1={y(0)} y2={y(0)} stroke="#C9BECE"/>
    {kind!=="bar"&&(["value",...(data.secondary?["comparison"]:[])] as ("value"|"comparison")[]).flatMap(field=>segments(field).map((segment,i)=>{const path=segment.map((point,j)=>`${j?"L":"M"}${point.x},${point.y}`).join(" ");return <g key={`${field}-${i}`}>{kind==="area"&&<path d={`${path} L${segment.at(-1)!.x},${y(0)} L${segment[0].x},${y(0)} Z`} fill={stroke(field)} opacity=".12"/>}<path d={path} fill="none" stroke={stroke(field)} strokeWidth="3" strokeDasharray={field==="comparison"?"6 4":undefined}/></g>;}))}
    {data.points.map((point,index)=><g key={point.key} role="button" tabIndex={0} aria-label={title(point)} onClick={()=>onSelect(point)} onKeyDown={event=>keyboard(event,point)} className="bi-chart-point"><title>{title(point)}</title>
      {kind==="bar"?<>{point.value!==null&&<rect x={x(index)-slot*.33} y={Math.min(y(point.value),y(0))} width={slot*(data.secondary ? .27 : .66)} height={Math.max(1,Math.abs(y(point.value)-y(0)))} rx="3" fill="#6A538E"/>}{data.secondary&&point.comparison!==null&&<rect x={x(index)+slot*.04} y={Math.min(y(point.comparison),y(0))} width={slot*.27} height={Math.max(1,Math.abs(y(point.comparison)-y(0)))} rx="3" fill="#FDB940"/>}</>:<>{point.value!==null&&<circle cx={x(index)} cy={y(point.value)} r={5} fill="#6A538E"/>}{data.secondary&&point.comparison!==null&&<circle cx={x(index)} cy={y(point.comparison)} r={4} fill="#E39C16"/>}</>}
      <rect x={x(index)-slot/2} y={top} width={slot} height={plotH} fill="transparent"/>
      <text x={x(index)} y={height-bottom+19} textAnchor="middle" fontSize="10" fill="#716677">{point.label.length>14?`${point.label.slice(0,12)}…`:point.label}</text>
    </g>)}
  </svg>;
}
