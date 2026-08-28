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
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-12">
      <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="mb-5 text-xs uppercase tracking-[0.25em] text-muted">PURE migratie · versie 9 naar 10</p>
          <h1 className="font-display text-5xl leading-[0.98] tracking-tightest text-ink md:text-7xl">
            Van twee exports naar één
            <br /><em className="text-accent">importklaar bestand.</em>
          </h1>
          <p className="mt-7 max-w-2xl text-base leading-relaxed text-muted">
            Koppel de PURE 9-planning aan de actuele voorcalculatieregels. De Toolbox controleert alle GUID's,
            bewaakt de vaste kolomvolgorde en maakt de bewezen PURE 10-import als puntkomma-CSV.
          </p>
        </div>
        <div className="self-end border-l border-rule pl-6">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Privacy</p>
          <p className="mt-2 font-display text-3xl text-ink">100% in je browser</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Geen AI, geen API en geen upload naar een server. De klantdata blijft op je eigen computer.
          </p>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <FileCard
          number="01"
          title="PURE 9 planning"
          hint="Vrije bestandswaarden 09 · .xlsx, .xls of .csv"
          table={source}
          error={sourceError}
          onFile={(file) => selectFile(file, "source")}
        />
        <FileCard
          number="02"
          title="Voorcalculatieregels"
          hint="GetConnector-export · .xlsx, .xls of .csv"
          table={lookup}
          error={lookupError}
          onFile={(file) => selectFile(file, "lookup")}
        />
      </section>

      <section className="border-y border-rule py-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Status</p>
            <p className="mt-1 font-display text-3xl text-ink">{status}</p>
          </div>
          <button
            type="button"
            disabled={!canConvert}
            onClick={convert}
            className="bg-accent px-7 py-4 text-sm font-semibold text-canvas transition hover:bg-accent-ring disabled:cursor-not-allowed disabled:opacity-35"
          >
            {busy ? "Controleren…" : "Controleer en converteer"}
          </button>
        </div>
      </section>

      {result && <ResultPanel result={result} onDownload={download} />}

      <section className="grid gap-8 border-t border-rule pt-10 md:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted">AFAS definities</p>
          <h2 className="mt-3 font-display text-4xl text-ink">Eerst installeren, daarna converteren.</h2>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Importeer de GetConnector in de bronomgeving en de importdefinitie in PURE 10. Daarna kun je dezelfde route bij iedere klant herhalen.
          </p>
        </div>
        <div className="divide-y divide-rule border-y border-rule">
          <DefinitionDownload href="/downloads/Voorcalculatieregels.gcn" title="Voorcalculatieregels.gcn" label="GetConnector" />
          <DefinitionDownload href="/downloads/Import%20PURE10.ipd" title="Import PURE10.ipd" label="Importdefinitie" />
        </div>
      </section>

      <details className="border-t border-rule pt-8 text-sm text-muted">
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
    <label className="group cursor-pointer border border-rule bg-paper p-6 transition hover:border-accent">
      <input type="file" accept=".xlsx,.xls,.csv,.tsv" className="sr-only" onChange={(event) => onFile(event.target.files?.[0])} />
      <div className="flex items-start justify-between gap-5">
        <div>
          <p className="font-mono text-xs text-accent">{number}</p>
          <h2 className="mt-3 font-display text-3xl text-ink">{title}</h2>
          <p className="mt-2 text-xs text-muted">{hint}</p>
        </div>
        <span className="border border-rule px-3 py-2 text-xs text-muted transition group-hover:border-accent group-hover:text-accent">Kies bestand</span>
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

function ResultPanel({ result, onDownload }: { result: MigrationResult; onDownload: () => void }) {
  if (result.errors.length) {
    return (
      <section className="border border-method-delete/30 bg-red-50 p-6">
        <h2 className="font-display text-3xl text-method-delete">Nog niet importeren</h2>
        <ul className="mt-4 space-y-2 text-sm text-method-delete">
          {result.errors.map((error, index) => <li key={`${index}-${error}`}>— {error}</li>)}
        </ul>
      </section>
    );
  }

  const stats = result.stats;
  return (
    <section className="space-y-7">
      <div className="border border-method-post/30 bg-green-50 p-6 md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-method-post">Alle controles geslaagd</p>
            <h2 className="mt-2 font-display text-4xl text-ink">{stats.convertedRows.toLocaleString("nl-NL")} regels klaar</h2>
            <p className="mt-2 text-sm text-muted">{stats.totalHours.toLocaleString("nl-NL", { maximumFractionDigits: 6 })} uur · 22 vaste kolommen · UTF-8 BOM · CRLF</p>
          </div>
          <button type="button" onClick={onDownload} className="bg-method-post px-7 py-4 text-sm font-semibold text-white transition hover:opacity-90">
            Download PURE 10-CSV
          </button>
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
  return <div className="bg-paper p-4"><p className="font-display text-3xl tabular-nums text-ink">{value.toLocaleString("nl-NL")}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-muted">{label}</p></div>;
}

function DefinitionDownload({ href, title, label }: { href: string; title: string; label: string }) {
  return (
    <a href={href} download className="group flex items-center justify-between gap-5 py-5">
      <div><p className="font-mono text-sm text-ink group-hover:text-accent">{title}</p><p className="mt-1 text-xs text-muted">{label}</p></div>
      <span className="text-sm text-muted group-hover:text-accent">Download ↓</span>
    </a>
  );
}
