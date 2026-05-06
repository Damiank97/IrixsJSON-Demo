"use client";

import { useEffect, useMemo, useState } from "react";
import { generatePayload, parseCsv, findOptionalEntities } from "@/lib/generator";
import type { ConnectorSchema } from "@/lib/data";

type Props = {
  schemas: ConnectorSchema[];
};

export function GeneratorPanel({ schemas }: Props) {
  const postSchemas = schemas.filter((s) => s.method === "POST");
  const availableSchemas = postSchemas.length > 0 ? postSchemas : schemas;

  const [schemaIndex, setSchemaIndex] = useState(0);
  const [mode, setMode] = useState<"minimal" | "full">("minimal");
  const [count, setCount] = useState(1);
  const [overridesText, setOverridesText] = useState("");
  const [overridesError, setOverridesError] = useState<string | null>(null);
  const [csvData, setCsvData] = useState<Record<string, string>[] | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvFileName, setCsvFileName] = useState<string>("");
  const [optionalEntities, setOptionalEntities] = useState<Set<string>>(new Set());
  const [output, setOutput] = useState<unknown>(null);
  const [copied, setCopied] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiUsed, setAiUsed] = useState(false);

  const activeSchema = availableSchemas[schemaIndex];

  // Velden uit het actieve schema halen — voor de hint-lijst
  const requiredFields = useMemo(
    () => extractRequiredFields(activeSchema?.schema),
    [activeSchema]
  );

  // Optionele toggleable entities (FiPrjEntries, FiTransEntries, etc.)
  const availableOptionals = useMemo(
    () => (activeSchema ? findOptionalEntities(activeSchema.schema) : []),
    [activeSchema]
  );

  // Reset selecties als de gebruiker van schema switcht (POST → PUT)
  useEffect(() => {
    setOptionalEntities(new Set());
  }, [schemaIndex]);

  function toggleOptional(name: string) {
    setOptionalEntities((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  if (!activeSchema) {
    return (
      <div className="text-muted font-display italic text-xl py-16 text-center">
        Geen schema beschikbaar voor generatie.
      </div>
    );
  }

  function handleCsvUpload(file: File) {
    setCsvError(null);
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result ?? "");
      try {
        const rows = parseCsv(text);
        if (rows.length === 0) {
          setCsvError("Geen rijen gevonden — heeft je CSV een headerregel?");
          setCsvData(null);
          return;
        }
        setCsvData(rows);
        setCount(rows.length);
      } catch (err) {
        setCsvError(err instanceof Error ? err.message : "Onbekende fout");
        setCsvData(null);
      }
    };
    reader.readAsText(file);
  }

  function clearCsv() {
    setCsvData(null);
    setCsvFileName("");
    setCsvError(null);
  }

  function handleGenerate() {
    setOverridesError(null);
    let overrides: Record<string, unknown> = {};
    if (overridesText.trim()) {
      try {
        const parsed = JSON.parse(overridesText);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          throw new Error("Geef een JSON-object met veldnamen als keys.");
        }
        overrides = parsed as Record<string, unknown>;
      } catch (err) {
        setOverridesError(err instanceof Error ? err.message : "Onbekende fout");
        return;
      }
    }

    const result = generatePayload(activeSchema.schema as object, {
      mode,
      count,
      overrides,
      seedRows: csvData ?? undefined,
      includeOptional: optionalEntities,
    });
    setOutput(result);
    setAiUsed(false);
    setAiError(null);
  }

  async function handleImproveWithAi() {
    if (output === null) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectorId: activeSchema.connector_id,
          method: activeSchema.method,
          schema: activeSchema.schema,
          currentPayload: output,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(data.error ?? `Fout (${res.status})`);
        return;
      }
      setOutput(data.improved);
      setAiUsed(true);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Onbekende fout");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleCopy() {
    if (output === null) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(output, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  function handleDownload() {
    if (output === null) return;
    const blob = new Blob([JSON.stringify(output, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeSchema.connector_id}-${count}x.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-8">
      {/* Schema kiezer (alleen relevant bij meerdere methodes) */}
      {availableSchemas.length > 1 && (
        <div>
          <label className="text-xs uppercase tracking-[0.2em] text-muted mb-2 block">
            Schema
          </label>
          <div className="flex gap-2">
            {availableSchemas.map((s, i) => (
              <button
                key={i}
                onClick={() => setSchemaIndex(i)}
                className={`text-xs font-mono px-3 py-1.5 border transition-colors ${
                  schemaIndex === i
                    ? "border-accent bg-accent text-canvas"
                    : "border-rule text-muted hover:border-accent hover:text-accent"
                }`}
              >
                {s.method}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mode + count */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <label className="text-xs uppercase tracking-[0.2em] text-muted mb-2 block">
            Velden
          </label>
          <div className="flex gap-2">
            <ToggleButton
              active={mode === "minimal"}
              onClick={() => setMode("minimal")}
            >
              Alleen verplicht
            </ToggleButton>
            <ToggleButton
              active={mode === "full"}
              onClick={() => setMode("full")}
            >
              Alle velden
            </ToggleButton>
          </div>
          <p className="text-xs text-muted mt-2 leading-relaxed">
            {mode === "minimal"
              ? `${requiredFields.length} verplichte velden + structurele containers`
              : "Alle velden uit het schema, ook optionele"}
          </p>
        </div>

        <div>
          <label className="text-xs uppercase tracking-[0.2em] text-muted mb-2 block">
            Aantal records
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={100}
              value={count}
              onChange={(e) =>
                setCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))
              }
              className="w-24 bg-paper border border-rule px-3 py-2 font-mono text-sm focus:border-accent outline-none"
            />
            <span className="text-xs text-muted">
              {count === 1
                ? "→ enkel object"
                : `→ array van ${count} payloads`}
            </span>
          </div>
        </div>
      </div>

      {/* Optionele entities */}
      {availableOptionals.length > 0 && (
        <div>
          <label className="text-xs uppercase tracking-[0.2em] text-muted mb-2 block">
            Optionele onderdelen{" "}
            <span className="text-muted/60 normal-case tracking-normal">
              ({optionalEntities.size}/{availableOptionals.length} geselecteerd)
            </span>
          </label>
          <p className="text-xs text-muted mb-3 leading-relaxed">
            Niet-verplichte nested entiteiten — vink aan welke onderdelen je in de payload wil opnemen.
          </p>
          <div className="flex flex-wrap gap-2">
            {availableOptionals.map((opt) => {
              const checked = optionalEntities.has(opt.name);
              return (
                <button
                  key={opt.name}
                  type="button"
                  onClick={() => toggleOptional(opt.name)}
                  title={opt.description || undefined}
                  className={`text-xs font-mono px-3 py-2 border transition-colors flex items-center gap-2 ${
                    checked
                      ? "border-accent bg-accent text-canvas"
                      : "border-rule text-muted hover:border-accent hover:text-accent"
                  }`}
                >
                  <span
                    className={`inline-block w-3 h-3 border ${
                      checked ? "bg-canvas border-canvas" : "border-rule"
                    } flex items-center justify-center`}
                  >
                    {checked && <span className="text-accent text-[9px] leading-none">✓</span>}
                  </span>
                  {opt.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Override velden */}
      <div>
        <label className="text-xs uppercase tracking-[0.2em] text-muted mb-2 block">
          Eigen waarden <span className="text-muted/60 normal-case tracking-normal">(optioneel)</span>
        </label>
        <textarea
          value={overridesText}
          onChange={(e) => setOverridesText(e.target.value)}
          placeholder={'{ "DbId": "DEB1234", "PrId": "PROJ-Q4" }'}
          rows={3}
          className="w-full bg-paper border border-rule px-3 py-2 font-mono text-xs focus:border-accent outline-none resize-y"
        />
        {overridesError && (
          <p className="text-xs text-method-delete mt-1">{overridesError}</p>
        )}
        {requiredFields.length > 0 && (
          <p className="text-xs text-muted mt-2">
            <span className="opacity-70">Verplichte velden:</span>{" "}
            {requiredFields.map((f, i) => (
              <span key={f}>
                {i > 0 && ", "}
                <button
                  onClick={() => insertOverrideKey(f, overridesText, setOverridesText)}
                  className="font-mono text-ink hover:text-accent transition-colors"
                  type="button"
                >
                  {f}
                </button>
              </span>
            ))}
          </p>
        )}
      </div>

      {/* CSV upload */}
      <div>
        <label className="text-xs uppercase tracking-[0.2em] text-muted mb-2 block">
          CSV met testdata <span className="text-muted/60 normal-case tracking-normal">(optioneel)</span>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-mono px-4 py-2 border border-rule cursor-pointer hover:border-accent hover:text-accent transition-colors">
            Bestand kiezen
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleCsvUpload(file);
              }}
            />
          </label>
          {csvFileName && (
            <span className="text-xs font-mono text-muted">
              {csvFileName}
              {csvData && <> — {csvData.length} rijen</>}
              <button
                onClick={clearCsv}
                className="ml-2 text-method-delete/70 hover:text-method-delete"
              >
                ✕
              </button>
            </span>
          )}
        </div>
        {csvError && <p className="text-xs text-method-delete mt-1">{csvError}</p>}
        <p className="text-xs text-muted mt-2 leading-relaxed">
          Header-namen moeten overeenkomen met AFAS-veldnamen (bv. <code className="font-mono">DbId,Nm,EmAd</code>).
          Aantal rijen overrulet "Aantal records".
        </p>
      </div>

      {/* Generate button */}
      <div className="pt-2">
        <button
          onClick={handleGenerate}
          className="text-sm font-mono px-6 py-3 bg-accent text-canvas border border-accent hover:bg-accent-ring hover:border-accent-ring transition-colors"
        >
          Genereer payload →
        </button>
      </div>

      {/* Output */}
      {output !== null && (
        <div className="border border-rule bg-paper">
          <div className="flex justify-between items-center px-4 py-3 border-b border-rule flex-wrap gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-muted flex items-center gap-3">
              Gegenereerd
              {aiUsed && (
                <span className="text-[10px] tracking-widest text-accent border border-accent/40 px-1.5 py-0.5">
                  ✦ AI verrijkt
                </span>
              )}
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleImproveWithAi}
                disabled={aiLoading}
                className="text-xs font-mono px-3 py-1.5 border border-accent/50 text-accent hover:bg-accent hover:text-canvas hover:border-accent transition-colors disabled:opacity-50 disabled:cursor-wait"
              >
                {aiLoading ? "Bezig…" : "✦ Verbeter met AI"}
              </button>
              <button
                onClick={handleCopy}
                className="text-xs font-mono px-3 py-1.5 border border-rule text-ink hover:bg-accent hover:text-canvas hover:border-accent transition-colors"
              >
                {copied ? "✓ Gekopieerd" : "Kopieer"}
              </button>
              <button
                onClick={handleDownload}
                className="text-xs font-mono px-3 py-1.5 border border-rule text-ink hover:bg-accent hover:text-canvas hover:border-accent transition-colors"
              >
                Download
              </button>
            </div>
          </div>
          {aiError && (
            <div className="px-4 py-2 border-b border-rule bg-method-delete/5 text-xs text-method-delete">
              {aiError}
            </div>
          )}
          <pre className="json-viewer text-xs leading-relaxed p-6 overflow-auto max-h-[60vh] font-mono text-ink">
            {JSON.stringify(output, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs font-mono px-4 py-2 border transition-colors ${
        active
          ? "border-accent bg-accent text-canvas"
          : "border-rule text-muted hover:border-accent hover:text-accent"
      }`}
    >
      {children}
    </button>
  );
}

function extractRequiredFields(schema: unknown): string[] {
  if (!schema || typeof schema !== "object") return [];
  const found = new Set<string>();
  walk(schema as Record<string, unknown>, found);
  return Array.from(found).sort();

  function walk(node: Record<string, unknown>, acc: Set<string>) {
    if (Array.isArray(node.required)) {
      // Filter structurele containers eruit (Element, Fields, Objects)
      for (const r of node.required as string[]) {
        if (r !== "Element" && r !== "Fields" && r !== "Objects") {
          acc.add(r);
        }
      }
    }
    for (const v of Object.values(node)) {
      if (v && typeof v === "object") {
        walk(v as Record<string, unknown>, acc);
      }
    }
  }
}

function insertOverrideKey(
  field: string,
  current: string,
  setter: (v: string) => void
) {
  if (current.includes(`"${field}"`)) return;
  let next = current.trim();
  if (!next) {
    next = `{\n  "${field}": ""\n}`;
  } else {
    // Voeg toe vóór de laatste sluithaak
    const idx = next.lastIndexOf("}");
    if (idx === -1) return;
    const before = next.slice(0, idx).trimEnd();
    const sep = before.endsWith("{") ? "" : ",";
    next = `${before}${sep}\n  "${field}": ""\n}`;
  }
  setter(next);
}
