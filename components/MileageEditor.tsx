"use client";

import { useEffect, useRef, useState } from "react";
import { MILEAGE_VERSION, mileageTotal } from "@/lib/mileageRules";

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
  kilometerDecimals?:number;
  calculationVersion?:number;
  candidateCount?:number;
  afasReferenceKilometers?:number;
};

export function MileageEditor({ value, onChange, onBusyChange,decimals }: { value: MileageValues; onChange: (changes: Partial<MileageValues>) => void; onBusyChange: (busy: boolean) => void;decimals?:number }) {
  const [available, setAvailable] = useState({ google: false, tomtom: false });
  const [provider, setProvider] = useState("");
  const [preference, setPreference] = useState(value.routePreference??"shortest");
  const precision=decimals??3;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    fetch("/api/distance").then(async (response) => {
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (active.current) {
        setAvailable(data);
        setProvider(value.distanceSource === "demo" ? "demo" : value.distanceSource === "google" && data.google ? "google" : value.distanceSource === "tomtom" && data.tomtom ? "tomtom" : data.tomtom ? "tomtom" : data.google ? "google" : "");
      }
    }).catch(() => { if (active.current) setError("Afstandsbronnen konden niet worden geladen. Handmatig invullen blijft mogelijk."); });
    return () => { active.current = false; onBusyChange(false); };
  }, [onBusyChange]);

  function invalidate(changes: Partial<MileageValues>) {
    onChange({ ...changes, kilometers: 0, outboundKilometers: undefined, returnKilometers: undefined, distanceSource: undefined, distanceCalculatedAt: undefined, routePreference: undefined,calculationVersion:undefined,candidateCount:undefined,afasReferenceKilometers:undefined });
    setError("");
  }

  async function calculate() {
    setBusy(true); onBusyChange(true); setError("");
    try {
      const response = await fetch("/api/distance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, preference, from: value.from, to: value.to, roundTrip: Boolean(value.roundTrip),decimals:precision }) });
      const result = await response.json();
      if (!active.current) return;
      if (!response.ok) throw new Error(result.error || "Afstand berekenen mislukt.");
      onChange({ kilometers: result.kilometers, outboundKilometers: result.outboundKilometers, returnKilometers: result.returnKilometers, distanceSource: result.provider, distanceCalculatedAt: result.calculatedAt, routePreference: result.preference,kilometerDecimals:result.kilometerDecimals,calculationVersion:result.calculationVersion,candidateCount:result.candidateCount,afasReferenceKilometers:undefined });
    } catch (failure) { if (active.current) setError(failure instanceof Error ? failure.message : "Afstand berekenen mislukt."); }
    finally { if (active.current) { setBusy(false); onBusyChange(false); } }
  }

  return (
    <fieldset disabled={busy} className="md:col-span-2 lg:col-span-4 rounded-xl border border-rule bg-white p-4 md:p-5">
      <legend className="px-2 text-sm font-semibold">Rit en afstand</legend>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MileageField label="Van · volledig adres"><input maxLength={255} value={value.from} onChange={(e) => invalidate({ from: e.target.value })} placeholder="Straat, huisnummer, plaats" /></MileageField>
        <MileageField label="Naar · volledig adres"><input maxLength={255} value={value.to} onChange={(e) => invalidate({ to: e.target.value })} placeholder="Straat, huisnummer, plaats" /></MileageField>
        <MileageField label="Afstandsbron · demo-instelling"><select value={provider} onChange={(e) => { setProvider(e.target.value); invalidate({}); }}>
          <option value="">Kies een bron</option>
          <option value="google" disabled={!available.google}>Google Routes{!available.google ? " · key nodig" : ""}</option>
          <option value="tomtom" disabled={!available.tomtom}>TomTom (ANWB){!available.tomtom ? " · key nodig" : ""}</option>
          <option value="demo">Demovoorbeeld · Enter ↔ Utrecht</option>
        </select></MileageField>
        <MileageField label="Voorkeur communicatieprofiel"><select value={preference} onChange={(e) => {setPreference(e.target.value);invalidate({});}}>
          <option value="shortest">Kortste aangeboden route</option>
          <option value="fastest">Snelste aangeboden route · zonder actuele filedrukte</option>
        </select></MileageField>
        <MileageField label="Kilometers · enkele reis"><input type="number" min="0" step={10**-precision} value={value.outboundKilometers ?? (value.kilometers ? value.kilometers / (value.roundTrip ? 2 : 1) : "")} onChange={(e) => {
          const km = Number(e.target.value);
          onChange({ outboundKilometers: km, returnKilometers: value.roundTrip ? km : 0, kilometers: Number.isFinite(km)&&km>=0?mileageTotal(km,!!value.roundTrip,precision):0, distanceSource: "handmatig", distanceCalculatedAt: undefined, routePreference: undefined,kilometerDecimals:precision,calculationVersion:MILEAGE_VERSION,candidateCount:undefined,afasReferenceKilometers:undefined });
        }} /></MileageField>
        <label className="flex items-center gap-2 self-end py-3 text-sm font-medium"><input type="checkbox" checked={Boolean(value.roundTrip)} onChange={(e) => {const single=value.outboundKilometers??value.kilometers/(value.roundTrip?2:1);onChange({roundTrip:e.target.checked,outboundKilometers:single,returnKilometers:e.target.checked?single:0,kilometers:mileageTotal(single,e.target.checked,precision),kilometerDecimals:precision,afasReferenceKilometers:undefined});}} /> Retour · enkele reis × 2</label>
        <div className="self-end py-3 text-sm"><span className="text-muted">Totaal te declareren</span><strong className="ml-2">{value.kilometers.toLocaleString("nl-NL",{maximumFractionDigits:precision})} km</strong></div>
        <button type="button" onClick={() => void calculate()} disabled={!provider || !value.from.trim() || !value.to.trim() || busy} className="tool-button-secondary self-end">{busy ? "Berekenen…" : "Afstand berekenen"}</button>
      </div>
      {provider === "demo" && <p className="mt-3 text-xs text-muted">Fictieve kandidaten voor Enter ↔ Utrecht: kortste 126 km, snelste 138 km. Geen echte route-uitkomst. <button type="button" className="font-semibold underline" onClick={() => invalidate({ from: "Enter", to: "Utrecht" })}>Voorbeeldadressen invullen</button></p>}
      {value.distanceSource && <p className="mt-3 text-xs text-muted" role="status">Bron: {value.distanceSource === "demo" ? "demovoorbeeld · geen echte routeberekening" : value.distanceSource === "google" ? `Powered by Google, ©${new Date().getFullYear()} Google` : value.distanceSource === "tomtom" ? "TomTom" : value.distanceSource}{value.candidateCount?` · ${value.candidateCount} routekandidaat/kandidaten`:""}{value.roundTrip?" · retour is enkele reis × 2, niet een apart berekende terugrit":""}. Controleer of de rit klopt.</p>}
      <p className="mt-3 text-[11px] leading-relaxed text-muted">AFAS-werkwijze: routekeuze zonder actuele verkeersdrukte, retour verdubbelen. Afronding: {precision} decimalen {decimals===undefined?"(meterprecisie; kostensoort-instelling nog niet aangeleverd)":"uit de geselecteerde kostensoort / demo-inrichting"}. De werkgever kiest de provider en routevoorkeur; deze selectors demonstreren die instellingen.</p>
      <details className="mt-3 rounded-xl border border-rule p-3 text-xs"><summary className="cursor-pointer font-semibold text-accent">Uitkomst vergelijken met AFAS</summary><p className="mt-2 leading-5 text-muted">De gedocumenteerde werkwijze is overgenomen, maar er is geen universele AFAS-standaard voor provider en afronding. Vergelijk dezelfde adressen, routevoorkeur, kostensoort en retourinstelling; Google garandeert geen identieke routes tussen losse aanvragen.</p><label className="mt-3 block">Totaal aantal kilometers uit AFAS<input type="number" min="0" step={10**-precision} aria-label="AFAS referentiekilometers" className="mt-1 w-full rounded-lg border border-rule bg-white p-2" value={value.afasReferenceKilometers??""} onChange={e=>onChange({afasReferenceKilometers:e.target.value===""?undefined:Number(e.target.value)})}/></label><p role="status" className={`mt-2 font-semibold ${value.afasReferenceKilometers===undefined?"text-muted":Math.abs(value.afasReferenceKilometers-value.kilometers)<0.0000001?"text-success":"text-danger"}`}>{value.afasReferenceKilometers===undefined?"Nog niet met een AFAS-uitkomst vergeleken.":Math.abs(value.afasReferenceKilometers-value.kilometers)<0.0000001?"Deze uitkomst komt overeen met de ingevoerde AFAS-referentie.":"Afwijking: deze regel mag niet worden ingediend. Controleer de instellingen."}</p></details>
      {error && <p role="alert" className="mt-3 text-xs text-danger">{error}</p>}
      <p className="mt-3 text-[11px] leading-relaxed text-muted">Google en TomTom ontvangen bij berekenen de ingevulde adressen. De organisatie bepaalt de routekeuze en vergoeding; dit is een afstandsvoorstel. Eigen API-key nodig voor echte berekeningen.</p>
    </fieldset>
  );
}

function MileageField({ label, children }: { label: string; children: React.ReactElement<{ className?: string }> }) {
  return <label className="block"><span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.1em] text-muted">{label}</span><children.type {...children.props} className="w-full rounded-xl border border-rule bg-white px-3 py-3 text-sm text-accent outline-none focus:ring-2 focus:ring-brand-purple/15 disabled:opacity-50" /></label>;
}
