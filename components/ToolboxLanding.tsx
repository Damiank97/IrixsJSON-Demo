"use client";

import { useState } from "react";
import { StudioIcon } from "@/components/studio/StudioIcon";

type Audience = "all" | "internal" | "demo";
type ToolCard = {
  title: string;
  description: string;
  detail: string;
  href: string;
  action: string;
  icon: string;
  status: "Hulpmiddel" | "Demo / POC" | "Interne demo";
  audiences: Audience[];
};

export function ToolboxLanding({ connectorCount }: { connectorCount: number }) {
  const [audience, setAudience] = useState<Audience>("all");
  const tools: ToolCard[] = [
    {
      title: "PURE planning migreren",
      description: "Zet een PURE 9-planning en de voorcalculatieregels om naar een importbestand voor PURE 10.",
      detail: "Bestanden uploaden · controles bekijken · CSV downloaden",
      href: "#planning", action: "Open planningmigratie", icon: "layers",
      status: "Hulpmiddel", audiences: ["internal"],
    },
    {
      title: "PURE configuratie migreren",
      description: "Vertaal een PURE 9-configuratie naar de PURE 10-inrichting, met standaardwaarden en een eigen prefix.",
      detail: "Configuratie vergelijken · JSON voor Azure downloaden",
      href: "#config", action: "Open configuratiemigratie", icon: "edit",
      status: "Hulpmiddel", audiences: ["internal"],
    },
    {
      title: "JSON Schemabank",
      description: "Zoek officiële AFAS UpdateConnector-schema’s, bekijk voorbeelden en stel test-JSON samen.",
      detail: `${connectorCount} connectors · veldinformatie · testdata`,
      href: "#schemas", action: "Open de schemabank", icon: "data",
      status: "Hulpmiddel", audiences: ["internal", "demo"],
    },
    {
      title: "Declaratiewerkplek",
      description: "Laat zien hoe medewerkers declaraties verzamelen, wijzigen en in één keer klaarzetten.",
      detail: "Concepten · bonherkenning · kilometers · connectorvoorbeelden",
      href: "#declarations", action: "Open de declaratiedemo", icon: "save",
      status: "Demo / POC", audiences: ["demo"],
    },
    {
      title: "Irixs Studio",
      description: "Bekijk en bouw dashboards voor planning, behoefte, financiën en eigen analyses. Met AI of zelf, op hetzelfde datamodel.",
      detail: "Dashboards · tabellen · relaties · formules · lokale opslag",
      href: "/studio", action: "Open Irixs Studio", icon: "chart",
      status: "Demo / POC", audiences: ["internal", "demo"],
    },
    {
      title: "Knowledge & Data Engineer",
      description: "Bekijk de kennis achter de tools en onderzoek voorstellen voor ontbrekende data of een koppeling.",
      detail: "Officiële schema’s · metadata-advies · geen AFAS-mutaties",
      href: "/internal", action: "Open de interne werkplek", icon: "spark",
      status: "Interne demo", audiences: ["internal", "demo"],
    },
  ];
  const visibleTools = tools.filter((tool) => audience === "all" || tool.audiences.includes(audience));

  function chooseAudience(next: Audience) {
    setAudience(next);
    document.getElementById("toolbox-tools")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-9 md:px-8 md:py-12">
      <section className="tool-intro !block" aria-labelledby="toolbox-welcome">
        <div className="relative z-10 max-w-3xl">
          <p className="tool-kicker">Irixs Toolbox · werkplaats voor AFAS</p>
          <h1 id="toolbox-welcome" className="mt-5 text-4xl font-semibold leading-[1.12] tracking-[-0.04em] text-white md:text-6xl">
            AFAS-hulpmiddelen.<br />Op één plek.
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-white/85 md:text-base">
            Voor migraties, koppelingen en het uitproberen van nieuwe oplossingen.
            Een praktische werkplek voor Irixs-collega’s én een plek om mogelijkheden te demonstreren.
          </p>
          <div className="mt-7 flex flex-wrap gap-2.5">
            <a href="#toolbox-tools" className="tool-button-primary gap-3">Bekijk de tools <StudioIcon name="arrow" size={17} /></a>
            <button type="button" onClick={() => chooseAudience("demo")} className="inline-flex items-center gap-3 rounded-full border border-white/30 bg-white/10 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-white/20">
              Ik geef een demo <StudioIcon name="eye" size={17} />
            </button>
          </div>
        </div>
        <div className="relative z-10 mt-9 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/20 pt-5 text-xs text-white/80">
          <span className="inline-flex items-center gap-2"><StudioIcon name="layers" size={15} />Migreren & controleren</span>
          <span className="inline-flex items-center gap-2"><StudioIcon name="data" size={15} />Koppelingen & testdata</span>
          <span className="inline-flex items-center gap-2"><StudioIcon name="spark" size={15} />Ideeën demonstreren</span>
        </div>
      </section>

      <section className="mt-7 grid gap-4 md:grid-cols-2" aria-label="Kies je gebruik">
        <button type="button" onClick={() => chooseAudience("internal")} className={`tool-card group flex items-start gap-4 p-5 text-left transition hover:border-accent/40 md:p-6 ${audience === "internal" ? "border-accent/40 bg-accent-soft" : ""}`}>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><StudioIcon name="user" size={21} /></span>
          <span className="grow"><span className="block text-base font-semibold text-accent">Intern aan het werk</span><span className="mt-1.5 block text-sm leading-6 text-muted">Een migratie voorbereiden, een connector opzoeken of een technische vraag onderzoeken.</span></span>
          <span className="mt-1 text-accent/65 transition group-hover:translate-x-1"><StudioIcon name="arrow" size={19} /></span>
        </button>
        <button type="button" onClick={() => chooseAudience("demo")} className={`tool-card group flex items-start gap-4 p-5 text-left transition hover:border-brand-yellow md:p-6 ${audience === "demo" ? "border-brand-yellow bg-brand-yellow/5" : ""}`}>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-yellow/20 text-accent"><StudioIcon name="eye" size={21} /></span>
          <span className="grow"><span className="block text-base font-semibold text-accent">Een demo geven</span><span className="mt-1.5 block text-sm leading-6 text-muted">Laat dashboards en declaraties zien, of leg met de schemabank uit hoe een koppeling werkt.</span></span>
          <span className="mt-1 text-accent/65 transition group-hover:translate-x-1"><StudioIcon name="arrow" size={19} /></span>
        </button>
      </section>

      <section id="toolbox-tools" className="mt-12 scroll-mt-6" aria-labelledby="toolbox-tools-title">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-5">
          <div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Kies je gereedschap</p><h2 id="toolbox-tools-title" className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Waar wil je mee aan de slag?</h2></div>
          <div role="group" aria-label="Tools weergeven voor" className="flex flex-wrap gap-1 rounded-xl border border-rule bg-white p-1">
            {([ ["all", "Alles"], ["internal", "Intern gebruik"], ["demo", "Demo’s"] ] as const).map(([id, label]) => (
              <button key={id} type="button" aria-pressed={audience === id} onClick={() => setAudience(id)} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${audience === id ? "bg-accent text-white" : "text-muted hover:bg-accent-soft hover:text-accent"}`}>{label}</button>
            ))}
          </div>
        </div>
        <p className="sr-only" aria-live="polite">{visibleTools.length} tools weergegeven</p>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visibleTools.map((tool) => (
            <article key={tool.title} className="tool-card flex flex-col p-6 transition hover:border-accent/30">
              <div className="mb-6 flex items-center justify-between gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent-soft text-accent"><StudioIcon name={tool.icon} size={22} /></span>
                <span className={`rounded-full px-2.5 py-1 font-mono text-[10px] ${tool.status === "Hulpmiddel" ? "bg-accent-soft text-accent" : "bg-brand-yellow/20 text-accent"}`}>{tool.status}</span>
              </div>
              <h3 className="text-xl font-semibold leading-snug tracking-tight text-accent">{tool.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted">{tool.description}</p>
              <p className="mb-6 mt-4 text-xs leading-5 text-muted">{tool.detail}</p>
              <a href={tool.href} className="mt-auto inline-flex min-h-11 items-center justify-between gap-3 border-t border-rule pt-4 text-sm font-semibold text-accent transition hover:text-brand-purple">
                {tool.action}<StudioIcon name="arrow" size={17} />
              </a>
            </article>
          ))}
        </div>
      </section>

      <aside className="mt-8 flex items-start gap-3 rounded-2xl border border-rule bg-white/70 p-5 text-sm leading-6 text-muted">
        <span className="mt-0.5 shrink-0 text-accent"><StudioIcon name="info" size={19} /></span>
        <p><span className="font-semibold text-accent">Goed om te weten.</span> Demo / POC betekent: een concept om te laten zien en te testen, geen afgeronde klantimplementatie. Gebruik fictieve gegevens voor demo’s en controleer gegenereerde bestanden voordat je ze in AFAS importeert.</p>
      </aside>
    </div>
  );
}
