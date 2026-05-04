import { loadIndex } from "@/lib/data";
import { ConnectorBrowser } from "@/components/ConnectorBrowser";

export default async function Home() {
  const connectors = await loadIndex();

  // Statistieken voor de hero
  const totalSchemas = connectors.reduce((s, c) => s + c.schema_count, 0);
  const totalExamples = connectors.reduce((s, c) => s + c.example_count, 0);
  const totalGroups = new Set(connectors.map((c) => c.group)).size;

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-rule">
        <div className="max-w-6xl mx-auto px-8 py-6 flex items-baseline justify-between">
          <div className="flex items-baseline gap-3">
            <span className="font-display text-2xl tracking-tightest text-accent">Irixs</span>
            <span className="text-muted text-xs uppercase tracking-[0.2em]">Schemabank</span>
          </div>
          <span className="text-xs text-muted font-mono">
            v0.1 · proof of concept
          </span>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-rule">
        <div className="max-w-6xl mx-auto px-8 py-20 grid grid-cols-1 md:grid-cols-12 gap-12 items-end">
          <div className="md:col-span-8">
            <p className="text-xs uppercase tracking-[0.25em] text-muted mb-6">
              AFAS UpdateConnectors — voorbeeld-JSON op aanvraag
            </p>
            <h1 className="font-display text-6xl md:text-7xl leading-[0.95] tracking-tightest text-ink">
              Schema's en voorbeelden,
              <br />
              <em className="text-accent">zonder zoekwerk.</em>
            </h1>
            <p className="mt-8 max-w-xl text-base leading-relaxed text-muted">
              Eén plek waar consultants en developers de structuur van elke
              UpdateConnector vinden — inclusief werkende voorbeeld-payloads
              voor TO's, tests en koppelingen.
            </p>
          </div>

          <div className="md:col-span-4">
            <dl className="space-y-4 border-l border-rule pl-6">
              <Stat label="Connectors" value={connectors.length} />
              <Stat label="Schema's" value={totalSchemas} />
              <Stat label="Voorbeelden" value={totalExamples} />
              <Stat label="Groepen" value={totalGroups} />
            </dl>
          </div>
        </div>
      </section>

      {/* Browser */}
      <section className="max-w-6xl mx-auto px-8 py-16">
        <ConnectorBrowser connectors={connectors} />
      </section>

      {/* Footer */}
      <footer className="border-t border-rule mt-24">
        <div className="max-w-6xl mx-auto px-8 py-8 flex flex-wrap gap-4 justify-between text-xs text-muted">
          <span>
            Brondata: <a href="https://github.com/AFASSoftware/OASContent" className="underline hover:text-accent">AFAS OASContent</a>
          </span>
          <span className="font-mono">Irixs · interne demo</span>
        </div>
      </footer>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.2em] text-muted">{label}</dt>
      <dd className="font-display text-4xl text-ink mt-1 tabular-nums">{value}</dd>
    </div>
  );
}
