"use client";

import { useMemo, useState } from "react";
import {
  migratePure9ToPure10,
  PURE10_COLUMNS,
  readTable,
  type MigrationResult,
  type ParsedTable,
} from "@/lib/pureMigration";

const EMPTY_RESULT: MigrationResult | null = null;

export function PureMigrationTool() {
  const [source, setSource] = useState<ParsedTable | null>(null);
  const [lookup, setLookup] = useState<ParsedTable | null>(null);
  const [sourceError, setSourceError] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [result, setResult] = useState<MigrationResult | null>(EMPTY_RESULT);
  const [busy, setBusy] = useState(false);
  const [includeImportDefinition, setIncludeImportDefinition] = useState(false);

  const canConvert = Boolean(source && lookup && !busy);
  const status = useMemo(() => {
    if (result?.csv) return "Klaar voor import in PURE 10";
    if (result?.errors.length) return "Controle vereist";
    return "Nog niet geconverteerd";
  }, [result]);

  async function selectFile(file: File | undefined, kind: "source" | "lookup") {
    if (!file) return;
    setResult(null);
    if (kind === "source") setSourceError(""); else setLookupError("");
    try {
      const parsed = await readTable(file);
      if (kind === "source") setSource(parsed); else setLookup(parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bestand kon niet worden gelezen.";
      if (kind === "source") { setSource(null); setSourceError(message); }
      else { setLookup(null); setLookupError(message); }
    }
  }

  function convert() {
    if (!source || !lookup) return;
    setBusy(true);
    window.setTimeout(() => {
      setResult(migratePure9ToPure10(source, lookup));
      setBusy(false);
    }, 30);
  }

  function download() {
    if (!result?.csv) return;
    const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "PURE9_naar_PURE10_COMPLEET.csv";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);

    if (includeImportDefinition) {
      window.setTimeout(() => {
        const definitionLink = document.createElement("a");
        definitionLink.href = "/downloads/Import%20PURE10.ipd";
        definitionLink.download = "Import PURE10.ipd";
        definitionLink.click();
      }, 250);
    }
  }

  return (
    <div className="space-y-10">
      <section className="tool-intro">
        <div>
        <p className="tool-kicker">PURE planning · versie 9 naar 10</p>
        <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-[-0.035em] text-white md:text-5xl">Planning migreren</h1>
        <p className="mt-4 max-w-2xl text-sm font-medium leading-relaxed text-white/80 md:text-base">
          Volg de drie stappen hieronder. De Toolbox koppelt iedere planningsregel aan de juiste werksoort-GUID
          en maakt daarna het importbestand voor PURE 10.
        </p>
        </div>
        <div className="tool-chip-grid" aria-label="Uitvoercontroles">
          <span>CSV met puntkomma</span><span>GUID-controle</span><span>22 vaste kolommen</span><span>Week en dag</span>
        </div>
      </section>

      <section className="tool-card p-6 md:p-8">
        <div className="grid gap-8 md:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="font-mono text-xs text-accent">01</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink">Bronbestanden voorbereiden</h2>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Maak in PURE 9 op het gebruikte vrije bestand een weergave aan met de naam <strong>PURE - Export</strong>.
              Selecteer vervolgens alle beschikbare velden één voor één van boven naar beneden.
            </p>
            <p className="mt-4 border-l-2 border-accent pl-4 text-sm leading-relaxed text-muted">
              Heeft een veld een uitklappijltje? Selecteer dan alleen het bovenliggende veld. Je hoeft het veld niet
              open te klappen en geen onderliggende velden toe te voegen.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Exporteer daarna de regels naar Excel of CSV. Importeer daarnaast de GetConnector voor de
              voorcalculatieregels en exporteer ook deze gegevens.
            </p>
          </div>
          <div className="divide-y divide-rule border-y border-rule">
            <DefinitionDownload
              href="/downloads/Voorcalculatieregels.gcn"
              title="Voorcalculatieregels.gcn"
              label="GetConnector voor de werksoort-GUID's"
            />
          </div>
        </div>
      </section>

      <div>
        <p className="font-mono text-xs text-accent">02</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink">Beide exports uploaden</h2>
      </div>
      <section className="grid gap-5 md:grid-cols-2">
        <FileCard
          number="02A"
          title="PURE 9 planning"
          hint="Export uit de weergave PURE - Export · .xlsx, .xls of .csv"
          table={source}
          error={sourceError}
          onFile={(file) => selectFile(file, "source")}
        />
        <FileCard
          number="02B"
          title="Voorcalculatieregels"
          hint="GetConnector-export · .xlsx, .xls of .csv"
          table={lookup}
          error={lookupError}
          onFile={(file) => selectFile(file, "lookup")}
        />
      </section>

      <section className="tool-status-bar">
        <div className="flex w-full flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-mono text-xs text-accent">03 · Converteren</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">{status}</p>
          </div>
          <button
            type="button"
            disabled={!canConvert}
            onClick={convert}
            className="tool-button-primary"
          >
            {busy ? "Controleren…" : "Controleer en converteer"}
          </button>
        </div>
      </section>

      {result && (
        <ResultPanel
          result={result}
          onDownload={download}
          includeImportDefinition={includeImportDefinition}
          onIncludeImportDefinition={setIncludeImportDefinition}
        />
      )}

      <details className="tool-card p-6 text-sm text-muted">
        <summary className="cursor-pointer font-semibold text-ink">Vaste uitvoer en controles bekijken</summary>
        <div className="mt-5 grid gap-8 md:grid-cols-2">
          <div>
            <p className="mb-3 font-semibold text-ink">De converter controleert</p>
            <ul className="space-y-2">
              <li>Alle verplichte bron- en GetConnector-velden</li>
              <li>Ontbrekende of dubbele GUID's</li>
              <li>Alleen werksoorten van type Wst</li>
              <li>Geldige uren, datums, perioden en Event-guid's</li>
            </ul>
          </div>
          <div>
            <p className="mb-3 font-semibold text-ink">Vaste PURE 10-volgorde</p>
            <p className="font-mono text-xs leading-relaxed">{PURE10_COLUMNS.join(" · ")}</p>
          </div>
        </div>
      </details>
    </div>
  );
}

