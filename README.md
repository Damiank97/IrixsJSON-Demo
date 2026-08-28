# Irixs Toolbox (By Damian)

Interne AFAS-toolbox met twee onderdelen:

- **PURE 9 → PURE 10** — zet een PURE 9-planning en de export van de
  `Voorcalculatieregels` GetConnector om naar een direct importeerbare PURE
  10-CSV.
- **JSON Schemabank** — doorzoek 201 AFAS UpdateConnectors en bekijk schema's
  en voorbeeld-payloads.

## PURE-migratie

De migratie draait volledig lokaal in de browser. Er worden geen klantgegevens
naar een server of AI-model gestuurd.

Benodigd:

1. Een export van vrije bestandswaarden 09 uit PURE 9 (`.xlsx`, `.xls`, `.csv`
   of `.tsv`).
2. Een export van de meegeleverde `Voorcalculatieregels.gcn` GetConnector.

De Toolbox controleert onder andere verplichte velden, GUID-matches, dubbele
Event-guid's, werksoorttype `Wst`, datums, uren en perioden. Alleen na een
foutloze controle wordt de PURE 10-CSV beschikbaar. De uitvoer gebruikt de
bewezen vaste 22-kolomsvolgorde, puntkomma's, Nederlandse decimale komma's,
UTF-8 BOM en CRLF-regelafbrekingen.

De bestanden `Voorcalculatieregels.gcn` en `Import PURE10.ipd` zijn rechtstreeks
in de PURE-tool te downloaden.

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
