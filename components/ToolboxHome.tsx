"use client";

import { useState } from "react";
import type { ConnectorIndexItem } from "@/lib/data";
import { ConnectorBrowser } from "@/components/ConnectorBrowser";
import { PureMigrationTool } from "@/components/PureMigrationTool";

type Tool = "pure" | "schemas";

export function ToolboxHome({ connectors }: { connectors: ConnectorIndexItem[] }) {
  const [tool, setTool] = useState<Tool>("pure");
  const totalSchemas = connectors.reduce((sum, connector) => sum + connector.schema_count, 0);
  const totalExamples = connectors.reduce((sum, connector) => sum + connector.example_count, 0);

  return (
    <main className="min-h-screen">
      <header className="border-b border-rule bg-canvas/95">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-6 py-5 md:flex-row md:items-center md:justify-between md:px-8">
          <div className="flex items-baseline gap-3">
            <span className="font-display text-2xl tracking-tightest text-accent">Irixs Toolbox</span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted">By Damian</span>
          </div>
          <nav className="flex gap-1 border border-rule bg-paper p-1" aria-label="Toolbox onderdelen">
            <Tab active={tool === "pure"} onClick={() => setTool("pure")}>PURE 9 → 10</Tab>
            <Tab active={tool === "schemas"} onClick={() => setTool("schemas")}>JSON Schemabank</Tab>
          </nav>
        </div>
      </header>

      {tool === "pure" ? (
        <section className="mx-auto max-w-6xl px-6 py-14 md:px-8 md:py-20"><PureMigrationTool /></section>
      ) : (
        <SchemaBank connectors={connectors} totalSchemas={totalSchemas} totalExamples={totalExamples} />
      )}

      <footer className="mt-20 border-t border-rule">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-4 px-6 py-8 text-xs text-muted md:px-8">
          <span>Irixs Toolbox · AFAS hulpmiddelen voor consultants</span>
          <span className="font-mono">By Damian</span>
        </div>
      </footer>
    </main>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`px-4 py-2 text-xs font-semibold transition ${active ? "bg-accent text-canvas" : "text-muted hover:text-accent"}`}>{children}</button>;
}

function SchemaBank({ connectors, totalSchemas, totalExamples }: { connectors: ConnectorIndexItem[]; totalSchemas: number; totalExamples: number }) {
  return (
    <>
      <section className="border-b border-rule">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-end gap-12 px-6 py-16 md:grid-cols-12 md:px-8 md:py-20">
          <div className="md:col-span-8">
            <p className="mb-6 text-xs uppercase tracking-[0.25em] text-muted">AFAS UpdateConnectors</p>
            <h1 className="font-display text-6xl leading-[0.95] tracking-tightest text-ink md:text-7xl">Schema's en voorbeelden,<br /><em className="text-accent">zonder zoekwerk.</em></h1>
            <p className="mt-8 max-w-xl text-base leading-relaxed text-muted">Doorzoek connectorstructuren en gebruik direct werkende voorbeeld-payloads voor TO's, tests en koppelingen.</p>
          </div>
          <dl className="space-y-4 border-l border-rule pl-6 md:col-span-4">
            <Stat label="Connectors" value={connectors.length} />
            <Stat label="Schema's" value={totalSchemas} />
            <Stat label="Voorbeelden" value={totalExamples} />
          </dl>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 py-16 md:px-8"><ConnectorBrowser connectors={connectors} /></section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div><dt className="text-xs uppercase tracking-[0.2em] text-muted">{label}</dt><dd className="mt-1 font-display text-4xl tabular-nums text-ink">{value}</dd></div>;
}
