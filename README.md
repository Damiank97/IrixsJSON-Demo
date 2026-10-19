# Irixs Toolbox (By Damian)

Interne AFAS-toolbox met vier onderdelen:

- **PURE 9 → PURE 10** — zet een PURE 9-planning en de export van de
  `Voorcalculatieregels` GetConnector om naar een direct importeerbare PURE
  10-CSV.
- **Config 9 → 10** — zet het PURE 9 `app.config`-bestand om naar een complete
  Azure App Configuration KVSet-import, inclusief planningstypes, HEX-kleuren,
  perioden en klantgebonden autorisatiegroepen.
- **JSON Schemabank** — doorzoek 201 AFAS UpdateConnectors en bekijk schema's
  en voorbeeld-payloads.
- **Declaraties** — POC voor één maandconcept met meerdere declaratieregels,
  bewerkbare conceptregels, AFAS-lookups/geldigheidscombinaties, bonherkenning,
  Google/TomTom-afstanden en afzonderlijke `HrDeclarationInSite`-payloads.
  Zie [inrichting en bronnen](docs/declaraties.md) en `.env.example`.

## PURE-migratie

Werkwijze:

1. Download en importeer `PURE 9 weergave voor export.viw` in PURE 9 en
   exporteer daarmee vrije bestandswaarden 09.
2. Download en importeer `Voorcalculatieregels.gcn` en exporteer de
   GetConnector.
3. Upload beide exports (`.xlsx`, `.xls`, `.csv` of `.tsv`) en voer de
   conversie uit.
4. Download de PURE 10-CSV. `Import PURE10.ipd` kan daarbij optioneel meteen of
   later los worden gedownload.

De Toolbox controleert onder andere verplichte velden, GUID-matches, dubbele
Event-guid's, werksoorttype `Wst`, datums, uren en perioden. Alleen na een
foutloze controle wordt de PURE 10-CSV beschikbaar. De uitvoer gebruikt de
bewezen vaste 22-kolomsvolgorde, puntkomma's, Nederlandse decimale komma's,
UTF-8 BOM en CRLF-regelafbrekingen.

Alle drie de AFAS-definitiebestanden zijn rechtstreeks in de PURE-tool te
downloaden.

## Configuratiemigratie

Vul de klantprefix in en upload het PURE 9 `app.config`-bestand. De converter
neemt klantinstellingen over, vult de neutrale PURE 10-structuur aan en zet
custom GetConnector-vlaggen standaard uit. Klantspecifieke filters worden niet
overgenomen. Verhoogde autorisatierollen op `Iedereen`, onbekende kleuren en
niet-ondersteunde velden worden vóór de download gemeld. Naast de KVSet JSON is
een volledig mappingrapport beschikbaar.

## Lokaal draaien

```bash
npm install
npm run dev
```

Open daarna <http://localhost:3000>.

## Productiebuild

```bash
npm run build
npm start
```

Zonder AFAS-instellingen gebruikt de declaratie-POC neutrale demo-opties. Voor
live lookups zijn de volgende Vercel environment variables nodig:

- `AFAS_BASE_URL` — bijvoorbeeld `https://12345.rest.afas.online/ProfitRestServices`
- `AFAS_TOKEN`
- `AFAS_PROJECTS_GETCONNECTOR`
- `AFAS_DECLARATION_TYPES_GETCONNECTOR`
- `AFAS_VALIDITY_GETCONNECTOR` — uitgewerkte combinaties met datumgrenzen
- `GOOGLE_MAPS_API_KEY` en/of `TOMTOM_API_KEY` — echte afstandsberekening
- Optioneel: `AFAS_PROJECT_CODE_FIELD`, `AFAS_PROJECT_LABEL_FIELD`,
  `AFAS_DECLARATION_TYPE_CODE_FIELD` en `AFAS_DECLARATION_TYPE_LABEL_FIELD`

`GROQ_API_KEY` activeert de bonherkenning en de bestaande JSON-verrijking. Alle
geheime waarden blijven server-side en worden nooit naar de browser gestuurd.
