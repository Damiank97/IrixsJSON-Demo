"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ConnectorIndexItem } from "@/lib/data";

export function ConnectorBrowser({ connectors }: { connectors: ConnectorIndexItem[] }) {
  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  const groups = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of connectors) {
      counts.set(c.group, (counts.get(c.group) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  }, [connectors]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return connectors.filter((c) => {
      if (activeGroup && c.group !== activeGroup) return false;
      if (!q) return true;
      return (
        c.id.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.group.toLowerCase().includes(q)
      );
    });
  }, [connectors, query, activeGroup]);

  return (
    <div>
      {/* Zoekveld + groep-filter */}
      <div className="mb-10 flex flex-col gap-6">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Zoek connector — bv. KnPerson, FbSales, contractmutatie…"
            className="w-full bg-paper border-b-2 border-rule focus:border-accent outline-none py-4 pl-0 pr-12 text-xl font-display placeholder:text-muted/60 transition-colors"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-xs text-muted tabular-nums">
            {filtered.length}/{connectors.length}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <FilterPill
            label="Alle groepen"
            count={connectors.length}
            active={activeGroup === null}
            onClick={() => setActiveGroup(null)}
          />
          {groups.map((g) => (
            <FilterPill
              key={g.name}
              label={g.name}
              count={g.count}
              active={activeGroup === g.name}
              onClick={() => setActiveGroup(g.name === activeGroup ? null : g.name)}
            />
          ))}
        </div>
      </div>

      {/* Lijst */}
      {filtered.length === 0 ? (
        <p className="text-muted text-center py-16 font-display italic text-2xl">
          Niets gevonden voor "{query}".
        </p>
      ) : (
        <ul className="divide-y divide-rule border-t border-rule">
          {filtered.map((c) => (
            <li key={c.id}>
              <Link
                href={`/connector/${c.id}`}
                className="group block py-5 transition-colors hover:bg-paper -mx-4 px-4"
              >
                <div className="grid grid-cols-12 gap-6 items-baseline">
                  <div className="col-span-12 md:col-span-4">
                    <h3 className="font-mono text-base text-ink group-hover:text-accent transition-colors">
                      {c.id}
                    </h3>
                  </div>
                  <div className="col-span-12 md:col-span-5 text-sm text-muted leading-relaxed">
                    {c.description || (
                      <span className="italic">Geen omschrijving in spec</span>
                    )}
                  </div>
                  <div className="col-span-6 md:col-span-2 flex gap-1.5">
                    {c.methods.map((m) => (
                      <MethodBadge key={m} method={m} />
                    ))}
                  </div>
                  <div className="col-span-6 md:col-span-1 text-right text-xs font-mono tabular-nums text-muted">
                    {c.example_count > 0 ? `${c.example_count}×` : "—"}
                  </div>
                </div>
                <div className="mt-1 text-xs uppercase tracking-[0.15em] text-muted/70 font-sans">
                  {c.group}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1.5 border transition-colors ${
        active
          ? "border-accent bg-accent text-canvas"
          : "border-rule text-muted hover:border-accent hover:text-accent"
      }`}
    >
      <span>{label}</span>
      <span className={`ml-2 font-mono tabular-nums ${active ? "opacity-70" : "opacity-50"}`}>
        {count}
      </span>
    </button>
  );
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    POST: "text-method-post border-method-post/30",
    PUT: "text-method-put border-method-put/30",
    DELETE: "text-method-delete border-method-delete/30",
  };
  return (
    <span
      className={`text-[10px] font-mono px-1.5 py-0.5 border tabular-nums tracking-wider ${
        colors[method] ?? "text-muted border-rule"
      }`}
    >
      {method}
    </span>
  );
}
