# Declaratie-POC: afstand en geldigheidscombinaties

## Status en invoerroute

Medewerker → declaratiedatum → toegestane declaratiesoort → toegestaan project → rit/bon → concept bewaren → alle regels opnieuw controleren → indienen.

Dit is een POC, geen productie-integratie met AFAS-mutaties. Concepten staan alleen in browseropslag, per demomedewerker gescheiden. De knop Indienen simuleert de statuswijziging en verstuurt geen AFAS-berichten. Oktober 2026 is de vaste demoperiode. De rechten in het demomodel zijn fictief.

Conceptregels kunnen worden gewijzigd, geannuleerd en verwijderd; wijzigen behoudt de regel-id. Opslaan van een onvolledig concept mag, toevoegen en indienen vereisen geldige regels. Na demo-indiening zijn regels vergrendeld. HrDeclarationInSite ondersteunt toevoegen; bestaande ingediende AFAS-declaraties wijzigen vereist een afzonderlijk correctieproces, niet een tweede POST.

Bij echte InSite-integratie moet de server de medewerker uit een geverifieerde identiteit bepalen, actuele rechten/combinaties ophalen en elke regel nogmaals controleren. Deze browserdemo is geen autorisatiegrens. Een volledige AFAS-verwerking vereist ook periode-, dienstverband-, boekings- en workflowcontroles die deze POC niet vervangt.

## Afstand: wat is de standaard?

Er is geen aangetoonde universele AFAS-provider of decimaleninstelling. De werkgever kiest de provider, het communicatieprofiel de routevoorkeur en de gekoppelde kostensoort het aantal decimalen. Een niet-aangevinkte Snelste-optie betekent volgens de AFAS-Help kortste route. De demo start daarom met kortste; dit bewijst niet wat een specifieke klantomgeving heeft ingesteld.

- **Google Routes API:** Compute Routes met alternatieven, DRIVE en TRAFFIC_UNAWARE. Uit alle teruggegeven kandidaten kiezen we de kleinste afstand of de laagste staticDuration. De snelste route is dus niet simpelweg de eerste route. Ontbreekt bruikbare metadata, dan blokkeren we de berekening.
- **TomTom (ANWB):** Geocoding API voor adressen, Routing API voor routeType shortest/fastest, traffic=false. Geen ongedocumenteerd ANWB-website-endpoint.
- **Retour:** enkele reis × 2, volgens de AFAS-declaratiehulp. Geen apart berekende B→A-route.
- **Decimalen:** uit de soortlookup via Decimalen of AFAS_DECLARATION_DECIMALS_FIELD. Zonder instelling bewaart de demo drie decimalen voor meterprecisie; dat is nadrukkelijk geen universele AFAS-standaard. Het demotype ZK gebruikt expliciet drie decimalen.
- **Afronding:** we bewaren de ruwe heenafstand en ronden de uiteindelijke declaratiehoeveelheid af op de kostensoortprecisie. De precieze afrondingsvolgorde van iedere AFAS-versie is niet aangetoond; controleer grensgevallen met een AFAS-referentie.

### Grenzen van gelijkheid met AFAS

De AFAS-Help spreekt over maximaal vijf Google-routes. Google documenteert maximaal drie alternatieven naast de standaardroute en biedt geen parameter om vijf af te dwingen. Wij gebruiken alle werkelijk ontvangen routes en tonen het aantal. We verzinnen geen extra routes om deze bronafwijking te verbergen.

De actuele Google-consumentenplanner is geen goede referentie omdat die verkeersdrukte kan meenemen. Route-uitkomsten kunnen bovendien veranderen tussen aanvragen. De POC volgt de beschreven selectiemethode, maar exacte gelijkheid met AFAS is **niet live vastgesteld**.

Onder Uitkomst vergelijken met AFAS kan een referentietotaal worden ingevuld. Een afwijking blokkeert toevoegen/indienen; een match bevestigt alleen die ingevoerde referentie, niet alle toekomstige routes. Oude Google/TomTom-conceptregels zonder berekeningsversie 2 worden niet stil aangepast, maar vragen om opnieuw berekenen.

