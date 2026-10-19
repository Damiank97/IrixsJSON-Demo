"use client";

import { useEffect, useMemo, useState } from "react";

type LineKind = "kilometers" | "kosten";

type DeclarationLine = {
  id: string;
  date: string;
  kind: LineKind;
  declarationType: string;
  description: string;
  project: string;
  amount: number;
  from: string;
  to: string;
  kilometers: number;
  receipt: string;
};

type Batch = {
  batchId: string;
  employeeId: string;
  employeeName: string;
  period: string;
  concept: boolean;
  submitted: boolean;
  savedAt: string;
  submittedAt: string;
  lines: DeclarationLine[];
};

type Preview = "flow" | "storage" | "posts";
type LookupOption = { code: string; label: string };
type ReceiptResult = { description: string; amount: number | null; date: string | null; merchant: string | null; confidence: "laag" | "middel" | "hoog" };

const STORAGE_KEY = "irixs-declaration-poc-v1";

const INITIAL_BATCH: Batch = {
  batchId: "DECL-2026-10-ALLARDJ",
  employeeId: "ALLARDJ",
  employeeName: "Allard Jansen",
  period: "2026-10",
  concept: true,
  submitted: false,
  savedAt: "",
  submittedAt: "",
  lines: [
    {
      id: "R001",
      date: "2026-10-06",
      kind: "kilometers",
      declarationType: "ZK",
      description: "Klantbezoek",
      project: "300000",
      amount: 0,
      from: "Enter",
      to: "Utrecht",
      kilometers: 126,
      receipt: "",
    },
    {
      id: "R002",
      date: "2026-10-06",
      kind: "kosten",
      declarationType: "K01",
      description: "Parkeerkosten klantbezoek",
      project: "300000",
      amount: 18.5,
      from: "",
      to: "",
      kilometers: 0,
      receipt: "parking-utrecht.pdf",
    },
    {
      id: "R003",
      date: "2026-10-14",
      kind: "kosten",
      declarationType: "K01",
      description: "Lunch onderweg",
      project: "300000",
      amount: 24.75,
      from: "",
      to: "",
      kilometers: 0,
      receipt: "bon-lunch.jpg",
    },
  ],
};

const EMPTY_LINE: Omit<DeclarationLine, "id"> = {
  date: "2026-10-19",
  kind: "kosten",
  declarationType: "K01",
  description: "",
  project: "300000",
  amount: 0,
  from: "",
  to: "",
  kilometers: 0,
  receipt: "",
};

