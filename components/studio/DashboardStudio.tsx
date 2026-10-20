"use client";

import { useEffect, useState } from "react";
import { ADMINS, DATASETS, METRICS, MONTHS, REQUEST_STORAGE, SOURCE_STORAGE, STUDIO_STORAGE, newWidget, validateDashboard, type Dashboard, type DatasetId, type EngineTrace, type GenerationResult, type MissingRequest, type Widget } from "@/lib/studio/model";
import { demoDashboards, EXAMPLE_PROMPT, makeDashboard } from "@/lib/studio/planner";
import { DashboardWidget } from "./DashboardWidget";
import { StudioIcon as Icon } from "./StudioIcon";

type Screen = "library" | "generate" | "editor" | "view" | "sources";
export function DashboardStudio({ internal }: { internal: boolean }) {
  const [screen, setScreen] = useState<Screen>("library");
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [current, setCurrent] = useState<Dashboard | null>(null);
  const [ready, setReady] = useState(false);
  const [question, setQuestion] = useState(EXAMPLE_PROMPT);
  const [followup, setFollowup] = useState("");
  const [busy, setBusy] = useState(false);
  const [trace, setTrace] = useState<EngineTrace | null>(null);
  const [missing, setMissing] = useState<GenerationResult["missing"]>();
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false);
  const [search, setSearch] = useState("");
  const [profile, setProfile] = useState("eigenaar");
  const [addOpen, setAddOpen] = useState(false);
  const [available, setAvailable] = useState<string[]>(["revenue", "hours"]);
  const [sources, setSources] = useState<Record<string, { enabled: boolean; simulatedAt?: string }>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STUDIO_STORAGE);
      setDashboards(saved ? (JSON.parse(saved) as unknown[]).map(validateDashboard) : demoDashboards());
    } catch { setDashboards(demoDashboards()); setNotice("De opgeslagen demo kon niet worden gelezen. De voorbeelddashboards zijn geladen."); }
    try {
      const config = JSON.parse(localStorage.getItem(SOURCE_STORAGE) || "{}");
      setSources(config); setAvailable(DATASETS.filter((s) => config[s.id]?.enabled !== false).map((s) => s.id));
    } catch { /* De lokale demobronnen zijn standaard beschikbaar. */ }
    setReady(true);
  }, []);

  function leave(next: Screen) {
    if (dirty && !window.confirm("Je hebt niet-opgeslagen wijzigingen. Wil je deze verlaten?")) return;
    setDirty(false); setScreen(next); setNotice(""); setMissing(undefined); setTrace(null);
  }
  function open(dashboard: Dashboard, edit = false) {
    setCurrent(structuredClone(dashboard)); setSelected(dashboard.widgets[0]?.id ?? null); setDirty(false); setTrace(null); setMissing(undefined); setNotice(""); setScreen(edit ? "editor" : "view");
  }
  function change(changes: Partial<Dashboard>) { if (!current) return; setCurrent({ ...current, ...changes }); if (screen === "editor") setDirty(true); }
  function changeWidget(changes: Partial<Widget>) { if (!current || !selected) return; change({ widgets: current.widgets.map((w) => w.id === selected ? { ...w, ...changes } : w) }); }
  function save() {
    if (!current) return;
    try {
      const saved = validateDashboard({ ...current, updatedAt: new Date().toISOString() });
      const next = dashboards.some((d) => d.id === saved.id) ? dashboards.map((d) => d.id === saved.id ? saved : d) : [saved, ...dashboards];
      localStorage.setItem(STUDIO_STORAGE, JSON.stringify(next)); setDashboards(next); setCurrent(saved); setDirty(false); setNotice("Dashboard opgeslagen in deze browser.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Opslaan mislukt."); }
  }
  function addWidget(metric: Widget["metric"], kind: Widget["kind"]) {
    if (!current) return;
    if (current.widgets.length >= 24) { setNotice("Een dashboard kan maximaal 24 componenten bevatten."); return; }
    const w = newWidget(metric, kind); change({ widgets: [...current.widgets, w] }); setSelected(w.id); setAddOpen(false);
  }
  function move(id: string, direction: number) {
    if (!current) return;
    const widgets = [...current.widgets], from = widgets.findIndex((w) => w.id === id), to = from + direction;
    if (from < 0 || to < 0 || to >= widgets.length) return;
    [widgets[from], widgets[to]] = [widgets[to], widgets[from]]; change({ widgets });
  }
  async function generate(edit = false) {
    const prompt = edit ? followup : question;
    if (!prompt.trim() || busy) return;
    setBusy(true); setNotice(""); setMissing(undefined);
    try {
      const response = await fetch("/api/studio/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: prompt, ...(edit && current ? { current } : {}), available }) });
      const result = await response.json() as GenerationResult & { error?: string };
      if (!response.ok) throw new Error(result.error || "Genereren mislukt.");
      if (result.missing) {
        setMissing(result.missing);
        const requests: MissingRequest[] = JSON.parse(localStorage.getItem(REQUEST_STORAGE) || "[]");
        const next = [...requests.filter((r) => r.question !== prompt), { id: crypto.randomUUID(), question: prompt, missing: result.missing.fields, createdAt: new Date().toISOString() }].slice(-20);
        localStorage.setItem(REQUEST_STORAGE, JSON.stringify(next));
      } else if (result.dashboard && result.trace) {
        const dashboard = validateDashboard(result.dashboard);
        if (!edit) { dashboard.owner = profile; dashboard.id = crypto.randomUUID(); }
        setCurrent(dashboard); setTrace(result.trace); setSelected(dashboard.widgets[0]?.id ?? null); setDirty(true); setScreen("editor"); setFollowup("");
      } else throw new Error("Geen dashboard ontvangen.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Genereren mislukt."); }
    finally { setBusy(false); }
  }
  async function enterCustomer() {
    try {
      const response = await fetch("/api/studio/session", { method: "POST" });
      if (!response.ok) throw new Error();
      window.location.assign("/studio");
    } catch { setNotice("Klantdemo openen mislukt. Probeer opnieuw."); }
  }

  const activeWidget = current?.widgets.find((w) => w.id === selected);
  const editing = screen === "editor";
  const section = screen === "generate" ? "generate" : screen === "sources" ? "sources" : "library";
  const toolboxHref = internal ? "/" : "/login?next=%2F";
  const canEdit = profile === "eigenaar" || current?.owner === profile;
  const visible = dashboards.filter((d) => (d.owner === profile || d.shared) && `${d.title} ${d.description}`.toLowerCase().includes(search.toLowerCase()));
  if (!ready) return <div className="studio-loading">Dashboard Studio wordt geopend…</div>;

  return <main className="studio-app">
    <aside className="studio-sidebar">
      <a className="studio-brand" href={toolboxHref} aria-label="Terug naar Irixs Toolbox"><span>ix</span><div>Irixs <b>Dashboard Studio</b></div></a>
      <div className="studio-workspace"><span className="studio-avatar">ID</span><div>Irixs Demo<span>Demonstratiewerkruimte</span></div><span>⌄</span></div>
      <div className="studio-nav-label">WERKRUIMTE</div>
      <button className={section === "library" ? "active" : ""} aria-current={section === "library" ? "page" : undefined} onClick={() => leave("library")}><Icon name="grid"/>Dashboards<span className="studio-count">{dashboards.filter((d)=>d.owner===profile||d.shared).length}</span></button>
      <button className={section === "generate" ? "active" : ""} aria-current={section === "generate" ? "page" : undefined} onClick={() => leave("generate")}><Icon name="spark"/>Maken met AI</button>
      <button className={section === "sources" ? "active" : ""} aria-current={section === "sources" ? "page" : undefined} onClick={() => leave("sources")}><Icon name="data"/>Mijn databronnen</button>
      {internal&&<a className="studio-text-button" href="/studio/data" style={{padding:"12px",fontSize:12}}><Icon name="edit" size={17}/>Data & formules ↗</a>}
      <div className="studio-sidebar-note"><span className="studio-dot"/> Demonstratiedata<p>Ontdek de mogelijkheden met fictieve cijfers. Er is geen live AFAS-koppeling.</p></div>
      <div className="studio-sidebar-bottom">
        {internal && <a href="/internal"><Icon name="layers"/>Irixs intern ↗</a>}
        <a href={toolboxHref}><Icon name="back"/>Terug naar Toolbox</a>
        {!internal && <small>Voor Irixs-onderdelen log je opnieuw in.</small>}
        <div className="studio-demo-profile"><label htmlFor="studio-profile">Demoprofiel</label><select id="studio-profile" value={profile} onChange={(e) => { if (dirty && !window.confirm("Niet-opgeslagen wijzigingen verlaten?")) return; setProfile(e.target.value); setScreen("library"); setDirty(false); }}><option value="eigenaar">Eigenaar · bewerken</option><option value="collega">Collega · gedeeld bekijken</option></select></div>
      </div>
    </aside>

    <section className="studio-main">
      <header className="studio-topbar"><div><span className="studio-breadcrumb">Werkruimte</span><span>/</span><strong>{section === "sources" ? "Databronnen" : section === "generate" ? "Maken met AI" : "Dashboards"}</strong></div><div><span className="studio-demo-badge">DEMO</span>{internal ? <button onClick={() => void enterCustomer()}>Klantdemo starten <Icon name="arrow" size={14}/></button> : <span className="studio-breadcrumb">InSite-integratie · klantmodus</span>}<span className="studio-avatar small">{profile === "eigenaar" ? "DM" : "CO"}</span></div></header>
      <div className="studio-content">
        {notice && <div className="studio-notice" role="status"><Icon name="info"/>{notice}<button onClick={()=>setNotice("")} aria-label="Melding sluiten"><Icon name="close" size={14}/></button></div>}

        {screen === "library" && <>
          <div className="studio-page-heading"><div><p className="studio-eyebrow">VAN DATA NAAR INZICHT</p><h1>Jouw cijfers. Jouw overzicht.</h1><p>Open een dashboard of maak er één dat precies bij je vraag past.</p></div><button className="studio-primary" onClick={()=>{setScreen("generate");setMissing(undefined);}}><Icon name="plus"/>Nieuw dashboard</button></div>
          <div className="studio-create-banner"><div className="studio-create-icon"><Icon name="spark" size={27}/></div><div><span>BEGIN MET EEN VRAAG</span><h2>Wat wil je weten van je organisatie?</h2><p>Beschrijf je vraag. Wij brengen de juiste cijfers bij elkaar.</p></div><button className="studio-primary" onClick={()=>setScreen("generate")}>Maken met AI <Icon name="arrow"/></button></div>
          <div className="studio-section-heading"><h2>Mijn dashboards <span>{visible.length}</span></h2><label className="studio-search"><Icon name="search" size={16}/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Zoek een dashboard" aria-label="Zoek een dashboard"/></label></div>
          <div className="studio-dashboard-cards">{visible.map((d,index)=><article key={d.id} className="studio-dashboard-card"><button className={`studio-dashboard-preview preview-${index%3}`} onClick={()=>open(d)} aria-label={`Open ${d.title}`}><div className="studio-preview-kpis"><span/><span/><span/></div><div className="studio-preview-chart">{[42,58,49,67,53,73,64,83,74,95,84,100].map((h,i)=><i key={i} style={{height:`${h}%`}}/>)}</div><span className="studio-preview-open"><Icon name="eye"/>Bekijken</span></button><div className="studio-card-body"><div className="studio-card-tag"><Icon name="chart" size={13}/>{DATASETS.find((s)=>s.id===d.dataset)?.name}<span>{d.shared?"Gedeeld":"Privé"}</span></div><button className="studio-card-title" onClick={()=>open(d)}>{d.title}</button><p>{d.description}</p><footer><span>{d.updatedAt ? `Opgeslagen ${new Date(d.updatedAt).toLocaleDateString("nl-NL")}` : "Voorbeelddashboard"}</span>{(profile==="eigenaar"||d.owner===profile)&&<button onClick={()=>open(d,true)} aria-label={`Bewerk ${d.title}`}><Icon name="edit" size={14}/>Bewerken</button>}</footer></div></article>)}<button className="studio-blank-card" onClick={()=>{const d=makeDashboard("revenue",true);d.owner=profile;open(d,true);setDirty(true);}}><span><Icon name="plus" size={26}/></span><h3>Zelf bouwen</h3><p>Begin met een leeg canvas.<br/>Jij bepaalt de indeling.</p><b>Nieuw leeg dashboard <Icon name="arrow" size={15}/></b></button></div>
          <p className="studio-footnote">Dashboards en delen worden voor deze demo in deze browser bewaard. Het demoprofiel simuleert een collega; er worden geen echte gebruikersrechten verleend.</p>
        </>}

        {screen === "generate" && <div className="studio-generate-page"><button className="studio-text-button" onClick={()=>leave("library")}><Icon name="back" size={15}/>Alle dashboards</button><div className="studio-ai-orb"><Icon name="spark" size={34}/></div><p className="studio-eyebrow">MAKEN MET AI</p><h1>Stel je vraag.<br/><span>Ontdek het verhaal in je data.</span></h1><p className="studio-generate-intro">Van een eerste vraag naar een bewerkbaar dashboard.<br/>De Irixs Knowledge Engine controleert welke gegevens beschikbaar zijn.</p><div className="studio-prompt-box"><textarea aria-label="Beschrijf je dashboard" value={question} maxLength={2000} onChange={(e)=>setQuestion(e.target.value)} placeholder="Bijvoorbeeld: hoe ontwikkelt onze omzet zich per maand?" disabled={busy}/><div><span><Icon name="data" size={14}/>{available.length} demobronnen beschikbaar</span><button className="studio-primary" onClick={()=>void generate()} disabled={busy||!question.trim()}>{busy?<><span className="studio-spinner"/>Samenstellen…</>:<><Icon name="spark" size={16}/>Genereer dashboard</>}</button></div></div><div className="studio-suggestions"><button disabled={busy} onClick={()=>setQuestion(EXAMPLE_PROMPT)}>Omzet & top 10 klanten</button><button disabled={busy} onClick={()=>setQuestion("Maak een dashboard van geschreven projecturen, declarabele uren en declarabiliteit per maand en project.")}>Projecturen & declarabiliteit</button><button disabled={busy} onClick={()=>setQuestion("Maak een verzuimdashboard per afdeling met het verzuimpercentage per maand.")}>Ontbrekende data demonstreren</button></div>{busy&&<EngineProgress/>}{missing&&<MissingPanel missing={missing}/>}<div className="studio-powered"><Icon name="layers" size={16}/>Powered by Irixs Knowledge Engine<span>Alleen beschikbare data. Controleerbare KPI’s.</span></div></div>}

        {(screen === "editor" || screen === "view") && current && <>
          <div className="studio-editor-heading"><div><button className="studio-text-button" onClick={()=>leave("library")}><Icon name="back" size={14}/>Alle dashboards</button><h1>{current.title}{dirty&&<span className="studio-unsaved">Niet opgeslagen</span>}</h1><p>{current.description}</p></div><div className="studio-heading-actions">{editing ? <><button className="studio-secondary" disabled={busy} onClick={()=>setScreen("view")}><Icon name="eye" size={15}/>Voorbeeld</button><button className="studio-primary" disabled={busy} onClick={save}><Icon name="save" size={16}/>Opslaan</button></>:canEdit&&<button className="studio-secondary" onClick={()=>setScreen("editor")}><Icon name="edit" size={15}/>Bewerken</button>}</div></div>
          <div className="studio-filterbar"><div><Icon name="data" size={14}/><span>{DATASETS.find((d)=>d.id===current.dataset)?.name}</span><span className="studio-source-dot"/>Demodata</div><label>Jaar<select aria-label="Filter jaar" value={current.filters.year} onChange={(e)=>change({filters:{...current.filters,year:Number(e.target.value)}})}><option>2026</option><option>2025</option></select></label><label>Administratie<select aria-label="Filter administratie" value={current.filters.administration} onChange={(e)=>change({filters:{...current.filters,administration:e.target.value}})}><option value="all">Alle administraties</option>{ADMINS.map((a)=><option key={a}>{a}</option>)}</select></label><label>Van<select aria-label="Filter vanaf maand" value={current.filters.fromMonth} onChange={(e)=>change({filters:{...current.filters,fromMonth:Number(e.target.value),toMonth:Math.max(current.filters.toMonth,Number(e.target.value))}})}>{MONTHS.map((m,i)=><option key={m} value={i+1}>{m}</option>)}</select></label><label>Tot<select aria-label="Filter tot maand" value={current.filters.toMonth} onChange={(e)=>change({filters:{...current.filters,toMonth:Number(e.target.value),fromMonth:Math.min(current.filters.fromMonth,Number(e.target.value))}})}>{MONTHS.map((m,i)=><option key={m} value={i+1}>{m}</option>)}</select></label></div>
          <div className={`studio-editor-layout ${editing?"with-inspector":""}`}><div className="studio-canvas-area">{editing&&trace&&<TracePanel trace={trace}/>}<div className="studio-canvas-label"><span>{editing?"DASHBOARD CANVAS":"OVERZICHT"}</span>{editing&&<button onClick={()=>setAddOpen(!addOpen)}><Icon name="plus" size={14}/>Component toevoegen</button>}</div>{addOpen&&editing&&<div className="studio-add-library">{Object.entries(METRICS).filter(([,m])=>m.dataset===current.dataset).map(([id,m])=><div key={id}><strong>{m.name}</strong><div>{(["kpi","bar","line","table"] as const).map((kind)=><button key={kind} onClick={()=>addWidget(id as Widget["metric"],kind)}>{kind==="kpi"?"KPI":kind==="bar"?"Staaf":kind==="line"?"Lijn":"Tabel"}</button>)}</div></div>)}</div>}
          {!available.includes(current.dataset)&&<div className="studio-missing"><Icon name="info"/><div><strong>Deze demobron is uitgeschakeld.</strong><p>Schakel de bron in bij Mijn databronnen om dit dashboard te bekijken.</p></div></div>}
          {available.includes(current.dataset)&&<div className="studio-widget-grid">{current.widgets.map((w)=><DashboardWidget key={w.id} dashboard={current} widget={w} editing={editing} selected={editing&&selected===w.id} onSelect={()=>setSelected(w.id)} onMove={(direction)=>move(w.id,direction)} onRemove={()=>{change({widgets:current.widgets.filter((x)=>x.id!==w.id)});if(selected===w.id)setSelected(null);}} onDrop={(from)=>{const a=current.widgets.findIndex((x)=>x.id===from),b=current.widgets.findIndex((x)=>x.id===w.id);if(a<0||a===b)return;const widgets=[...current.widgets];widgets.splice(b,0,widgets.splice(a,1)[0]);change({widgets});}}/>)}</div>}
          {!current.widgets.length&&<button className="studio-empty-canvas" onClick={()=>setAddOpen(true)}><Icon name="plus" size={28}/><h3>Ruimte voor jouw eerste inzicht</h3><p>Voeg een KPI, grafiek of tabel toe.</p></button>}
          <footer className="studio-data-footer"><span><span className="studio-source-dot"/>Fictieve dataset · versie 19 oktober 2026{sources[current.dataset]?.simulatedAt?` · demo-verversing gesimuleerd om ${new Date(sources[current.dataset].simulatedAt!).toLocaleTimeString("nl-NL")}`:" · geen live synchronisatie"}</span><span>{current.widgets.length} componenten</span></footer></div>
          {editing&&<aside className="studio-inspector"><div className="studio-inspector-tabs"><strong><Icon name="edit" size={14}/>Instellingen</strong><span>EDITOR</span></div><div className="studio-inspector-body"><label>Dashboardtitel<input value={current.title} maxLength={100} onChange={(e)=>change({title:e.target.value})}/></label><label>Omschrijving<textarea value={current.description} maxLength={500} onChange={(e)=>change({description:e.target.value})}/></label><label className="studio-checkbox"><input type="checkbox" checked={current.shared} onChange={(e)=>change({shared:e.target.checked})}/>Beschikbaar voor democollega</label><small>Delen werkt in deze browser. Echte accounts worden niet aangemaakt.</small><hr/>{activeWidget?<><div className="studio-inspector-subheading">Geselecteerde component</div><label>Titel component<input aria-label="Titel component" value={activeWidget.title} maxLength={100} onChange={(e)=>changeWidget({title:e.target.value})}/></label><label>Weergave<select aria-label="Weergave component" value={activeWidget.kind} onChange={(e)=>changeWidget({kind:e.target.value as Widget["kind"]})}><option value="kpi">KPI-tegel</option><option value="bar">Staafdiagram</option><option value="line">Lijndiagram</option><option value="table">Tabel</option></select></label><label>KPI<select value={activeWidget.metric} onChange={(e)=>changeWidget({metric:e.target.value as Widget["metric"]})}>{Object.entries(METRICS).filter(([,m])=>m.dataset===current.dataset).map(([id,m])=><option key={id} value={id}>{m.name}</option>)}</select></label>{activeWidget.kind!=="kpi"&&<><label>Groeperen op<select value={activeWidget.dimension} onChange={(e)=>changeWidget({dimension:e.target.value as Widget["dimension"]})}>{DATASETS.find((s)=>s.id===current.dataset)!.dimensions.map((dim)=><option key={dim} value={dim}>{dim==="month"?"Maand":dim==="customer"?"Klant":dim==="project"?"Project":"Administratie"}</option>)}</select></label><label>Breedte<select value={activeWidget.width} onChange={(e)=>changeWidget({width:e.target.value as Widget["width"]})}><option value="half">Halve breedte</option><option value="full">Volledige breedte</option></select></label></>}<label className="studio-checkbox"><input type="checkbox" checked={activeWidget.compare} onChange={(e)=>changeWidget({compare:e.target.checked})}/>Vergelijk met vorig jaar</label><p className="studio-formula">{METRICS[activeWidget.metric].formula}</p></>:<p className="studio-formula">Klik op een componenttitel om de instellingen aan te passen. Versleep componenten of gebruik de pijltjes om de volgorde te wijzigen.</p>}<hr/><div className="studio-ai-panel-title"><Icon name="spark"/>Pas aan met AI</div><p>Je dashboard blijft behouden. Beschrijf wat je wilt veranderen.</p><textarea aria-label="Pas dashboard aan met AI" value={followup} disabled={busy} maxLength={2000} onChange={(e)=>setFollowup(e.target.value)} placeholder="Maak de omzetgrafiek een lijndiagram en voeg een groeitegel toe."/><button className="studio-primary" disabled={busy||!followup.trim()} onClick={()=>void generate(true)}>{busy?<span className="studio-spinner"/>:<Icon name="spark" size={15}/>}Wijziging toepassen</button><button className="studio-inline-example" disabled={busy} onClick={()=>setFollowup("Verander de maandgrafiek naar een lijndiagram en voeg een KPI voor groei ten opzichte van vorig jaar toe.")}>Vul voorbeeldwijziging in</button>{busy&&<EngineProgress/>}{missing&&<MissingPanel missing={missing}/>}</div></aside>}</div>
        </>}

        {screen === "sources" && <><div className="studio-page-heading"><div><p className="studio-eyebrow">DE BASIS VAN JE INZICHTEN</p><h1>Mijn databronnen</h1><p>Beschikbare demonstratiedata voor jouw werkruimte.</p></div></div><div className="studio-source-cards">{DATASETS.map((s)=><article className="studio-source-card" key={s.id}><div><span className="studio-source-icon"><Icon name="data" size={22}/></span><span className="studio-status-pill">{available.includes(s.id)?"Beschikbaar":"Uitgeschakeld"}</span></div><h2>{s.name}</h2><p>{s.description}</p><dl><dt>Type</dt><dd>Lokale fictieve dataset</dd><dt>Datasetversie</dt><dd>19 oktober 2026</dd><dt>Verversen</dt><dd>Handmatig · simulatie</dd></dl><div className="studio-source-actions"><button className="studio-secondary" onClick={()=>{const config={...sources,[s.id]:{...sources[s.id],enabled:!available.includes(s.id)}};setSources(config);setAvailable(DATASETS.filter((x)=>config[x.id]?.enabled!==false).map((x)=>x.id));localStorage.setItem(SOURCE_STORAGE,JSON.stringify(config));}}>{available.includes(s.id)?"Bron uitschakelen (demo)":"Bron inschakelen (demo)"}</button><button className="studio-text-button" onClick={()=>{const config={...sources,[s.id]:{enabled:available.includes(s.id),simulatedAt:new Date().toISOString()}};setSources(config);localStorage.setItem(SOURCE_STORAGE,JSON.stringify(config));setNotice("Demo-verversing gesimuleerd. Er is geen verbinding met AFAS gemaakt en de fictieve cijfers zijn niet gewijzigd.");}}>Verversen simuleren ↻</button></div>{sources[s.id]?.simulatedAt&&<small>Laatst gesimuleerd: {new Date(sources[s.id].simulatedAt!).toLocaleString("nl-NL")}</small>}</article>)}</div><div className="studio-notice"><Icon name="info"/>Mis je gegevens? Irixs kan de inrichting aanvullen. De klantomgeving bevat geen technische connectorinrichting.</div></>}
      </div>
    </section>
  </main>;
}

