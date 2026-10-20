# Irixs Studio — dashboards met één gedeeld datamodel

`/studio` is één Studio. **Dashboards** bevat PURE planning/behoefte, resultaat/budget, omzet/klanten, projecten/inzet en eigen dashboards. Een dashboard kan worden bekeken, handmatig bewerkt of vanuit een vraag worden gemaakt. **Data & model** bevat alleen de onderliggende tabellen, formules, relaties en wijzigingen. Het oude `/studio/data` verwijst door naar `/studio#data`; er is geen tweede app of grafiekbibliotheek nodig.

Alle dashboards gebruiken `lib/bi/model.ts`, dezelfde datasets en dezelfde renderer/editor. Een grafiek hoort bij één dashboard; een kopie kan worden toegevoegd aan een ander dashboard en blijft dezelfde bron/formules gebruiken. Een bronwijziging rekent door in alle afhankelijke dashboards. Dit blijft een browserlokale BI-kern, geen volledige Power BI-, Excel- of DAX-implementatie.

## Bestaande opslag en AI

`lib/bi/studio.ts` neemt `irixs-data-studio-v1` (tabellen, formules, relaties en rapporten) en `irixs-dashboard-studio-v1` (bewaarde dashboards) samen over. Titels, filters, gedeeldstatus, rijen en formules blijven behouden. De nieuwe opslag heet `irixs-studio-v2`; oude sleutels worden niet verwijderd of overschreven. Mislukte conversies worden gemeld. De klantdemo gebruikt afzonderlijk `irixs-studio-customer-v2` en leest geen interne imports.

AI-uitvoer wordt naar hetzelfde dashboard-/grafiekmodel vertaald. Jaarvergelijkingen, groei, positieve-omzetklanten en gewogen percentages hebben regressietests tegen de oorspronkelijke rekenregels. AI-vervolgopdrachten gebruiken de actuele instellingen; als het dashboard buiten het beperkte AI-contract valt (bijvoorbeeld eigen bronnen of spreiding), blijft handmatig bewerken beschikbaar en wordt geen onvolledige oude kopie verstuurd. PURE-vragen gebruiken expliciet een planningtemplate, geen vermeende externe AI-analyse. Geïmporteerde records gaan niet naar AI.

## Wat werkt

- Rapportpagina’s voor PURE-planning, financiën en eigen analyses; KPI’s, staaf-, lijn-, vlak-, spreidingsgrafieken en tabellen. Titels, berekeningen, opmaak, groepering, volgorde en breedte zijn instelbaar.
- Tabellen direct bewerken, zoeken, sorteren en regels toevoegen. Afgeleide en gekoppelde velden zijn alleen-lezen. Celwijzigingen rekenen door in formules, afgeleide tabellen en rapporten.
- CSV/TSV/XLS/XLSX toevoegen als nieuwe bron; eerste werkblad, maximaal 10 MB per invoerbestand, 5.000 regels en 80 kolommen. Voorloopnullen in tekstcodes blijven behouden. Jaar/Maand/Administratie worden als `year`/`month`/`administration` herkend; overige veldnamen krijgen zichtbare technische ids. Decimale punt of komma, geen duizendtalscheiding. Controleer de geïmporteerde kolomtypen.
- Een gegevensmodel met expliciete veel-op-één-relaties en 1–3 sleutelparen. Dubbele opzoeksleutels en modelcycli worden geweigerd. Lege sleutels worden nooit onderling gekoppeld; onbekende codes worden niet gefingeerd.
- Bronnen vergelijken door elke bron **eerst afzonderlijk te aggregeren**, daarna groepen naast elkaar te zetten. De groeperingsvelden mogen verschillende namen hebben en zijn expliciet te koppelen bij reeks B. Geen fact-op-fact-join die bedragen vermenigvuldigt. Ontbrekende vergelijkingswaarden blijven leeg, niet automatisch nul.
- Een grafiek- of tabelwaarde selecteren filtert de andere grafieken. Zonder het benodigde selectieveld verschijnt een melding in plaats van ongefilterde cijfers. De gedeelde functiedimensie filtert zowel behoefte als medewerkerplanning. Verschillende eenheden krijgen geen misleidende gedeelde as of verschilberekening; gebruik dan een tabel of spreiding met expliciete X-/Y-as.
- Werkplek opslaan in de browser, JSON-back-up exporteren en opnieuw importeren; CSV-export van de geselecteerde tabel met berekende velden. De laatste 500 celwijzigingen zijn zichtbaar en exporteerbaar. Dit is geen onveranderbare productie-auditlog.

## Fictieve PURE-demobronnen

De werkplek begint met 10 bronnen: omzetregels, omzetbudgetten, klanten, projecturen, medewerkers, functies, PURE vrije bestandsregels, behoefte, ingepland en planningsdekking. Er zijn 12 fictieve medewerkers, 4 functies, 4 projecten en 13 weken (36–48 van 2026). Namen/codes zijn geen klantgegevens. De PURE-bron is een canoniek demomodel, **geen officiële AFAS-vrije-bestand- of GetConnector-definitie**.

In de PURE-brontabel zijn behoefte en planning verschillende regelsoorten. Behoefteregels hebben bewust **geen medewerker**. De twee afgeleide selecties rekenen vanaf dezelfde oorspronkelijke PURE-regels. Planningsdekking telt eerst op per **jaar + week + administratie + project + functie**:

- `requiredHours`: som behoefte.
- `plannedHours`: som planning.
- `openHours`: `MAX([requiredHours] - [plannedHours]; 0)` per groep.
- `overHours`: `MAX([plannedHours] - [requiredHours]; 0)` per groep.

Openstaande uren zijn dus niet één globaal nettoverschil: extra planning op een andere functie/project/week mag een tekort niet verbergen. De medewerkersdimensie bevat contractcapaciteit als indicatie; er is nog geen roosterkalender-/verlofberekening of beschikbaarheidsadvies.

Een geïmporteerd bestand wordt **toegevoegd**, niet automatisch op de PURE-democonfiguratie aangesloten. Eigen kolommen en relaties zijn beschikbaar voor eigen rapporten; een productiekoppeling met de juiste vrije-bestandvelden vereist een expliciete mapping.

## Formules

De eigen parser ondersteunt `+ - * / ^`, vergelijkingen, `[veld]`-verwijzingen en `IF/ALS`, `ROUND/AFRONDEN`, `ABS`, `MIN`, `MAX`, `COALESCE`. Gebruik een decimale punt en bij voorkeur puntkomma’s tussen argumenten. De editor maakt numerieke berekende kolommen. Er zijn geen scripts, `eval`, externe aanvragen of volledige Excel/DAX-functies. Formules hebben lengte-, token- en dieptelimieten. Delen door nul geeft geen waarde.

Er zijn twee verschillende berekeningsniveaus:

1. **Kolomformule**: één uitkomst per bronregel, bijvoorbeeld `[amount] * 1.1`.
2. **Grafiek → Formule over totalen**: tel de genoemde velden eerst per groep op en evalueer dan de formule. Bijvoorbeeld `[profit] / [revenue] * 100` geeft een gewogen marge, geen gemiddelde van regelpercentages.

## Demo doorlopen

1. Open Irixs Studio → Dashboards → PURE planning & behoefte. Bekijk benodigd, ingepland, openstaand en meer dan behoefte.
2. Onderliggende data → PURE vrije bestandsregels. Verhoog op regel 4 de behoefte van 20 naar 28 en verlaat de cel. Terug naar het dashboard: benodigde én openstaande uren stijgen met 8, planning blijft gelijk.
3. Klik in ‘Openstaande uren per functie’ op Engineer. De andere grafieken en medewerkerslijst filteren mee. Wis de selectie om alles te zien.
4. Formules → PURE-bron: voeg ‘Uren met opslag’ toe met `ROUND([amount] * 1.1; 2)`. Bekijk de berekende, grijze tabelkolom.
5. Dashboards → Resultaat & budget → Dashboard bewerken. Bewerk de grafiek of kies een andere bron/maatstaf. Een gewogen KPI kan via ‘Formule over totalen’ worden toegevoegd.
6. Importeer een eigen klein bestand en voeg vanuit de tabel een grafiek toe aan het geopende dashboard, of maak een leeg dashboard. Kies dimensie, waarde en eventueel een tweede reeks/bron. Een bestaande grafiek kan vanuit de dashboardeditor worden gekopieerd. De fixture `scripts/fixtures/bi-qa.csv` bevat uitsluitend fictieve QA-data.
7. Sla op, herlaad en controleer de waarden, formules en grafiekinstellingen. Download voor overdracht een JSON-back-up.

## Grenzen en richting productie

Studio verstuurt geen geïmporteerde records naar Groq/een AI-provider of AFAS. Bewerken is **lokaal muteren**, niet een AFAS UpdateConnector aanroepen. De datamodel-interface is alleen zichtbaar in de interne Toolbox-sessie. De beperkte klantdemo blijft server-side uitgesloten van `/internal`, `/studio/data` en interne API’s; haar opslag is bovendien gescheiden. Demoprofielen zijn geen echte autorisatie. Er is geen gedeelde database, multi-user-samenwerking, rijautorisatie, automatische live verversing, transactionele rollback of AFAS-post.

Een Studio is beperkt tot 16 bronnen, 20 dashboards, 24 componenten per dashboard, 240 componenten totaal en 2 miljoen JSON-tekens. Opslagquota worden gemeld; maak voor belangrijke eigen gegevens een JSON-back-up. Voor een productieplatform zijn ten minste beheerde tenantopslag, identiteit/rollen, bronadapters, mapping, refresh, audit/versies en gecontroleerde terugschrijfopdrachten nodig. AFAS-mutaties moeten daarna per connector, veld en bevoegdheid worden ingericht en vóór verzending controleerbaar zijn. Prijs- of abonnementslogica per dataset/maand is bewust niet toegevoegd.

## Verificatie

`node --test scripts/test-bi.mjs` test formuletaal, afhankelijke kolommen, modelvalidatie, herberekening van behoefte, unieke relaties, aggregatie vóór vergelijking, gewogen KPI’s, crossfilter, import en veilige CSV-export. Browser-QA controleert bewerken, koppelen, formule toevoegen, opslaan/herladen, CSV-import en een eigen spreidingsanalyse. Er worden geen echte AFAS-mutaties getest.