Stel GOOGLE_MAPS_API_KEY en/of TOMTOM_API_KEY server-side in. Ontbrekende keys schakelen echte bronnen uit. Alleen de expliciete demo-optie levert fictieve kandidaten Enter ↔ Utrecht: kortste 126 km, snelste 138 km. Dit is geen echt route- of ANWB-resultaat.

KmCa bevat de ruwe enkele afstand, KmRt de retourvlag en Qu het afgeronde totaal. Een geïmporteerd retourtotaal zonder heenafstand gebruikt voor KmCa de helft van het totaal. Controleer de interpretatie en eventuele verdere afronding met een AFAS-testimport.

Een provideraccount, billing en gebruiksvoorwaarden horen bij echte aansluiting. Keys blijven op de server. Bij berekenen ontvangt de gekozen provider de adressen. Dit is routeberekening, geen GPS-rittenregistratie en geen import-API voor persoonlijke Google/ANWB-rittenhistorie.

## Geldigheidscombinaties: gedocumenteerde regels

AFAS ondersteunt maximaal drie verschillende, aansluitende grondslagen, zoals project/projectgroep, item/integratiegroep, medewerker/functie en dimensies.

- Binnen één regel geldt EN; tussen actieve regels geldt OF.
- Een bewust lege grondslagwaarde betekent alle waarden; een ontbrekende kolom is geen wildcard.
- Begin- en einddatum zijn inclusief.
- Bij niet-ingerichte combinaties geldt geen combinatiefilter. Bij een expliciet actieve, lege toegestane lijst is niets toegestaan.
- Stamgegevens en projectteambeperkingen blijven aanvullend gelden.
- Een declaratiesoort (BiId) moet naar de gekoppelde kostensoort worden vertaald. Bijvoorbeeld demotype ZK → item Kst:KM-ZAK → integratiegroep REIS. Die codes zijn niet automatisch gelijk.

### Werkende demoprofielen

De demo toont groepsregels (projectgroep + integratiegroep), individuele regels (medewerker + project + item), functieregels en niet-ingerichte combinaties. Er zijn drie fictieve medewerkers, projectteams, een geblokkeerd project/type en een OV-combinatie geldig van 1 t/m 15 oktober 2026.

Scenario-knoppen tonen een geldige rit, geen teamlid, tijdelijk/verlopen OV en een geblokkeerd project. De uitleg laat de gekoppelde kostensoort, actieve grondslagen, teamcontrole en passende regel zien. Dropdowns tonen alleen soorten waarvoor minstens één volledige toegestane boeking bestaat. Een wildcard heft een teamblokkade niet op.

Het downloadbare JSON-grondslagenmodel kan opnieuw worden geïmporteerd. Versie 1 ondersteunt zes grondslagtypen: employee, function, project, projectGroup, item en integrationGroup. Dimensies vallen buiten dit model. Het is ons interne uitwisselingscontract, geen kant-en-klaar AFAS-formaat. Teamdatums en declaratierechten zijn expliciete modelgegevens; een schema voor PtValComb levert deze informatie niet vanzelf.

### Live GetConnector of uitgewerkte export

De bestaande lookup accepteert uitgewerkte toegestane combinaties, niet ruwe VaV1/BaV1-velden. Los grondslagen, groepen, itemkoppelingen, actuele rechten en teams eerst op in de GetConnector of integratielaag. Gebruik geen wildcard als die een noodzakelijke medewerker- of teambeperking zou weglaten.

| Kolom | Betekenis |
| --- | --- |
| Medewerker | Daadwerkelijke medewerkercode; bewust leeg geldt voor alle |
| Project | Daadwerkelijke projectcode; bewust leeg geldt voor alle |
| Declaratiesoort | HrDeclarationInSite.BiId; bewust leeg geldt voor alle |
| Begindatum | Inclusief, JJJJ-MM-DD; leeg is geen ondergrens |
| Einddatum | Inclusief, JJJJ-MM-DD; leeg is geen bovengrens |

Alle vijf kolommen zijn verplicht. Ongeldige datums of een ontbrekende kolom worden geweigerd. De uitgewerkte lijst ondersteunt geen aparte niet-ingericht-vlag: een lege lijst weigert alles. Voor een expliciet uitgeschakeld combinatiefilter met overige controles is het volledige grondslagenmodel nodig.

