# Irixs Dashboard Studio & Knowledge Engine

## Demo doorlopen

1. Open `/studio` via de Toolbox. Kies **Maken met AI**, gebruik het omzetvoorbeeld en klik **Genereer dashboard**.
2. De echte Knowledge Engine-controles verschijnen: vraag, bestaande AFAS-schemabank, demobron, velden, KPI-definities en dashboardcomponenten. Dit zijn resultaten van uitgevoerde controles; bij uitgeschakelde/niet-beschikbare AI staat er expliciet **Demo-interpreter**.
3. Selecteer een componenttitel. Verander titel, KPI, groepering, grafiektype, breedte of jaarvergelijking. Voeg componenten toe via de bibliotheek. Gebruik slepen of pijltjes voor de volgorde; verwijder met het kruisje.
4. Vraag in de editor: ‘Verander de maandgrafiek naar een lijndiagram en voeg een KPI voor groei ten opzichte van vorig jaar toe’. Bestaande widget-id's, filters en handmatige titels blijven behouden. Onbekende KPI's/velden worden geweigerd.
5. **Opslaan** bewaart de configuratie in deze browser. Open **Voorbeeld** voor de schone kijkmodus. Keer terug naar het overzicht; herladen en opnieuw openen behouden het dashboard. Filters rekenen door in KPI's, grafieken en tabellen.
6. Vink **Beschikbaar voor democollega** aan en sla op. De demoprofielkeuze **Collega** toont alleen gedeelde en eigen dashboards. Dit is een browserlokale deelsimulatie, geen uitnodiging of productie-rollenbeheer.
7. Genereer een verzuimdashboard. De klant krijgt een begrijpelijke melding over ontbrekende data. Het verzoek staat browserlokaal klaar in `/internal` → **Data Engineer**. Er wordt geen supportbericht verstuurd.
8. Laat intern ook het CRM-voorbeeld analyseren. Het voorstel noemt alleen connectoren en velden die in de bestaande officiële schema's zijn gevonden. Leesconnector/GGV, matching en nummerbeleid blijven te bevestigen voorstellen. De interne analyse gebruikt een beperkte, deterministische metadata-analyse en doet geen live mutaties.
9. **Mijn databronnen** kan een demobron uitschakelen en verversen simuleren. Uitgeschakelde bronnen verhinderen dashboardgeneratie en rendering. Een gesimuleerde verversing toont het tijdstip als simulatie en wijzigt de fictieve cijfers niet.
10. Start **Klantdemo starten** vanuit een interne studiosessie. Dit vervangt de interne sessie door een beperkter ondertekend sessietoken. Interne routes/API's en de andere Toolbox-API's zijn dan server-side geblokkeerd. Om intern terug te keren is opnieuw inloggen via `/login?next=/internal` nodig.

## Wat daadwerkelijk werkt

- Drie voorbeelddashboards en een leeg canvas; de editor heeft geen AI nodig.
- Lokale, deterministische financiële en projecturenrecords voor 2024–2026; dashboardselectie 2025/2026 met vergelijkingsperioden. Ook toekomstige maanden zijn expliciet fictieve demonstratiedata.
- Gedeelde catalogus met datasetcontracten, dimensies en acht KPI-definities. Marge en declarabiliteit zijn gewogen; groei vergelijkt dezelfde maanden/administratie met vorig jaar. Bij een nulnoemer verschijnt geen verzonnen percentage.
- Gevalideerde JSON-dashboardconfiguraties. AI genereert geen HTML, JavaScript, SQL of componentcode.
- De bestaande `lib/data.ts` en `data/connectors` worden hergebruikt. De Dashboard Studio raadpleegt werkelijk officiële schema's als context; de Data Engineer en interne inspectie gebruiken dezelfde extractielaag (`lib/studio/knowledge.ts`). Geen tweede kopie van de schemabank.
- Provideraanvragen gebruiken alleen prompt, bestaande configuratie en metadata van de demo. Geen live AFAS-administraties of echte klantdata worden uitgelezen.
- Een klantdemo-sessietoken verleent geen interne route- of API-toegang. De bestaande interne wachtwoordbeveiliging blijft gehandhaafd.

