"use client";

import { useMemo, useState } from "react";
import type { ConnectorDetail } from "@/lib/data";
import { buildLlmPrompt } from "@/lib/llmExport";
import { GeneratorPanel } from "./GeneratorPanel";

type View =
  | { kind: "generator" }
  | { kind: "example"; index: number }
  | { kind: "schema"; index: number };

export function ConnectorDetailView({ detail }: { detail: ConnectorDetail }) {
  const { connector, schemas, examples } = detail;
  const [llmCopied, setLlmCopied] = useState(false);

  const [view, setView] = useState<View>(() =>
    examples.length > 0 ? { kind: "example", index: 0 } : { kind: "generator" }
  );

  const activeContent = useMemo(() => {
    if (view.kind === "example") return examples[view.index]?.payload;
    if (view.kind === "schema") return schemas[view.index]?.schema;
    return null;
  }, [view, examples, schemas]);

  async function copyForLlm() {
    const prompt = buildLlmPrompt(detail);
    try {
      await navigator.clipboard.writeText(prompt);
      setLlmCopied(true);
      setTimeout(() => setLlmCopied(false), 2000);
    } catch {
      // ignore
    }
  }

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
            <p className="font-display text-2xl italic text-ink/80 leading-snug max-w-2xl mb-8">
              {connector.description || (
                <span className="text-muted">Geen omschrijving beschikbaar.</span>
              )}
            </p>

            {/* LLM-export knop */}
            <button
              onClick={copyForLlm}
              className="text-xs font-mono px-4 py-2.5 border border-accent text-accent hover:bg-accent hover:text-canvas transition-colors inline-flex items-center gap-2"
              title="Kopieert schema, omschrijving en een voorbeeld als markdown — plak in ChatGPT of Claude voor hulp"
            >
              {llmCopied ? "✓ Gekopieerd — plak in je LLM" : "📋 Kopieer als prompt voor ChatGPT / Claude"}
            </button>
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

      {/* Uitleg-strip — alleen als hier nog geen voorbeelden zijn, of als context */}
      <section className="bg-paper border-b border-rule">
        <div className="max-w-6xl mx-auto px-8 py-6 text-xs text-muted leading-relaxed grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <span className="text-accent font-mono mr-2">→</span>
            <strong className="text-ink font-normal">Genereren</strong> — random testdata met
            eigen waarden of CSV upload, optioneel verrijkt met AI
          </div>
          <div>
            <span className="text-accent font-mono mr-2">→</span>
            <strong className="text-ink font-normal">Voorbeelden</strong> — alle officiële
            voorbeeld-payloads van AFAS, kant-en-klaar
          </div>
          <div>
            <span className="text-accent font-mono mr-2">→</span>
            <strong className="text-ink font-normal">Schema</strong> — het volledige JSON-schema
            inclusief alle veld-types en verplichte velden
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="max-w-6xl mx-auto px-8 py-12">
        <div className="grid grid-cols-12 gap-8">
          {/* Sidebar nav */}
          <nav className="col-span-12 md:col-span-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted mb-3">
              Genereren
            </p>
            <ul className="space-y-1 mb-8">
              <li>
                <NavItem
                  active={view.kind === "generator"}
                  onClick={() => setView({ kind: "generator" })}
                  highlight
                >
                  Random testdata
                </NavItem>
              </li>
            </ul>

            {examples.length > 0 && (
              <>
                <p className="text-xs uppercase tracking-[0.2em] text-muted mb-3">
                  Voorbeelden
                </p>
                <ul className="space-y-1 mb-8">
                  {examples.map((ex, i) => {
                    const method = ex.method_hint ? ` (${ex.method_hint})` : "";
                    return (
                      <li key={i}>
                        <NavItem
                          active={view.kind === "example" && view.index === i}
                          onClick={() => setView({ kind: "example", index: i })}
                        >
                          {prettifyName(ex.name) + method}
                        </NavItem>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}

            {schemas.length > 0 && (
              <>
                <p className="text-xs uppercase tracking-[0.2em] text-muted mb-3">
                  Schema's
                </p>
                <ul className="space-y-1">
                  {schemas.map((s, i) => (
                    <li key={i}>
                      <NavItem
                        active={view.kind === "schema" && view.index === i}
                        onClick={() => setView({ kind: "schema", index: i })}
                      >
                        <span className="font-mono text-xs">Schema · {s.method}</span>
                      </NavItem>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </nav>

          <div className="col-span-12 md:col-span-9">
            {view.kind === "generator" ? (
              <GeneratorPanel schemas={schemas} />
            ) : activeContent !== undefined && activeContent !== null ? (
              <JsonViewer
                data={activeContent}
                label={view.kind === "example" ? "Voorbeeld-payload" : "JSON Schema"}
              />
            ) : (
              <p className="text-muted font-display italic text-xl py-16 text-center">
                Niets te tonen.
              </p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function NavItem({
  active,
  onClick,
  children,
  highlight = false,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  const base = "w-full text-left px-3 py-2 text-sm border-l-2 transition-all";
  const styles = active
    ? "border-accent text-ink bg-accent/[0.04]"
    : highlight
    ? "border-accent/50 text-ink hover:border-accent hover:bg-accent/[0.04]"
    : "border-rule text-muted hover:text-ink hover:border-accent/40";
  return (
    <button onClick={onClick} className={`${base} ${styles}`}>
      {children}
    </button>
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