export function DeclarationBatchPoc() {
  const [batch, setBatch] = useState<Batch>(INITIAL_BATCH);
  const [draft, setDraft] = useState(EMPTY_LINE);
  const [preview, setPreview] = useState<Preview>("flow");
  const [notice, setNotice] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [projects, setProjects] = useState<LookupOption[]>([]);
  const [declarationTypes, setDeclarationTypes] = useState<LookupOption[]>([]);
  const [lookupSource, setLookupSource] = useState<"laden" | "demo" | "afas">("laden");
  const [receiptReading, setReceiptReading] = useState(false);
  const [receiptResult, setReceiptResult] = useState<ReceiptResult | null>(null);
  const [receiptError, setReceiptError] = useState("");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setBatch(JSON.parse(stored) as Batch);
    } catch {
      // Een beschadigde demo-opslag mag de pagina niet blokkeren.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/afas/lookups?type=projects").then((response) => response.json()),
      fetch("/api/afas/lookups?type=declarationTypes").then((response) => response.json()),
    ]).then(([projectData, typeData]) => {
      if (!active) return;
      setProjects(projectData.options ?? []);
      setDeclarationTypes(typeData.options ?? []);
      setLookupSource(projectData.source === "afas" && typeData.source === "afas" ? "afas" : "demo");
    }).catch(() => {
      if (active) setLookupSource("demo");
    });
    return () => { active = false; };
  }, []);

  const totalAmount = useMemo(
    () => batch.lines.reduce((sum, line) => sum + (line.kind === "kosten" ? line.amount : 0), 0),
    [batch.lines],
  );
  const totalKilometers = useMemo(
    () => batch.lines.reduce((sum, line) => sum + (line.kind === "kilometers" ? line.kilometers : 0), 0),
    [batch.lines],
  );
  const storagePayload = useMemo(() => buildFreeFilePayload(batch), [batch]);
  const postPayloads = useMemo(() => batch.lines.map((line) => buildDeclarationPayload(batch, line)), [batch]);

  function persist(next: Batch) {
    setBatch(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function saveConcept() {
    const next = {
      ...batch,
      concept: true,
      submitted: false,
      savedAt: new Date().toISOString(),
      submittedAt: "",
    };
    persist(next);
    setNotice("Concept opgeslagen. In productie worden deze regels in het vrije bestand van AFAS bewaard.");
  }

  function submitBatch() {
    if (!batch.lines.length) return;
    const now = new Date().toISOString();
    const next = { ...batch, concept: false, submitted: true, savedAt: now, submittedAt: now };
    persist(next);
    setNotice(`${next.lines.length} declaraties zijn in één handeling ingediend.`);
  }

  function addLine() {
    if (!draft.description.trim() || !draft.date) {
      setNotice("Vul minimaal een datum en omschrijving in.");
      return;
    }
    const nextLine: DeclarationLine = {
      ...draft,
      id: `R${String(batch.lines.length + 1).padStart(3, "0")}`,
    };
    persist({ ...batch, concept: true, submitted: false, lines: [...batch.lines, nextLine] });
    setDraft({ ...EMPTY_LINE, date: draft.date });
    setReceiptResult(null);
    setReceiptError("");
    setNotice("Regel toegevoegd aan het maandconcept.");
  }

  async function readReceipt(file: File) {
    setDraft((current) => ({ ...current, receipt: file.name }));
    setReceiptResult(null);
    setReceiptError("");
    if (!file.type.startsWith("image/")) {
      setReceiptError("Automatisch uitlezen ondersteunt in deze POC JPG, PNG en WEBP. De PDF kan wel als bijlage mee.");
      return;
    }
    if (file.size > 3_000_000) {
      setReceiptError("De afbeelding is groter dan 3 MB. Kies voor de demo een kleinere foto.");
      return;
    }

    setReceiptReading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const response = await fetch("/api/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, dataUrl }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Bon kon niet worden uitgelezen.");
      const receipt = result as ReceiptResult;
      setReceiptResult(receipt);
      setDraft((current) => ({
        ...current,
        description: receipt.description || current.description,
        amount: receipt.amount ?? current.amount,
        date: receipt.date ?? current.date,
      }));
      setNotice("Bon uitgelezen. Controleer de voorgestelde omschrijving, datum en het bedrag.");
    } catch (error) {
      setReceiptError(error instanceof Error ? error.message : "Bon kon niet worden uitgelezen.");
    } finally {
      setReceiptReading(false);
    }
  }

  function removeLine(id: string) {
    persist({ ...batch, concept: true, submitted: false, lines: batch.lines.filter((line) => line.id !== id) });
    setNotice("Regel verwijderd uit het concept.");
  }

  function resetDemo() {
    window.localStorage.removeItem(STORAGE_KEY);
    setBatch(INITIAL_BATCH);
    setDraft(EMPTY_LINE);
    setNotice("De demo is hersteld.");
  }

  if (!hydrated) return <div className="tool-card p-8 text-sm text-muted">Demo laden…</div>;

  return (
    <div className="space-y-8">
      <section className="tool-intro">
        <div className="relative z-10">
          <p className="tool-kicker">Declaraties · proof of concept</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight tracking-[-0.035em] text-white md:text-5xl">
            Eén maandconcept. Eén keer indienen.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/80 md:text-base">
            De medewerker werkt in één overzicht. De technische opsplitsing naar losse AFAS-declaraties blijft uit beeld.
          </p>
        </div>
        <div className="tool-chip-grid">
          <span>Concept in vrij bestand</span>
          <span>2 statusvelden</span>
          <span>1 verzendmoment</span>
          <span>{batch.lines.length} losse POSTs</span>
        </div>
      </section>

      <div className="rounded-2xl border border-brand-yellow/60 bg-brand-yellow/15 px-5 py-4 text-sm text-accent">
        <strong>Demomodus:</strong> deze pagina onthoudt de gegevens alleen in deze browser en stuurt niets naar AFAS. De technische previews tonen precies wat de productie-integratie gaat opslaan en versturen.
      </div>

      <section className="tool-card overflow-hidden">
        <div className="flex flex-col gap-5 border-b border-rule p-6 md:flex-row md:items-center md:justify-between md:p-8">
          <div>
            <p className="tool-kicker !text-brand-yellow-dark">Oktober 2026</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Declaraties van {batch.employeeName}</h2>
            <p className="mt-1 font-mono text-xs text-muted">{batch.batchId} · medewerker {batch.employeeId}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusFlag label="Concept" value={batch.concept} />
            <StatusFlag label="Ingediend" value={batch.submitted} />
          </div>
        </div>

        <div className="grid border-b border-rule md:grid-cols-3">
          <Metric label="Declaratieregels" value={String(batch.lines.length)} />
          <Metric label="Kosten" value={formatEuro(totalAmount)} />
          <Metric label="Kilometers" value={`${totalKilometers} km`} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-accent-soft/65 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
              <tr>
                <th className="px-6 py-3">Datum</th><th className="px-4 py-3">Soort</th><th className="px-4 py-3">Omschrijving</th><th className="px-4 py-3">Project</th><th className="px-4 py-3">Waarde</th><th className="px-4 py-3">Bijlage</th><th className="px-4 py-3"><span className="sr-only">Actie</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {batch.lines.map((line) => (
                <tr key={line.id} className="hover:bg-accent-soft/25">
                  <td className="whitespace-nowrap px-6 py-4">{formatDate(line.date)}</td>
                  <td className="px-4 py-4"><span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium">{line.kind === "kilometers" ? "Kilometers" : "Kosten"}</span></td>
                  <td className="px-4 py-4 font-medium">{line.description}</td>
                  <td className="px-4 py-4 font-mono text-xs">{line.project}</td>
                  <td className="px-4 py-4 font-semibold">{line.kind === "kilometers" ? `${line.kilometers} km` : formatEuro(line.amount)}</td>
                  <td className="max-w-[180px] truncate px-4 py-4 text-xs text-muted">{line.receipt || "—"}</td>
                  <td className="px-4 py-4"><button type="button" onClick={() => removeLine(line.id)} disabled={batch.submitted} className="text-xs font-semibold text-danger hover:underline disabled:cursor-not-allowed disabled:opacity-30">Verwijder</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!batch.submitted && (
          <div className="border-t border-rule bg-accent-soft/25 p-6 md:p-8">
            <h3 className="text-lg font-semibold">Declaratie toevoegen</h3>
            <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Field label="Datum"><input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></Field>
              <Field label="Soort"><select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as LineKind, declarationType: e.target.value === "kilometers" ? "ZK" : "K01" })}><option value="kosten">Kosten</option><option value="kilometers">Kilometers</option></select></Field>
              <Field label={`Typecode · ${lookupSource === "afas" ? "AFAS" : lookupSource === "laden" ? "laden" : "demo"}`}><select value={draft.declarationType} onChange={(e) => setDraft({ ...draft, declarationType: e.target.value, kind: e.target.value === "ZK" ? "kilometers" : draft.kind === "kilometers" ? "kosten" : draft.kind })}>{declarationTypes.length === 0 && <option value={draft.declarationType}>{draft.declarationType}</option>}{declarationTypes.map((option) => <option key={option.code} value={option.code}>{option.code} · {option.label}</option>)}</select></Field>
              <Field label={`Project · ${lookupSource === "afas" ? "AFAS" : lookupSource === "laden" ? "laden" : "demo"}`}><select value={draft.project} onChange={(e) => setDraft({ ...draft, project: e.target.value })}>{projects.length === 0 && <option value={draft.project}>{draft.project}</option>}{projects.map((option) => <option key={option.code} value={option.code}>{option.code} · {option.label}</option>)}</select></Field>
              <div className="md:col-span-2"><Field label="Omschrijving"><input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Bijv. parkeerkosten" /></Field></div>
              {draft.kind === "kilometers" ? (
                <>
                  <Field label="Van"><input value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} /></Field>
                  <Field label="Naar"><input value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} /></Field>
                  <Field label="Kilometers"><input type="number" min="0" value={draft.kilometers || ""} onChange={(e) => setDraft({ ...draft, kilometers: Number(e.target.value) })} /></Field>
                </>
              ) : (
                <>
                  <Field label="Bedrag"><input type="number" min="0" step="0.01" value={draft.amount || ""} onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })} /></Field>
                  <div className="lg:col-span-2">
                    <Field label="Bon of bijlage"><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => { const file = e.target.files?.[0]; if (file) void readReceipt(file); }} /></Field>
                    {receiptReading && <p className="mt-2 text-xs font-medium text-brand-purple">Bon wordt uitgelezen…</p>}
                    {receiptError && <p className="mt-2 text-xs font-medium text-danger">{receiptError}</p>}
                    {receiptResult && <p className="mt-2 rounded-xl border border-success/20 bg-success-soft px-3 py-2 text-xs text-success">Voorstel ingevuld · {receiptResult.merchant || "leverancier onbekend"} · zekerheid {receiptResult.confidence}. Controleer de velden vóór toevoegen.</p>}
                    <p className="mt-2 text-[11px] leading-relaxed text-muted">Bij het uitlezen wordt alleen de gekozen afbeelding tijdelijk naar de beveiligde bonherkenning gestuurd. De foto wordt niet in de browseropslag bewaard.</p>
                  </div>
                </>
              )}
            </div>
            <button type="button" onClick={addLine} className="tool-button-secondary mt-5">+ Toevoegen aan concept</button>
          </div>
        )}

        <div className="flex flex-col gap-5 border-t border-rule p-6 md:flex-row md:items-center md:justify-between md:p-8">
          <div>
            <p className="font-semibold">{batch.submitted ? "Maanddeclaratie ingediend" : "Klaar met invoeren?"}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{batch.submitted ? `${batch.lines.length} onderliggende declaraties zijn klaargezet voor AFAS.` : "Tussentijds opslaan start geen declaratie-workflow."}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={resetDemo} className="tool-button-secondary">Demo herstellen</button>
            {!batch.submitted && <button type="button" onClick={saveConcept} className="tool-button-secondary">Concept opslaan</button>}
            <button type="button" onClick={submitBatch} disabled={batch.submitted || !batch.lines.length} className="tool-button-primary">{batch.submitted ? "Ingediend ✓" : "Alles indienen"}</button>
          </div>
        </div>
        {notice && <div role="status" className={`border-t px-6 py-4 text-sm md:px-8 ${batch.submitted ? "border-success/20 bg-success-soft text-success" : "border-brand-yellow/40 bg-brand-yellow/10 text-accent"}`}>{notice}</div>}
      </section>

      <section className="tool-card overflow-hidden">
        <div className="border-b border-rule p-6 md:p-8">
          <p className="tool-kicker !text-brand-yellow-dark">Onder de motorkap</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Wat gebeurt er technisch?</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">De medewerker blijft in één scherm. Voor consultants maakt de demo de opslag en afzonderlijke AFAS-berichten controleerbaar.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <PreviewButton active={preview === "flow"} onClick={() => setPreview("flow")}>Proces</PreviewButton>
            <PreviewButton active={preview === "storage"} onClick={() => setPreview("storage")}>Vrij bestand</PreviewButton>
            <PreviewButton active={preview === "posts"} onClick={() => setPreview("posts")}>HrDeclarationInSite ({postPayloads.length})</PreviewButton>
          </div>
        </div>

        {preview === "flow" && <ProcessPreview batch={batch} />}
        {preview === "storage" && <JsonPreview title="Conceptopslag via KnCustomKxx" data={storagePayload} />}
        {preview === "posts" && <JsonPreview title={`${postPayloads.length} afzonderlijke POST-payloads`} data={postPayloads} />}
      </section>
    </div>
  );
}

