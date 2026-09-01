"use client";

import { useMemo, useState } from "react";
import {
  migratePure9Config,
  readPure9Config,
  serializeConfigReport,
  serializePure10Config,
  type ConfigMigrationResult,
  type Pure9Config,
} from "@/lib/pureConfigMigration";

export function PureConfigMigrationTool() {
  const [prefix, setPrefix] = useState("");
  const [source, setSource] = useState<Pure9Config | null>(null);
  const [result, setResult] = useState<ConfigMigrationResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const status = useMemo(() => {
    if (result?.errors.length) return "Aanpassing nodig";
    if (result) return "Configuratie klaar voor controle";
    if (source) return "Bronbestand geladen";
    return "Nog niet geconverteerd";
  }, [result, source]);

  async function selectFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setResult(null);
    try {
      setSource(await readPure9Config(file));
    } catch (caught) {
      setSource(null);
      setError(caught instanceof Error ? caught.message : "Bestand kon niet worden gelezen.");
    }
  }

  function convert() {
    if (!source) return;
    setError("");
    setBusy(true);
    window.setTimeout(() => {
      try {
        setResult(migratePure9Config(source, prefix));
      } catch (caught) {
        setResult(null);
        setError(caught instanceof Error ? caught.message : "Configuratie kon niet worden gegenereerd.");
      } finally {
        setBusy(false);
      }
    }, 20);
  }

  function downloadConfig() {
    if (!source || !result || result.errors.length) return;
    downloadJson(`purex-config-${prefix.trim().replace(/:+$/, "")}.json`, serializePure10Config(result));
  }

  function downloadReport() {
    if (!source || !result) return;
    downloadJson(`purex-mappingrapport-${prefix.trim().replace(/:+$/, "")}.json`, serializeConfigReport(source, prefix, result));
  }

  return (
    <div className="space-y-10">
      <ToolIntro />

      <section className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr]">
        <div className="tool-card p-6 md:p-7">
          <StepLabel number="01" label="Klantprefix" />
          <label htmlFor="customer-prefix" className="mt-5 block text-sm font-semibold text-ink">
            Prefix in Azure App Configuration
          </label>
          <div className="mt-3 flex items-center rounded-xl border border-rule bg-white px-4 focus-within:border-brand-yellow focus-within:ring-4 focus-within:ring-brand-yellow/10">
            <input
              id="customer-prefix"
              value={prefix}
              onChange={(event) => {
                setPrefix(event.target.value);
                setResult(null);
                setError("");
              }}
              placeholder="bijv. irixs"
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent py-4 font-mono text-base text-ink outline-none placeholder:text-muted/50"
            />
            <span className="font-mono text-sm text-muted">:</span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted">De prefix wordt vóór iedere PURE 10-key geplaatst.</p>
        </div>

        <label className="tool-card group cursor-pointer p-6 transition hover:border-brand-yellow md:p-7">
          <input
            type="file"
            accept=".config,.xml,.txt,text/xml,application/xml"
            className="sr-only"
            onChange={(event) => selectFile(event.target.files?.[0])}
          />
          <div className="flex h-full flex-col justify-between gap-8 sm:flex-row sm:items-start">
            <div>
              <StepLabel number="02" label="PURE 9-config" />
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-ink">Upload het app.config-bestand</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">Het XML-bestand met de PURE 9 appSettings van de klant.</p>
            </div>
            <span className="tool-button-secondary shrink-0">Kies bestand</span>
          </div>
          {source && (
            <div className="mt-6 border-t border-rule pt-4">
              <p className="break-all text-sm font-semibold text-ink">{source.fileName}</p>
              <p className="mt-1 font-mono text-xs text-muted">{source.settings.length.toLocaleString("nl-NL")} bronkeys gevonden</p>
            </div>
          )}
        </label>
      </section>

      <section className="tool-status-bar">
        <div>
          <StepLabel number="03" label="Controleren en converteren" />
          <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">{status}</p>
        </div>
        <button
          type="button"
          disabled={!source || !prefix.trim() || busy}
          onClick={convert}
          className="tool-button-primary"
        >
          {busy ? "Converteren…" : "Maak PURE 10-config"}
        </button>
      </section>

      {error && <Message tone="error" title="Kan nog niet converteren" messages={[error]} />}
      {result && <ConfigResult source={source!} prefix={prefix} result={result} onDownload={downloadConfig} onReport={downloadReport} />}
    </div>
  );
}

function ToolIntro() {
  return (
    <section className="tool-intro">
      <div>
        <p className="tool-kicker">PURE configuratie · versie 9 naar 10</p>
        <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-[-0.035em] text-white md:text-5xl">Config migreren</h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/72 md:text-base">
          Bouw een complete KVSet-import uit het PURE 9 app.config-bestand. Klantwaarden worden overgenomen;
          ontbrekende PURE 10-structuur wordt veilig aangevuld.
        </p>
      </div>
      <div className="tool-chip-grid" aria-label="Conversieregels">
        <span>HEX-kleuren</span><span>Rollen uit PURE 9</span><span>Geen maatwerkfilters</span><span>Custom flags uit</span>
      </div>
    </section>
  );
}

