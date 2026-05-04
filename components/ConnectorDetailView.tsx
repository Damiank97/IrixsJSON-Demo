"use client";

import { useMemo, useState } from "react";
import type { ConnectorDetail } from "@/lib/data";

export function ConnectorDetailView({ detail }: { detail: ConnectorDetail }) {
  const { connector, schemas, examples } = detail;

  const tabs = useMemo(() => {
    const list: { key: string; label: string; type: "example" | "schema"; index: number }[] = [];
    examples.forEach((e, i) => {
      const method = e.method_hint ? ` (${e.method_hint})` : "";
      list.push({
        key: `ex-${i}`,
        label: prettifyName(e.name) + method,
        type: "example",
        index: i,
      });
    });
    schemas.forEach((s, i) => {
      list.push({
        key: `sch-${i}`,
        label: `Schema · ${s.method}`,
        type: "schema",
        index: i,
      });
    });
    return list;
  }, [examples, schemas]);

  const [activeTab, setActiveTab] = useState(tabs[0]?.key ?? "");

  const activeContent = useMemo(() => {
    const tab = tabs.find((t) => t.key === activeTab);
    if (!tab) return null;
    return tab.type === "example"
      ? examples[tab.index].payload
      : schemas[tab.index].schema;
  }, [activeTab, tabs, examples, schemas]);

  const activeIsExample =
    tabs.find((t) => t.key === activeTab)?.type === "example";

  return (
    <>
      {/* Hero */}
      <section className="border-b border-rule">
        <div className="max-w-6xl mx-auto px-8 py-16 grid grid-cols-1 md:grid-cols-12 gap-12">
          <div className="md:col-span-8">
            <p className="text-xs uppercase tracking-[0.25em] text-muted mb-4">
              {connector.group}
            </p>
            <h1 className="font-mono text-5xl text-ink mb-6 tracking-tight">
              {connector.id}
            </h1>
            <p className="font-display text-2xl italic text-ink/80 leading-snug max-w-2xl">
              {connector.description || (
                <span className="text-muted">Geen omschrijving beschikbaar.</span>
              )}
            </p>
          </div>

          <div className="md:col-span-4 space-y-6 border-l border-rule pl-6">
            <Field label="Methodes">
              <div className="flex gap-2 mt-1">
                {connector.methods.map((m) => (
                  <span key={m} className="font-mono text-xs px-2 py-1 border border-rule text-ink">
                    {m}
                  </span>
                ))}
              </div>
            </Field>
            <Field label="Schema's">{schemas.length}</Field>
            <Field label="Voorbeelden">{examples.length}</Field>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="max-w-6xl mx-auto px-8 py-12">
        {tabs.length === 0 ? (
          <p className="text-muted font-display italic text-xl py-16 text-center">
            Geen schema's of voorbeelden voor deze connector.
          </p>
        ) : (
          <div className="grid grid-cols-12 gap-8">
            {/* Tab navigation */}
            <nav className="col-span-12 md:col-span-3">
              <p className="text-xs uppercase tracking-[0.2em] text-muted mb-4">
                {examples.length > 0 ? "Voorbeelden" : "Schema's"}
              </p>
              <ul className="space-y-1">
                {tabs.map((t) => (
                  <li key={t.key}>
                    <button
                      onClick={() => setActiveTab(t.key)}
                      className={`w-full text-left px-3 py-2 text-sm border-l-2 transition-all ${
                        activeTab === t.key
                          ? "border-accent text-ink bg-accent/[0.04]"
                          : "border-rule text-muted hover:text-ink hover:border-accent/40"
                      }`}
                    >
                      <span className={t.type === "schema" ? "font-mono text-xs" : ""}>
                        {t.label}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Content viewer */}
            <div className="col-span-12 md:col-span-9">
              {activeContent ? (
                <JsonViewer
                  data={activeContent}
                  label={activeIsExample ? "Voorbeeld-payload" : "JSON Schema"}
                />
              ) : null}
            </div>
          </div>
        )}
      </section>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.2em] text-muted mb-1">{label}</dt>
      <dd className="font-display text-3xl text-ink tabular-nums">{children}</dd>
    </div>
  );
}

function JsonViewer({ data, label }: { data: unknown; label: string }) {
  const [copied, setCopied] = useState(false);
  const json = useMemo(() => JSON.stringify(data, null, 2), [data]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <div className="border border-rule bg-paper">
      <div className="flex justify-between items-center px-4 py-3 border-b border-rule">
        <span className="text-xs uppercase tracking-[0.2em] text-muted">{label}</span>
        <button
          onClick={copy}
          className="text-xs font-mono px-3 py-1.5 border border-rule text-ink hover:bg-accent hover:text-canvas hover:border-accent transition-colors"
        >
          {copied ? "✓ Gekopieerd" : "Kopieer JSON"}
        </button>
      </div>
      <pre className="json-viewer text-xs leading-relaxed p-6 overflow-auto max-h-[70vh] font-mono text-ink">
        {json}
      </pre>
    </div>
  );
}

function prettifyName(name: string): string {
  return name.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
