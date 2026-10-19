# Declaratie-POC: afstand en geldigheidscombinaties

## Invoerroute

Medewerker uit de ingelogde context → declaratiedatum → declaratiesoort → toegestaan project → rit/bon → concept opslaan → alle regels opnieuw controleren → indienen.

De POC gebruikt de vaste demomedewerker ALLARDJ en oktober 2026. Concepten staan uitsluitend in browseropslag. De knop Indienen simuleert statuswijziging; hij verstuurt geen AFAS-mutaties. Bij een werkelijke InSite-koppeling moet de server de medewerker uit de geverifieerde identiteit halen, actuele combinaties opnieuw lezen en elke regel controleren. Een browsercontrole is geen autorisatiegrens.

Conceptregels zijn te wijzigen, te annuleren en te verwijderen. De regelidentiteit blijft bij een wijziging behouden. Na demo-indiening zijn de regels vergrendeld. HrDeclarationInSite ondersteunt toevoegen; een bestaande, ingediende AFAS-declaratie aanpassen vereist een apart ingericht correctieproces. De POC verstuurt bij wijzigen geen tweede POST.

## Afstand: de officiële AFAS-bronnen

- Google: **Routes API / Compute Routes**. Adressen worden server-side aangeboden; antwoord bevat afstand in meters. De POC vraagt de aanbevolen autoroute zonder actuele verkeersoptimalisatie op. Dat is geen gegarandeerde kortste route.
- TomTom (in AFAS aangeduid als **TomTom API (ANWB)**): **Geocoding API** zet adressen om naar coördinaten, **Routing API** berekent de snelste of kortste autoroute. De POC gebruikt de gedocumenteerde TomTom Maps v1/v2-endpoints, passend bij de bestaande AFAS-integratie. TomTom heeft daarnaast nieuwere Orbis-producten; verwissel keys en contracten niet zonder migratie.
- De ANWB-consumentenrouteplanner gebruikt TomTom voor autoroutes. De POC roept geen ongedocumenteerde ANWB-website-endpoints aan.

Stel `GOOGLE_MAPS_API_KEY` en/of `TOMTOM_API_KEY` in op Vercel. Een ontbrekende sleutel schakelt de betreffende bron uit. Er wordt nooit stil teruggevallen op een verzonnen afstand. Alleen de expliciete demo-optie levert het fictieve voorbeeld Enter ↔ Utrecht (126 km).

Bij retour berekent de POC heen en terug apart, omdat eenrichtingswegen afstanden kunnen veranderen. `KmCa` bevat de afstand heen, `KmRt` de retourvlag en `Qu` het totale te declareren aantal kilometers. Bij een geïmporteerde retour zonder afzonderlijke heenafstand wordt voor `KmCa` de helft van het aangeleverde totaal gebruikt; de totale hoeveelheid blijft ongewijzigd. Controleer deze gegevens bij de AFAS-testimport, met name wanneer AFAS zelf een routeberekening of afronding toepast.

De organisatie kiest de routebron en routevoorkeur overeenkomstig haar declaratiebeleid. De API berekent afstand en houdt geen GPS-rittenregistratie bij. Een eigen provideraccount, billing en toepasselijke gebruiksvoorwaarden horen bij het aansluiten van een echte bron. Keys blijven op de server. De adressen worden bij de gekozen provider verwerkt; de POC slaat geen routegeometrie of coördinaten op.

## Geldigheidscombinaties

AFAS kan maximaal drie grondslagen combineren: onder andere project/projectgroep, item/integratiegroep, medewerker/functie en dimensies. Teamrechten en de declaratiesoort-kostensoortkoppeling kunnen aanvullend beperken wat is toegestaan. Een declaratiesoort is daarom niet automatisch dezelfde code als het item uit de geldigheidscombinatie.

De lookup verwacht **uitgewerkte toegestane combinaties**, niet de ruwe `VaV1/BaV1`-velden van PtValComb. Los de toepasselijke grondslagen, groepen, teams en itemkoppeling eerst op in de AFAS-export/GetConnector of een omgevingsspecifieke integratielaag. Lever deze kolommen aan:

| Kolom | Betekenis |
| --- | --- |
| Medewerker | Daadwerkelijke medewerkercode; leeg is bewust alle medewerkers |
| Project | Daadwerkelijke projectcode; leeg is bewust alle projecten |
| Declaratiesoort | Code voor HrDeclarationInSite.BiId; leeg is bewust alle soorten |
| Begindatum | Inclusief, JJJJ-MM-DD; leeg is geen ondergrens |
| Einddatum | Inclusief, JJJJ-MM-DD; leeg is geen bovengrens |

Alle kolommen moeten aanwezig zijn, ook als een waarde bewust leeg is. Een ontbrekende kolom of ongeldige datum wordt geweigerd. Een lege lijst staat geen enkele combinatie toe. De POC ondersteunt import van JSON (`[]` of `{ "rows": [] }`), CSV en XLSX. Een upload vervangt de combinaties alleen voor de huidige sessie; opnieuw openen leest de geconfigureerde lookup.

Voor live lookups: `AFAS_BASE_URL`, `AFAS_TOKEN`, `AFAS_PROJECTS_GETCONNECTOR`, `AFAS_DECLARATION_TYPES_GETCONNECTOR`, `AFAS_VALIDITY_GETCONNECTOR`. Veldnamen zijn instelbaar via de variabelen in `.env.example`. De soortlookup kan `Invoertype` bevatten met `kosten` of `kilometers`; dan bepaalt de declaratiesoort automatisch de invoer. Zonder die informatie kiest de gebruiker het invoertype expliciet. De server leest gepagineerd maximaal 50.000 regels per lookup. Gebruik een stabiele unieke sortering in de GetConnector. Een falende of onvolledig ingestelde live koppeling levert een fout en geen demotoestemmingen op.

Zonder AFAS-configuratie gebruikt de POC uitsluitend herkenbare demogegevens. Deze demonstreren ook een beperkte OV-combinatie die alleen in oktober 2026 geldt.

## Kilometerbestand importeren

Verplicht: `Datum`, `Van`, `Naar`, `Kilometers`, `Typecode`, `Project`. Optioneel: `Retour` (ja/nee) en `Omschrijving`. Kilometers is altijd het totale te declareren aantal, ook bij retour. Gebruik maximaal twee decimalen zonder duizendtalscheiding. Datums: JJJJ-MM-DD, een Excel-datum of DD-MM-JJJJ. Per bestand maximaal 500 regels / 3 MB. Bij een fout wordt geen enkele regel uit het bestand toegevoegd. Wijzig een geïmporteerde regel om de afstand alsnog bij Google/TomTom te berekenen.

## Officiële bronnen

- [AFAS afstandsberekening](https://www.afas.help/vraagantwoord/NL/SE/137667.htm)
- [AFAS Google Maps](https://www.afas.help/meldingen/NL/SE/137646.htm)
- [AFAS TomTom (ANWB)](https://afas.help/vraagantwoord/nl/se/137510.htm)
- [Google Compute Routes](https://developers.google.com/maps/documentation/routes/compute_route_directions)
- [Google Route Matrix voor veel combinaties](https://developers.google.com/maps/documentation/routes/compute_route_matrix)
- [TomTom Calculate Route](https://docs.tomtom.com/routing-api/documentation/tomtom-maps/v1/calculate-route)
- [TomTom Geocode](https://docs.tomtom.com/geocoding-api/documentation/tomtom-maps/v1/geocode)
- [ANWB routeplanner en TomTom](https://www.anwb.nl/verkeer/routeplanner/veelgestelde-vragen)
- [AFAS geldigheidscombinaties](https://www.afas.help/help/NL/SE/Pro_Config_VldCmb.htm)
- [AFAS declaraties en projectintegratie](https://afas.help/meldingen/nl/se/Hrm_Config_Declrs_2.htm)
- [AFAS HrDeclarationInSite: toevoegen](https://help.afas.nl/help/NL/SE/App_Conect_UpdDsc_HrDecl_InSite.htm)