Import: JSON-lijst, GetConnector-resultaat met rows, CSV of XLSX. Een upload vervangt alleen de huidige sessie; herladen leest de geconfigureerde lookup. Volledige modelimport levert ook de stamgegevens voor de dropdowns.

Live configuratie: AFAS_BASE_URL, AFAS_TOKEN, AFAS_PROJECTS_GETCONNECTOR, AFAS_DECLARATION_TYPES_GETCONNECTOR en AFAS_VALIDITY_GETCONNECTOR. Veldmapping staat in .env.example. Invoertype is kosten/kilometers; Decimalen komt uit de gekoppelde kostensoort. Als deze informatie ontbreekt, mag de gebruiker die niet als een vastgestelde AFAS-instelling beschouwen.

De server leest gepagineerd maximaal 50.000 regels per lookup; gebruik een stabiele unieke sortering. Alleen volledig afwezige AFAS-configuratie geeft demogegevens. Een deels ingestelde of falende live koppeling blokkeert, zonder demotoestemmingen als fallback.

## Kilometerbestand importeren

Verplicht: Datum, Van, Naar, Kilometers, Typecode, Project. Optioneel: Retour (ja/nee) en Omschrijving. Kilometers is altijd het totaal, ook bij retour. Gebruik geen duizendtalscheiding; maximaal zes decimalen leesbaar, maar de kostensoort kan minder toestaan. De tool weigert te veel precisie en rondt importregels niet ongemerkt af.

Datums: JJJJ-MM-DD, Excel-datum of DD-MM-JJJJ. Maximaal 500 regels / 3 MB. Bij één fout wordt niets toegevoegd. Wijzigen van een importregel maakt opnieuw berekenen via Google/TomTom mogelijk.

## Verificatie

Automatische tests gebruiken uitsluitend mocks en fictieve keys. Zij controleren routekeuze, verkeerinstelling, retour, precisie, ontbrekende metadata, combinaties, perioden, teamrechten, grondslagimport, lookups en foutafhandeling. Browsercontrole test dropdowns, scenario's, wijzigen en afzonderlijke democoncepten. Echte AFAS/provider-uitkomsten zijn niet vergeleken: daarvoor ontbreken de klantinstellingen en referentieritten.

## Primaire bronnen

- [AFAS: routekeuze en Google Routes API](https://help.afas.nl/help/NL/SE/136195.htm)
- [AFAS: Google-inrichting](https://help.afas.nl/help/NL/SE/137646.htm)
- [AFAS: TomTom (ANWB)](https://help.afas.nl/help/NL/SE/137510.htm)
- [AFAS: declareren en retour verdubbelen](https://help.afas.nl/Help/nl/se/Hrm_Declrs.htm)
- [AFAS: aantal decimalen bij kostensoort](https://help.afas.nl/help/NL/SE/121498.htm)
- [Google: alternatieve routes](https://developers.google.com/maps/documentation/routes/alternative-routes)
- [Google: Compute Routes REST-contract](https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRoutes)
- [TomTom: Calculate Route](https://docs.tomtom.com/routing-api/documentation/tomtom-maps/v1/calculate-route)
- [TomTom: Geocode](https://docs.tomtom.com/geocoding-api/documentation/tomtom-maps/v1/geocode)
- [ANWB: routeplanner en TomTom](https://www.anwb.nl/verkeer/routeplanner/veelgestelde-vragen)
- [AFAS: geldigheidscombinaties](https://help.afas.nl/help/NL/SE/Pro_Config_VldCmb.htm)
- [AFAS: aanvullende teambeperking](https://help.afas.nl/Help/nl/se/Pro_Teams_Costng.htm)
- [AFAS: filtering in matrixboeking](https://help.afas.nl/partner/nl/se/137155.htm)
- [AFAS: declaraties en projectintegratie](https://help.afas.nl/help/NL/SE/Hrm_Config_Declrs_2.htm)
- [AFAS: geldigheidsfout bij goedkeuren](https://help.afas.nl/meldingen/NL/SE/97197.htm)
- [AFAS: HrDeclarationInSite](https://help.afas.nl/help/NL/SE/App_Conect_UpdDsc_HrDecl_InSite.htm)