function ProcessPreview({ batch }: { batch: Batch }) {
  const steps = [
    ["01", "Concept bewerken", "De medewerker voegt regels en bijlagen toe zonder een workflow te starten."],
    ["02", "Opslaan in AFAS", "Iedere regel staat in een vrij bestand onder hetzelfde BatchId, met Concept = ja."],
    ["03", "Eén keer indienen", `De integratielaag maakt ${batch.lines.length} losse HrDeclarationInSite-berichten.`],
    ["04", "Status bijwerken", "Na succesvolle verwerking worden Concept = nee en Ingediend = ja vastgelegd."],
  ];
  return (
    <div className="grid gap-px bg-rule md:grid-cols-4">
      {steps.map(([number, title, text]) => <div key={number} className="bg-white p-6 md:p-7"><span className="font-mono text-xs font-medium text-brand-yellow-dark">{number}</span><h3 className="mt-3 font-semibold">{title}</h3><p className="mt-2 text-xs leading-relaxed text-muted">{text}</p></div>)}
    </div>
  );
}

function JsonPreview({ title, data }: { title: string; data: unknown }) {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(data, null, 2);
  async function copy() {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-rule bg-accent-soft/35 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="font-semibold">{title}</p><p className="mt-1 text-xs text-muted">POC-veldnamen: de echte vrije veldcodes worden per AFAS-omgeving gekoppeld.</p></div>
        <button type="button" onClick={copy} className="tool-button-secondary !px-4 !py-2 text-xs">{copied ? "Gekopieerd ✓" : "Kopieer JSON"}</button>
      </div>
      <pre className="json-viewer max-h-[620px] overflow-auto p-6 font-mono text-xs leading-relaxed text-accent md:p-8">{json}</pre>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactElement<{ className?: string }> }) {
  return <label className="block"><span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.12em] text-muted">{label}</span>{useFieldClass(children)}</label>;
}