function ConfigResult({ source, prefix, result, onDownload, onReport }: {
  source: Pure9Config;
  prefix: string;
  result: ConfigMigrationResult;
  onDownload: () => void;
  onReport: () => void;
}) {
  if (result.errors.length) {
    return (
      <div className="space-y-5">
        <Message tone="error" title="Nog niet importeren" messages={result.errors} />
        {result.warnings.length > 0 && <Message tone="warning" title="Daarnaast controleren" messages={result.warnings} />}
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <section className="rounded-2xl border border-success/25 bg-success-soft p-6 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-success">Conversie geslaagd</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink">{result.stats.generatedKeys} PURE 10-keys klaar</h2>
            <p className="mt-2 text-sm text-muted">KVSet JSON · prefix {prefix.trim().replace(/:+$/, "")} · kleuren als #RRGGBB</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={onReport} className="tool-button-secondary">Mappingrapport</button>
            <button type="button" onClick={onDownload} className="tool-button-primary">Download configuratie</button>
          </div>
        </div>
      </section>

      {result.warnings.length > 0 && <Message tone="warning" title="Controleer vóór de definitieve import" messages={result.warnings} />}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Metric label="Bronkeys" value={result.stats.sourceKeys} />
        <Metric label="Doelkeys" value={result.stats.generatedKeys} />
        <Metric label="Gemapt" value={result.stats.mappedSourceKeys} />
        <Metric label="Standaard" value={result.stats.standardKeys} />
        <Metric label="Planningstypes" value={result.stats.planningTypes} />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <ReviewCard title="Weergave en gedrag" rows={[
          ["Project", result.highlights.projectTemplate],
          ["Medewerker", result.highlights.employeeTemplate],
          ["Budgetvalidatie", result.highlights.useBudgetValidation],
          ["Realisatie", result.highlights.useRealisation],
        ]} />
        <ReviewCard title="Autorisatiegroepen uit PURE 9" rows={[
          ["Kijker", result.highlights.viewerGroup || "(leeg)"],
          ["Projectleider", result.highlights.projectManagerGroup || "(leeg)"],
          ["Manager/Admin", result.highlights.adminGroup || "(leeg)"],
          ["Planner", result.highlights.plannerGroup || "(leeg)"],
        ]} />
      </section>

      <details className="tool-card overflow-hidden">
        <summary className="cursor-pointer list-none px-6 py-5 text-sm font-semibold text-ink">
          Gegenereerde keys bekijken <span className="ml-2 font-mono text-xs text-muted">{result.items.length}</span>
        </summary>
        <div className="max-h-[520px] overflow-auto border-t border-rule">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="sticky top-0 bg-accent-soft">
              <tr>
                <th className="px-4 py-3 font-semibold text-ink">Herkomst</th>
                <th className="px-4 py-3 font-semibold text-ink">PURE 10-key</th>
                <th className="px-4 py-3 font-semibold text-ink">Waarde</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {result.mappings.map((mapping) => (
                <tr key={mapping.targetKey} className="bg-white">
                  <td className="px-4 py-3"><OriginBadge origin={mapping.origin} /></td>
                  <td className="px-4 py-3 font-mono text-ink">{mapping.targetKey}</td>
                  <td className="max-w-md truncate px-4 py-3 font-mono text-muted" title={mapping.targetValue}>{mapping.targetValue || "(leeg)"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <p className="text-xs leading-relaxed text-muted">
        {result.stats.unmappedSourceKeys.toLocaleString("nl-NL")} PURE 9-keys zijn niet nodig voor deze PURE 10-config.
        Ze staan volledig in het mappingrapport van {source.fileName}.
      </p>
    </div>
  );
}

function Message({ tone, title, messages }: { tone: "error" | "warning"; title: string; messages: string[] }) {
  const styles = tone === "error"
    ? "border-danger/30 bg-danger-soft text-danger"
    : "border-brand-yellow/50 bg-brand-yellow/10 text-ink";
  return (
    <section className={`rounded-2xl border p-6 ${styles}`}>
      <h2 className="text-lg font-semibold">{title}</h2>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed">
        {messages.map((message) => <li key={message}>— {message}</li>)}
      </ul>
    </section>
  );
}

function ReviewCard({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <section className="tool-card p-6">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <dl className="mt-4 divide-y divide-rule">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[0.8fr_1.2fr] gap-4 py-3 text-sm">
            <dt className="text-muted">{label}</dt>
            <dd className="break-words font-mono text-xs text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="tool-card p-4">
      <p className="text-2xl font-semibold tabular-nums text-ink">{value.toLocaleString("nl-NL")}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
    </div>
  );
}

function OriginBadge({ origin }: { origin: ConfigMigrationResult["mappings"][number]["origin"] }) {
  const style = origin === "PURE 9"
    ? "bg-brand-blue/10 text-brand-blue"
    : origin === "Berekend" ? "bg-brand-yellow/20 text-ink" : "bg-accent-soft text-accent";
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold ${style}`}>{origin}</span>;
}

function StepLabel({ number, label }: { number: string; label: string }) {
  return <p className="font-mono text-xs font-medium uppercase tracking-[0.16em] text-accent"><span className="mr-2 text-brand-yellow-dark">{number}</span>{label}</p>;
}

function downloadJson(fileName: string, contents: string) {
  const blob = new Blob([contents], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