function EngineProgress() { return <div className="studio-engine-progress" role="status"><span className="studio-spinner"/><div><strong>Dashboard wordt samengesteld</strong><p>De Irixs Knowledge Engine controleert de vraag, bronnen en benodigde velden…</p></div></div>; }
function MissingPanel({missing}:{missing:NonNullable<GenerationResult["missing"]>}) { return <div className="studio-missing" role="status"><Icon name="info"/><div><strong>Er ontbreken nog gegevens</strong><p>{missing.message}</p><small>De databehoefte is in deze browser vastgelegd voor de Irixs-demo. Er is geen extern supportverzoek verstuurd.</small></div></div>; }
function TracePanel({trace}:{trace:EngineTrace}) { return <details className="studio-trace" open><summary><Icon name="spark" size={17}/><strong>Dashboard samengesteld</strong><span>{trace.checks.length} controles uitgevoerd</span></summary><div>{trace.checks.map((step)=><div className="studio-trace-step" key={step.label}><Icon name="check" size={15}/><div><strong>{step.label}</strong><p>{step.detail}</p></div></div>)}<footer><Icon name="layers" size={15}/>Powered by Irixs Knowledge Engine<span>{trace.source==="deterministic"?"Demo-interpreter":"AI + gevalideerde metadata"}</span></footer>{trace.warning&&<small>{trace.warning}</small>}</div></details>; }