function useFieldClass(child: React.ReactElement<{ className?: string }>) {
  return <child.type {...child.props} className={`w-full rounded-xl border border-rule bg-white px-3 py-3 text-sm text-accent outline-none transition focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/15 ${child.props.className ?? ""}`} />;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="border-b border-rule p-5 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0 md:px-8"><p className="text-2xl font-semibold tabular-nums">{value}</p><p className="mt-1 font-mono text-[9px] uppercase tracking-[0.13em] text-muted">{label}</p></div>;
}

function StatusFlag({ label, value }: { label: string; value: boolean }) {
  return <div className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${value ? "border-success/25 bg-success-soft text-success" : "border-rule bg-accent-soft/50 text-muted"}`}><span className={`h-2 w-2 rounded-full ${value ? "bg-success" : "bg-muted/30"}`} />{label}: {value ? "Ja" : "Nee"}</div>;
}

function PreviewButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${active ? "border-accent bg-accent text-white" : "border-rule bg-white text-muted hover:border-accent/30 hover:text-accent"}`}>{children}</button>;
}

function buildFreeFilePayload(batch: Batch) {
  return {
    connector: "KnCustomKxx",
    note: "Koppel deze POC-namen aan de vrije veldcodes van de doelomgeving.",
    records: batch.lines.map((line) => ({
      BatchId: batch.batchId,
      RegelId: line.id,
      Medewerker: batch.employeeId,
      Periode: batch.period,
      Concept: batch.concept,
      Ingediend: batch.submitted,
      Datum: line.date,
      Declaratiesoort: line.declarationType,
      Omschrijving: line.description,
      Project: line.project,
      Bedrag: line.kind === "kosten" ? line.amount : null,
      Kilometers: line.kind === "kilometers" ? line.kilometers : null,
      Van: line.from || null,
      Naar: line.to || null,
      Bijlage: line.receipt || null,
    })),
  };
}

function buildDeclarationPayload(batch: Batch, line: DeclarationLine) {
  const fields: Record<string, string | number> = {
    EmId: batch.employeeId,
    DaTi: line.date,
    BiId: line.declarationType,
    Ds: line.description,
  };
  if (line.project) fields.PrId = line.project;
  if (line.kind === "kilometers") {
    fields.KmFr = line.from;
    fields.KmTo = line.to;
    fields.KmCa = line.kilometers;
  } else {
    fields.CoAm = line.amount;
    if (line.receipt) fields.Filename = line.receipt;
  }
  return { sourceLine: line.id, method: "POST", connector: "HrDeclarationInSite", payload: { HrDeclarationInSite: { Element: { Fields: fields } } } };
}

function formatEuro(value: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Bijlage kon niet worden gelezen."));
    reader.readAsDataURL(file);
  });
}
