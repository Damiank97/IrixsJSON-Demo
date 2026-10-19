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
    <div className="mx-auto max-w-7xl space-y-8 px-5 py-10 md:px-8 md:py-12">
      <section className="tool-intro !items-stretch">
          <div className="relative z-10 md:w-2/3">
            <p className="tool-kicker mb-4">
              {connector.group}
            </p>
            <h1 className="break-words font-mono text-4xl text-white mb-5 tracking-tight md:text-5xl">
              {connector.id}
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-white/80 mb-7">
              {connector.description || (
                <span className="text-white/60">Geen omschrijving beschikbaar.</span>
              )}
            </p>

            {/* LLM-export knop */}
            <button
              onClick={copyForLlm}
              className="tool-button-primary relative z-10 !px-5 !py-3 text-xs"
              title="Kopieert schema, omschrijving en een voorbeeld als markdown — plak in ChatGPT of Claude voor hulp"
            >
              {llmCopied ? "✓ Gekopieerd — plak in je LLM" : "📋 Kopieer als prompt voor ChatGPT / Claude"}
            </button>
          </div>

          <dl className="relative z-10 mt-8 grid grid-cols-3 gap-2 md:mt-0 md:w-1/3 md:self-end">
            <Field label="Methodes">
              <div className="mt-1 flex justify-center gap-1">
                {connector.methods.map((m) => (
                  <span key={m} className="font-mono text-xs text-white">
                    {m}
                  </span>
                ))}
              </div>
            </Field>
            <Field label="Schema's">{schemas.length}</Field>
            <Field label="Voorbeelden">{examples.length}</Field>
          </dl>
      </section>

      <section className="tool-card overflow-hidden">
        <div className="grid grid-cols-1 divide-y divide-rule text-xs leading-relaxed text-muted md:grid-cols-3 md:divide-x md:divide-y-0">
          <div>
            <div className="p-5"><span className="text-brand-yellow-dark font-mono mr-2">01</span><strong className="text-accent">Genereren</strong> — testdata met eigen waarden of CSV-upload</div>
          </div>
          <div>
            <div className="p-5"><span className="text-brand-yellow-dark font-mono mr-2">02</span><strong className="text-accent">Voorbeelden</strong> — officiële AFAS-payloads, kant-en-klaar</div>
          </div>
          <div>
            <div className="p-5"><span className="text-brand-yellow-dark font-mono mr-2">03</span><strong className="text-accent">Schema</strong> — veldtypes en verplichte velden</div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-12 gap-6">
          {/* Sidebar nav */}
          <nav className="tool-card col-span-12 h-fit p-5 md:col-span-3">
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

          <div className="tool-card col-span-12 p-5 md:col-span-9 md:p-7">
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
      </section>
    </div>
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
  const base = "w-full rounded-lg text-left px-3 py-2.5 text-sm transition-all";
  const styles = active
    ? "text-white bg-accent"
    : highlight
    ? "text-accent bg-brand-yellow/20 hover:bg-brand-yellow/30"
    : "text-muted hover:text-accent hover:bg-accent-soft";
  return (
    <button onClick={onClick} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-3 text-center backdrop-blur">
      <dt className="text-[8px] uppercase tracking-[0.16em] text-white/65 mb-1">{label}</dt>
      <dd className="text-xl font-semibold text-white tabular-nums">{children}</dd>
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
    <div className="overflow-hidden rounded-2xl border border-rule bg-paper">
      <div className="flex justify-between items-center px-4 py-3 border-b border-rule">
        <span className="text-xs uppercase tracking-[0.2em] text-muted">{label}</span>
        <button
          onClick={copy}
          className="rounded-full border border-accent/20 px-3 py-1.5 font-mono text-xs text-accent transition-colors hover:bg-accent hover:text-white"
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
