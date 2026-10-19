import "server-only";
import { loadConnector, loadIndex, type ConnectorDetail } from "@/lib/data";

export type FieldEvidence = { path: string; code: string; description: string; type: string; required: boolean };
export type ConnectorEvidence = { id: string; name: string; methods: string[]; version: string; documentation?: string; fields: FieldEvidence[]; examples: number };

export function extractEvidence(detail: ConnectorDetail): ConnectorEvidence {
  const fields: FieldEvidence[] = [];
  const schema = detail.schemas.find((s) => s.method === "POST") ?? detail.schemas[0];
  function visit(node: unknown, path: string, depth = 0) {
    if (!node || typeof node !== "object" || depth > 18) return;
    const n = node as { properties?: Record<string, unknown>; items?: unknown; type?: string; description?: string; required?: string[] };
    for (const [code, value] of Object.entries(n.properties ?? {})) {
      const v = value as typeof n;
      if (path.endsWith(".Fields")) fields.push({ path: `${path}.${code}`, code, description: (v.description ?? "").split("\n")[0], type: v.type ?? "object", required: n.required?.includes(code) ?? false });
      visit(value, path ? `${path}.${code}` : code, depth + 1);
    }
    if (n.items) visit(n.items, `${path}[]`, depth + 1);
  }
  visit(schema?.schema, "");
  return { id: detail.connector.id, name: detail.connector.description, methods: detail.connector.methods, version: detail.connector.source_version ?? "onbekend", documentation: detail.connector.documentation_url, fields, examples: detail.examples.length };
}

export async function getEvidence(id: string): Promise<ConnectorEvidence | null> {
  if (!(await loadIndex()).some((c) => c.id === id)) return null;
  const detail = await loadConnector(id);
  return detail ? extractEvidence(detail) : null;
}

export async function integrationAdvice(question: string, missing: string[] = []) {
  const index = await loadIndex();
  const crm = /crm|relatie|organisatie|contact|synchronis/i.test(question);
  const ids = crm ? ["KnOrganisation", "KnPerson", "KnSalesRelationOrg"] : /uren|project|nacalculatie/i.test(question) ? ["PtRealization"] : /verzuim|salaris|loon|fte/i.test(question) ? [] : ["FiEntries"];
  const evidence = (await Promise.all(ids.filter((id) => index.some((c) => c.id === id)).map(getEvidence))).filter((e): e is ConnectorEvidence => Boolean(e));
  return {
    title: crm ? "CRM → AFAS: technisch voorstel" : "Ontbrekende dashboarddata onderzoeken",
    mode: "Metadata-analyse · adviserend",
    summary: crm ? "Organisaties, personen en verkooprelaties hebben verschillende UpdateConnectors. Kies de entiteit op basis van de betekenis van het CRM-record en controleer vóór toevoegen of die relatie al bestaat." : "De huidige demodatasets leveren deze informatie niet. De technische inrichting moet per AFAS-omgeving worden bevestigd voordat het dashboard deze bron kan gebruiken.",
    needs: missing.length ? missing : crm ? ["Entiteitstype in CRM", "Stabiele externe sleutel en mapping naar AFAS", "Naam, adres en relevante relatie-instellingen", "GetConnector voor controle van bestaande relaties"] : ["Gewenste KPI met teller/noemer en periode", "Unieke sleutel en aggregatieniveau", "Bevestigde leesbron en benodigde autorisatie"],
    candidate: crm ? "GetConnector met bestaande organisaties/personen/verkooprelaties; naam en kolommen nog per omgeving vast te stellen." : /verzuim|ziekte/i.test(question) ? "GGV-kandidaten rond verzuim en medewerkerbezetting. Exacte gegevensverzameling, velden en toegangsrechten nog in AFAS controleren." : /salaris|loon/i.test(question) ? "GGV-kandidaat rond loonresultaten. Eerst gegevensdoel, perioden en autorisatie bepalen; geen salarisbron beschikbaar in deze demo." : "GGV-kandidaten rond financiële mutaties of nacalculatie, afhankelijk van de KPI. Een UpdateConnector-schema bewijst geen beschikbare GetConnector.",
    steps: crm ? ["Bepaal organisatie/persoon/debiteur en de gewenste velden; controleer verplichte velden per methode in het schema.", "Lees bestaande records via een geconfigureerde GetConnector. Gebruik een beheerde externe-sleutelmapping en bevestigde matchingregels; niet alleen een naamvergelijking.", "Ontwerp POST voor nieuwe records en PUT voor bestaande records waar het schema die methode ondersteunt. Bevestig nummering en voorwaardelijk verplichte instellingen.", "Leg idempotentie, logging, retrybeleid en een test in de acceptatieomgeving vast. In deze demo worden geen AFAS-mutaties uitgevoerd."] : ["Bevestig definitie, peildatum/periode en benodigde dimensies met de consultant.", "Controleer of een bestaande leesconnector kan worden uitgebreid; verifieer de GGV en veldcodes in de doelomgeving.", "Werk de bronmapping uit naar het canonieke datasetcontract; leg sleutelrelaties en toestemming vast.", "Valideer volledigheid, dubbelen en aggregaties met een bekende rapportage. Activeer het dashboard pas na die controle."],
    evidence,
    mapping: crm ? [{ from: "CRM.organisatieNaam", to: "KnOrganisation → Nm", status: evidence.some((e) => e.id === "KnOrganisation" && e.fields.some((f) => f.code === "Nm")) ? "Veld bevestigd in officieel schema; betekenis nog afstemmen" : "Te verifiëren" }, { from: "CRM.kvkNummer", to: "KnOrganisation → CcNr", status: "Schema controleren + matchingbeleid bepalen" }, { from: "CRM.externId", to: "Beheerde sleutelmapping → AFAS-relatiecode", status: "Ontwerpvoorstel; geen automatische AFAS-veldtoewijzing" }] : [],
  };
}