## AI en bonherkenning: verwisselbare leverancier

`lib/aiProvider.ts` is de gezamenlijke JSON-provideradapter voor Studio, JSON-verbetering en bonherkenning. De standaard blijft de bestaande Groq-aansluiting. De interne pagina meldt expliciet **Groq · demoprovider** en de productiebeoordeling die nog nodig is.

- `IRIXS_AI_PROVIDER=groq`: bestaande `GROQ_API_KEY`, optioneel `IRIXS_AI_MODEL`.
- `IRIXS_AI_PROVIDER=compatible`: eigen `IRIXS_AI_BASE_URL` (HTTPS, inclusief het versiepad), `IRIXS_AI_API_KEY` en `IRIXS_AI_MODEL` voor een compatibel chat-completions/JSON-contract. Een andere API-vorm vereist een nieuwe adapter; Azure/andere leveranciers werken niet automatisch alleen door hun naam in te vullen.
- `IRIXS_AI_PROVIDER=disabled`: geen externe AI-aanvragen. Studio kan de gedocumenteerde voorbeeldvragen via een expliciet gemarkeerde, beperkte demo-interpreter verwerken. JSON-verbetering en bonherkenning geven dan een configuratiemelding.
- `IRIXS_RECEIPT_AI_MODEL` kiest apart het bonmodel. Gebruik een geschikt visionmodel; dat wordt niet door de naam van de provider gegarandeerd. `IRIXS_RECEIPT_AI_ENABLED=false` zet alleen bonherkenning uit.

De bestaande bonherkenning verstuurde de gekozen afbeelding al naar Groq. Na deze wijziging gaat de afbeelding naar de geconfigureerde provider. API-keys blijven server-side. Voor productie moeten providercontract, gegevensverwerking, toegangsrechten, modelgeschiktheid en gebruiksgrenzen worden beoordeeld. De demo implementeert geen definitieve productieprovider, verwerkingsovereenkomst of automatische anonimisering van bonnen.

## Wat simulatie blijft

- GetConnector-namen `DEMO_Omzetregels` en `DEMO_Projecturen` zijn demo-identificaties, geen officiële beschikbare AFAS-GetConnectoren.
- Canonieke velden zoals `revenue` en `billableHours` komen uit de demo-adapter. Het bestaan van een UpdateConnector bewijst geen leesbron, GGV, join of beschikbaarheid in een klantomgeving. Gerelateerde schema's en voorgestelde GGV-onderwerpen zijn als context/voorstel gemarkeerd.
- Opslag, delen en databehoeften zijn lokaal in één browser. Andere browsers, apparaten of gebruikers delen geen database. Er zijn geen echte klanttenants of gebruikersaccounts.
- Er is geen live synchronisatie, Azure-deployment, AFAS OAuth of automatische InSite-SSO. De afzonderlijke klantpagina is responsief en geschikt als iframe-demo, maar embedding en identiteit moeten later op de doelomgeving worden getest.

## Richting productie

Behoud de keten **leesadapter → canoniek datasetcontract → Knowledge Engine/KPI's → dashboardconfiguratie → renderer**. Sluit eerst een geautoriseerde AFAS-leesadapter of een gesynchroniseerde database aan. Voeg daarna serveropslag per tenant, echte identiteit/rollen, server-side rijautorisatie, auditlog en dashboarddeling toe. Vervang de browserlokale bronselectie door gecontroleerde bronstatus per tenant. Valideer financiële definities/mappings tegen een bekende AFAS-rapportage.

## Verificatie

`node --test scripts/test-studio.mjs` controleert berekeningen, configuraties, vervolgwijzigingen, officiële schemaherkomst en providerwisseling zonder externe API-aanroepen.

`node scripts/test-studio-api.mjs` draait tegen een lokale preview op poort 3001 met AI uit en een lokale testlogin `local-studio-qa`. Het controleert generatie, wijzigingen, ontbrekende bronnen, metadata-advies en de server-side grens tussen klant en intern. Gebruik dit testaccount niet op productie.
