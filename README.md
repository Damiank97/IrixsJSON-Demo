# AFAS Schemabank — demo

Strakke, demo-klare frontend voor de schemabank. Toont alle 201 AFAS
UpdateConnectors met hun schema's en voorbeeld-payloads, met zoek- en
filtermogelijkheden.

## Lokaal draaien

```bash
npm install
npm run dev
```

→ open http://localhost:3000

## Deployen naar Vercel

```bash
npx vercel
```

Volg de prompts (eerste keer: inloggen, project linken). Na ~30s heb je
een live URL die je kunt delen voor de demo. Geen environment variables
nodig — alle data zit in `data/`.

## Wat erin zit

- **`data/index.json`** — lichte lijst van 201 connectors voor de homepage
- **`data/connectors/*.json`** — per connector: schema's + voorbeelden
- **`app/page.tsx`** — homepage met search en groep-filter
- **`app/connector/[id]/page.tsx`** — detail-pagina, statisch gegenereerd
- **`components/`** — `ConnectorBrowser` (zoek+filter) en `ConnectorDetailView` (tabs + JSON viewer)

## Data updaten

De data komt uit `parse_oascontent.py` (in de `afas-schemabank/` repo).
Om te updaten: draai die parser tegen een verse `git pull` van OASContent
en kopieer de output naar `data/`:

```bash
# Vanuit de afas-schemabank folder
python parse_oascontent.py
python split_for_demo.py    # nog te schrijven, of handmatig per connector
cp -r demo-data/* /pad/naar/afas-demo/data/
```

## Techstack

- Next.js 15 (App Router, RSC)
- React 19 RC
- Tailwind CSS 3
- TypeScript

## Design

- **Display**: Instrument Serif (Google Fonts)
- **Body**: Manrope (Google Fonts)
- **Mono**: JetBrains Mono (Google Fonts)
- **Palette**: cream canvas, ink-zwarte tekst, aubergine accent
- Subtiele paper-textuur via SVG noise-overlay

## Wat dit *niet* is

Deze demo heeft géén database, géén nightly sync, géén API-laag, géén auth.
Het is bewust de simpelste werkende versie om de waarde te laten zien. De
echte productie-architectuur (Postgres + sync-job + API) staat in de
`afas-schemabank/` repo klaar.
