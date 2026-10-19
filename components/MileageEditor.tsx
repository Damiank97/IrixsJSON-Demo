"use client";

import { useEffect, useRef, useState } from "react";

export type MileageValues = {
  from: string;
  to: string;
  kilometers: number;
  roundTrip?: boolean;
  outboundKilometers?: number;
  returnKilometers?: number;
  distanceSource?: string;
  distanceCalculatedAt?: string;
  routePreference?: string;
};

export function MileageEditor({ value, onChange, onBusyChange }: { value: MileageValues; onChange: (changes: Partial<MileageValues>) => void; onBusyChange: (busy: boolean) => void }) {
  const [available, setAvailable] = useState({ google: false, tomtom: false });
  const [provider, setProvider] = useState("");
  const [preference, setPreference] = useState("fastest");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    fetch("/api/distance").then(async (response) => {
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (active.current) { setAvailable(data); setProvider(data.tomtom ? "tomtom" : data.google ? "google" : ""); }
    }).catch(() => { if (active.current) setError("Afstandsbronnen konden niet worden geladen. Handmatig invullen blijft mogelijk."); });
    return () => { active.current = false; onBusyChange(false); };
  }, [onBusyChange]);

  function invalidate(changes: Partial<MileageValues>) {
    onChange({ ...changes, kilometers: 0, outboundKilometers: undefined, returnKilometers: undefined, distanceSource: undefined, distanceCalculatedAt: undefined, routePreference: undefined });
    setError("");
  }

  async function calculate() {
    setBusy(true); onBusyChange(true); setError("");
    try {
      const response = await fetch("/api/distance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, preference, from: value.from, to: value.to, roundTrip: Boolean(value.roundTrip) }) });
      const result = await response.json();
      if (!active.current) return;
      if (!response.ok) throw new Error(result.error || "Afstand berekenen mislukt.");
      onChange({ kilometers: result.kilometers, outboundKilometers: result.outboundKilometers, returnKilometers: result.returnKilometers, distanceSource: result.provider, distanceCalculatedAt: result.calculatedAt, routePreference: result.preference });
    } catch (failure) { if (active.current) setError(failure instanceof Error ? failure.message : "Afstand berekenen mislukt."); }
    finally { if (active.current) { setBusy(false); onBusyChange(false); } }
  }

  return (
    <fieldset disabled={busy} className="md:col-span-2 lg:col-span-4 rounded-xl border border-rule bg-white p-4 md:p-5">
      <legend className="px-2 text-sm font-semibold">Rit en afstand</legend>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MileageField label="Van · volledig adres"><input maxLength={255} value={value.from} onChange={(e) => invalidate({ from: e.target.value })} placeholder="Straat, huisnummer, plaats" /></MileageField>
        <MileageField label="Naar · volledig adres"><input maxLength={255} value={value.to} onChange={(e) => invalidate({ to: e.target.value })} placeholder="Straat, huisnummer, plaats" /></MileageField>
        <MileageField label="Afstandsbron"><select value={provider} onChange={(e) => { setProvider(e.target.value); setPreference("fastest"); }}>
          <option value="">Kies een bron</option>
          <option value="google" disabled={!available.google}>Google Routes{!available.google ? " · key nodig" : ""}</option>
          <option value="tomtom" disabled={!available.tomtom}>TomTom (ANWB){!available.tomtom ? " · key nodig" : ""}</option>
          <option value="demo">Demovoorbeeld · Enter ↔ Utrecht</option>
        </select></MileageField>
        <MileageField label="Routekeuze"><select value={preference} onChange={(e) => setPreference(e.target.value)} disabled={provider !== "tomtom"}>
          <option value="fastest">{provider === "google" ? "Aanbevolen autoroute" : "Snelste route"}</option>
          {provider === "tomtom" && <option value="shortest">Kortste route</option>}
        </select></MileageField>
        <MileageField label="Kilometers · enkele reis"><input type="number" min="0" step="0.01" value={value.outboundKilometers ?? (value.kilometers ? value.kilometers / (value.roundTrip ? 2 : 1) : "")} onChange={(e) => {
          const km = Number(e.target.value);
          onChange({ outboundKilometers: km, returnKilometers: value.roundTrip ? km : 0, kilometers: Math.round(km * (value.roundTrip ? 2 : 1) * 100) / 100, distanceSource: "handmatig", distanceCalculatedAt: undefined, routePreference: undefined });
        }} /></MileageField>
        <label className="flex items-center gap-2 self-end py-3 text-sm font-medium"><input type="checkbox" checked={Boolean(value.roundTrip)} onChange={(e) => invalidate({ roundTrip: e.target.checked })} /> Retour</label>
        <div className="self-end py-3 text-sm"><span className="text-muted">Totaal te declareren</span><strong className="ml-2">{value.kilometers.toLocaleString("nl-NL")} km</strong></div>
        <button type="button" onClick={() => void calculate()} disabled={!provider || !value.from.trim() || !value.to.trim() || busy} className="tool-button-secondary self-end">{busy ? "Berekenen…" : "Afstand berekenen"}</button>
      </div>
      {provider === "demo" && <p className="mt-3 text-xs text-muted">Vast fictief voorbeeld: Enter → Utrecht is 126 km enkele reis. <button type="button" className="font-semibold underline" onClick={() => invalidate({ from: "Enter", to: "Utrecht" })}>Voorbeeldadressen invullen</button></p>}
      {value.distanceSource && <p className="mt-3 text-xs text-muted" role="status">Bron: {value.distanceSource === "demo" ? "demovoorbeeld · geen echte routeberekening" : value.distanceSource === "google" ? `Powered by Google, ©${new Date().getFullYear()} Google` : value.distanceSource === "tomtom" ? "TomTom" : value.distanceSource}{value.roundTrip && value.returnKilometers !== undefined ? ` · heen ${value.outboundKilometers} km / terug ${value.returnKilometers} km` : ""}. Controleer of de rit klopt.</p>}
      {error && <p role="alert" className="mt-3 text-xs text-danger">{error}</p>}
      <p className="mt-3 text-[11px] leading-relaxed text-muted">Google en TomTom ontvangen bij berekenen de ingevulde adressen. De organisatie bepaalt de routekeuze en vergoeding; dit is een afstandsvoorstel. Eigen API-key nodig voor echte berekeningen.</p>
    </fieldset>
  );
}

function MileageField({ label, children }: { label: string; children: React.ReactElement<{ className?: string }> }) {
  return <label className="block"><span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.1em] text-muted">{label}</span><children.type {...children.props} className="w-full rounded-xl border border-rule bg-white px-3 py-3 text-sm text-accent outline-none focus:ring-2 focus:ring-brand-purple/15 disabled:opacity-50" /></label>;
}