function FileCard({ number, title, hint, table, error, onFile }: {
  number: string;
  title: string;
  hint: string;
  table: ParsedTable | null;
  error: string;
  onFile: (file: File | undefined) => void;
}) {
  return (
    <label className="tool-card group cursor-pointer p-6 transition hover:border-brand-yellow">
      <input type="file" accept=".xlsx,.xls,.csv,.tsv" className="sr-only" onChange={(event) => onFile(event.target.files?.[0])} />
      <div className="flex items-start justify-between gap-5">
        <div>
          <p className="font-mono text-xs text-accent">{number}</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink">{title}</h2>
          <p className="mt-2 text-xs text-muted">{hint}</p>
        </div>
        <span className="tool-button-secondary shrink-0">Kies bestand</span>
      </div>
      {table && (
        <div className="mt-7 border-t border-rule pt-4">
          <p className="break-all text-sm font-semibold text-ink">{table.fileName}</p>
          <p className="mt-1 font-mono text-xs text-muted">{table.rows.length.toLocaleString("nl-NL")} regels · {table.headers.length} velden</p>
        </div>
      )}
      {error && <p className="mt-5 border-l-2 border-method-delete pl-3 text-sm text-method-delete">{error}</p>}
    </label>
  );
}

function ResultPanel({ result, onDownload, includeImportDefinition, onIncludeImportDefinition }: {
  result: MigrationResult;
  onDownload: () => void;
  includeImportDefinition: boolean;
  onIncludeImportDefinition: (value: boolean) => void;
}) {
  if (result.errors.length) {
    return (
      <section className="rounded-2xl border border-method-delete/30 bg-danger-soft p-6">
        <h2 className="text-2xl font-semibold text-method-delete">Nog niet importeren</h2>
        <ul className="mt-4 space-y-2 text-sm text-method-delete">
          {result.errors.map((error, index) => <li key={`${index}-${error}`}>— {error}</li>)}
        </ul>
      </section>
    );
  }

  const stats = result.stats;
  return (
    <section className="space-y-7">
      <div className="rounded-2xl border border-method-post/25 bg-success-soft p-6 md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-method-post">Alle controles geslaagd</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink">{stats.convertedRows.toLocaleString("nl-NL")} regels klaar</h2>
            <p className="mt-2 text-sm text-muted">{stats.totalHours.toLocaleString("nl-NL", { maximumFractionDigits: 6 })} uur · 22 vaste kolommen · UTF-8 BOM · CRLF</p>
          </div>
          <div className="flex flex-col items-start gap-3 md:items-end">
            <button type="button" onClick={onDownload} className="tool-button-primary">
              Download PURE 10-CSV
            </button>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={includeImportDefinition}
                onChange={(event) => onIncludeImportDefinition(event.target.checked)}
                className="h-4 w-4 accent-[#2D5A3A]"
              />
              Importdefinitie ook downloaden
            </label>
            <a href="/downloads/Import%20PURE10.ipd" download className="text-xs text-muted underline hover:text-accent">
              Import PURE10.ipd los downloaden
            </a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-rule border border-rule md:grid-cols-6">
        <Metric label="GUID-matches" value={stats.matchedRows} />
        <Metric label="Weekregels" value={stats.weeklyRows} />
        <Metric label="Dagregels" value={stats.dailyRows} />
        <Metric label="Decimalen" value={stats.fractionalAmounts} />
        <Metric label="Starttijden" value={stats.startTimes} />
        <Metric label="Zonder medewerker" value={stats.blankEmployees} />
      </div>

      {result.warnings.length > 0 && (
        <div className="border-l-2 border-method-put pl-4 text-sm text-muted">
          {result.warnings.map((warning) => <p key={warning}>{warning}</p>)}
        </div>
      )}

      <div className="overflow-x-auto border-y border-rule">
        <table className="min-w-[1500px] w-full text-left text-xs">
          <thead><tr>{PURE10_COLUMNS.map((column) => <th key={column} className="whitespace-nowrap border-b border-rule px-3 py-3 font-semibold text-ink">{column}</th>)}</tr></thead>
          <tbody>{result.preview.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-rule/70 last:border-0">
              {row.map((value, columnIndex) => <td key={columnIndex} className="max-w-56 truncate whitespace-nowrap px-3 py-3 font-mono text-muted">{value || "—"}</td>)}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="bg-paper p-4"><p className="text-2xl font-semibold tabular-nums text-ink">{value.toLocaleString("nl-NL")}</p><p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</p></div>;
}

function DefinitionDownload({ href, title, label }: { href: string; title: string; label: string }) {
  return (
    <a href={href} download className="group flex items-center justify-between gap-5 py-5">
      <div><p className="font-mono text-sm text-ink group-hover:text-accent">{title}</p><p className="mt-1 text-xs text-muted">{label}</p></div>
      <span className="text-sm text-muted group-hover:text-accent">Download ↓</span>
    </a>
  );
}
