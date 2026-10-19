"use client";

import { useEffect, useState } from "react";
import type { ConnectorIndexItem } from "@/lib/data";
import { ConnectorBrowser } from "@/components/ConnectorBrowser";
import { PureConfigMigrationTool } from "@/components/PureConfigMigrationTool";
import { PureMigrationTool } from "@/components/PureMigrationTool";
import { DeclarationBatchPoc } from "@/components/DeclarationBatchPoc";
import { ToolboxLanding } from "@/components/ToolboxLanding";
import { toolFromHash, type ToolboxTool } from "@/lib/toolboxNavigation";

export function ToolboxHome({ connectors }: { connectors: ConnectorIndexItem[] }) {
  const [tool, setTool] = useState<ToolboxTool>("home");
  const [pureMenuOpen, setPureMenuOpen] = useState(false);
  const totalSchemas = connectors.reduce((sum, connector) => sum + connector.schema_count, 0);
  const totalExamples = connectors.reduce((sum, connector) => sum + connector.example_count, 0);

  useEffect(() => {
    const syncTool = () => {
      const next = toolFromHash(window.location.hash);
      setTool(next);
      setPureMenuOpen(false);
      if (next !== "home") window.scrollTo({ top: 0, behavior: "instant" });
    };
    syncTool();
    window.addEventListener("hashchange", syncTool);
    return () => window.removeEventListener("hashchange", syncTool);
  }, []);

  function selectTool(next: ToolboxTool) {
    setTool(next);
    setPureMenuOpen(false);
    window.location.hash = next === "home" ? "" : next;
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  return (
    <main className="min-h-screen">
      <header className="relative z-20 border-b border-white/10 bg-accent text-white shadow-[0_8px_30px_rgba(52,12,70,0.12)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <a href="/" aria-label="Irixs Toolbox home" className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-yellow font-mono text-sm font-bold text-accent shadow-[inset_0_0_0_1px_rgba(255,255,255,0.25)]">
              IX
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">Irixs Toolbox</p>
              <p className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.2em] text-white/70">By Damian · tools & demo’s</p>
            </div>
          </a>
          <nav className="flex max-w-full flex-wrap gap-1 overflow-visible rounded-2xl border border-white/10 bg-white/5 p-1" aria-label="Toolbox onderdelen">
            <Tab active={tool === "home"} onClick={() => selectTool("home")}>Home</Tab>
            <div
              className="relative"
              onMouseEnter={() => setPureMenuOpen(true)}
              onMouseLeave={() => setPureMenuOpen(false)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setPureMenuOpen(false);
              }}
            >
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={pureMenuOpen}
                onClick={() => setPureMenuOpen(true)}
                onKeyDown={(event) => { if (event.key === "Escape") setPureMenuOpen(false); }}
                className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
                  tool === "planning" || tool === "config"
                    ? "bg-brand-yellow text-accent shadow-sm"
                    : "text-white/75 hover:bg-white/10 hover:text-white"
                }`}
              >
                PURE
                <span aria-hidden="true" className={`text-[9px] transition-transform ${pureMenuOpen ? "rotate-180" : ""}`}>⌄</span>
              </button>
              {pureMenuOpen && (
                <div className="absolute left-0 top-full z-50 min-w-52 pt-2">
                  <div
                    role="menu"
                    aria-label="PURE tools"
                    className="overflow-hidden rounded-xl border border-rule bg-white p-1.5 text-accent shadow-[0_18px_45px_rgba(52,12,70,0.2)]"
                  >
                    <PureMenuItem
                      active={tool === "planning"}
                      onClick={() => {
                        selectTool("planning");
                        setPureMenuOpen(false);
                      }}
                    >
                      Planning 9 → 10
                    </PureMenuItem>
                    <PureMenuItem
                      active={tool === "config"}
                      onClick={() => {
                        selectTool("config");
                        setPureMenuOpen(false);
                      }}
                    >
                      Config 9 → 10
                    </PureMenuItem>
                  </div>
                </div>
              )}
            </div>
            <Tab active={tool === "declarations"} onClick={() => selectTool("declarations")}>Declaraties</Tab>
            <Tab active={tool === "schemas"} onClick={() => selectTool("schemas")}>JSON Schemabank</Tab>
            <a href="/studio" className="rounded-xl px-4 py-2.5 text-xs font-semibold text-white/80 hover:bg-white/10">Dashboard Studio ↗</a>
            <a href="/internal" className="rounded-xl px-4 py-2.5 text-xs font-semibold text-white/80 hover:bg-white/10">Knowledge & Data Engineer ↗</a>
          </nav>
        </div>
      </header>

      {tool === "home" && <ToolboxLanding connectorCount={connectors.length} />}

      {tool === "planning" && (
        <section className="mx-auto max-w-7xl px-5 py-10 md:px-8 md:py-12"><PureMigrationTool /></section>
      )}
      {tool === "config" && (
        <section className="mx-auto max-w-7xl px-5 py-10 md:px-8 md:py-12"><PureConfigMigrationTool /></section>
      )}
      {tool === "declarations" && (
        <section className="mx-auto max-w-7xl px-5 py-10 md:px-8 md:py-12"><DeclarationBatchPoc /></section>
      )}
      {tool === "schemas" && (
        <SchemaBank connectors={connectors} totalSchemas={totalSchemas} totalExamples={totalExamples} />
      )}

      <footer className="mt-16 border-t border-rule bg-white/65">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-7 text-xs text-muted md:px-8">
          <span>Irixs Toolbox · AFAS-hulpmiddelen voor intern gebruik en demo’s</span>
          <span className="rounded-full bg-accent-soft px-3 py-1.5 font-mono text-[10px] text-accent">By Damian</span>
        </div>
      </footer>
    </main>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
        active ? "bg-brand-yellow text-accent shadow-sm" : "text-white/65 hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function PureMenuItem({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`block w-full rounded-lg px-3 py-2.5 text-left text-xs font-semibold transition ${
        active ? "bg-brand-yellow/25 text-accent" : "text-muted hover:bg-accent-soft hover:text-accent"
      }`}
    >
      {children}
    </button>
  );
}

function SchemaBank({ connectors, totalSchemas, totalExamples }: {
  connectors: ConnectorIndexItem[];
  totalSchemas: number;
  totalExamples: number;
}) {
  return (
    <section className="mx-auto max-w-7xl space-y-10 px-5 py-10 md:px-8 md:py-12">
      <div className="tool-intro">
        <div>
          <p className="tool-kicker">AFAS UpdateConnectors</p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-[-0.035em] text-white md:text-5xl">JSON Schemabank</h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/80 md:text-base">Vind een connectorstructuur en pak direct een bruikbaar voorbeeld voor je koppeling of test.</p>
          <p className="mt-4 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-white/75">
            Rechtstreeks uit AFASSoftware/OASContent · versie {connectors[0]?.source_version ?? "actueel"}
          </p>
        </div>
        <dl className="relative z-10 mt-7 grid grid-cols-3 gap-2 md:mt-0">
          <Stat label="Connectors" value={connectors.length} />
          <Stat label="Schema's" value={totalSchemas} />
          <Stat label="Voorbeelden" value={totalExamples} />
        </dl>
      </div>
      <div className="tool-card p-5 md:p-8">
        <ConnectorBrowser connectors={connectors} />
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-[88px] rounded-2xl border border-white/15 bg-white/10 px-3 py-3 text-center backdrop-blur">
      <dt className="text-[8px] font-medium uppercase tracking-[0.14em] text-white/70">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums text-white">{value}</dd>
    </div>
  );
}
