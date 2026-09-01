# Irixs Toolbox (By Damian)

Interne AFAS-toolbox met drie onderdelen:

- **PURE 9 → PURE 10** — zet een PURE 9-planning en de export van de
  `Voorcalculatieregels` GetConnector om naar een direct importeerbare PURE
  10-CSV.
- **Config 9 → 10** — zet het PURE 9 `app.config`-bestand om naar een complete
  Azure App Configuration KVSet-import, inclusief planningstypes, HEX-kleuren,
  perioden en klantgebonden autorisatiegroepen.
- **JSON Schemabank** — doorzoek 201 AFAS UpdateConnectors en bekijk schema's
  en voorbeeld-payloads.

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

Er zijn geen environment variables nodig. De site kan rechtstreeks vanuit deze
repository door Vercel worden gebouwd.
