import fs from "node:fs";
import path from "node:path";

const sourceRoot = path.resolve(process.argv[2] || "../.afas-oas");
const specsDir = path.join(sourceRoot, "OpenApiSpecs", "profit", "nl");
const examplesDir = path.join(sourceRoot, "OpenApiSpecs", "profit", "examples");
const outputDir = path.resolve("data", "connectors");

if (!fs.existsSync(specsDir)) {
  console.error(`AFAS OpenAPI-bron niet gevonden: ${specsDir}`);
  process.exit(1);
}

const connectors = new Map();
const versions = new Set();

for (const file of fs.readdirSync(specsDir).filter((name) => name.endsWith(".json"))) {
  const group = path.basename(file, ".json");
  const spec = JSON.parse(fs.readFileSync(path.join(specsDir, file), "utf8"));
  if (spec.info?.version) versions.add(spec.info.version);

  for (const [endpointPath, pathItem] of Object.entries(spec.paths || {})) {
    const match = endpointPath.match(/^\/connectors\/([^/]+)$/);
    if (!match) continue;
    // De groepsspecs bevatten ook voorbeeld-GetConnectors. De schemabank is
    // uitsluitend voor muterende UpdateConnectors.
    if (!["post", "put", "delete"].some((method) => pathItem[method])) continue;
    const id = match[1];
    const connector = connectors.get(id) || {
      id,
      group,
      description: "",
      methods: new Set(),
      schemas: [],
      examples: [],
      responses: [],
      documentation_url: "",
    };

    for (const method of ["post", "put", "delete"]) {
      const operation = pathItem[method];
      if (!operation) continue;
      const upperMethod = method.toUpperCase();
      connector.methods.add(upperMethod);
      connector.description ||= operation.summary || "";

      const docsUrl = String(operation.description || "").match(/https?:\/\/[^\s]+/i)?.[0];
      if (docsUrl) connector.documentation_url ||= docsUrl;

      const media = operation.requestBody?.content?.["application/json"];
      const ref = media?.schema?.$ref;
      if (ref) {
        const schemaName = ref.split("/").pop();
        const schema = spec.components?.schemas?.[schemaName];
        if (schema && !connector.schemas.some((item) => item.method === upperMethod)) {
          connector.schemas.push({
            connector_id: id,
            method: upperMethod,
            language: "nl",
            group,
            schema,
            source_file: `profit/nl/${file}`,
          });
        }
      }

      for (const [name, example] of Object.entries(media?.examples || {})) {
        if (!("value" in example)) continue;
        connector.examples.push({
          connector_id: id,
          name: safeName(name),
          method_hint: upperMethod,
          relative_path: `inline/${method}/${safeName(name)}.json`,
          payload: example.value,
          official: true,
        });
      }

      for (const [status, response] of Object.entries(operation.responses || {})) {
        const responseMedia = response?.content?.["application/json"];
        for (const [name, example] of Object.entries(responseMedia?.examples || {})) {
          if (!("value" in example)) continue;
          connector.responses.push({
            method: upperMethod,
            status,
            description: response.description || "",
            name,
            payload: example.value,
          });
        }
      }
    }

    connectors.set(id, connector);
  }

  // AFAS publiceert soms al een officieel schema voordat het pad in dezelfde
  // specificatie staat (op dit moment o.a. KnCustomLinkC02). Neem zo'n schema
  // wel op en markeer het niet ten onrechte als ontbrekend.
  for (const [schemaName, schema] of Object.entries(spec.components?.schemas || {})) {
    const match = schemaName.match(/^(.*)_(POST|PUT)$/);
    if (!match) continue;
    const [, id, method] = match;
    if (connectors.get(id)?.schemas.some((item) => item.method === method)) continue;
    const connector = connectors.get(id) || {
      id,
      group,
      description: fallbackDescription(id),
      methods: new Set(),
      schemas: [],
      examples: [],
      responses: [],
      documentation_url: "",
    };
    connector.methods.add(method);
    connector.schemas.push({
      connector_id: id,
      method,
      language: "nl",
      group,
      schema,
      source_file: `profit/nl/${file}`,
    });
    connectors.set(id, connector);
  }
}

// Losse officiële voorbeeldbestanden hebben voorrang op gelijknamige inline voorbeelden.
for (const connector of connectors.values()) {
  const connectorExamples = path.join(examplesDir, connector.id);
  if (!fs.existsSync(connectorExamples)) continue;
  for (const file of walkFiles(connectorExamples).filter((name) => name.endsWith(".json"))) {
    const relative = path.relative(connectorExamples, file).replaceAll("\\", "/");
    const [methodFolder] = relative.split("/");
    let payload;
    try {
      payload = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      continue;
    }
    const item = {
      connector_id: connector.id,
      name: path.basename(file, ".json"),
      method_hint: methodFolder.toUpperCase(),
      relative_path: relative,
      payload,
      official: true,
    };
    const duplicateIndex = connector.examples.findIndex(
      (example) =>
        example.method_hint === item.method_hint &&
        JSON.stringify(example.payload) === JSON.stringify(item.payload)
    );
    if (duplicateIndex >= 0) connector.examples.splice(duplicateIndex, 1, item);
    else connector.examples.push(item);
  }
}

fs.mkdirSync(outputDir, { recursive: true });
const sourceVersion = [...versions].sort().at(-1) || "onbekend";
for (const file of fs.readdirSync(outputDir).filter((name) => name.endsWith(".json"))) {
  if (!connectors.has(path.basename(file, ".json"))) fs.rmSync(path.join(outputDir, file));
}
const index = [...connectors.values()]
  .sort((a, b) => a.id.localeCompare(b.id))
  .map((connector) => {
    const methods = [...connector.methods].sort(methodSort);
    const connectorInfo = {
      id: connector.id,
      group: connector.group,
      description: connector.description,
      methods,
      schema_count: connector.schemas.length,
      example_count: connector.examples.length,
      response_count: connector.responses.length,
      source_version: sourceVersion,
      documentation_url: connector.documentation_url || undefined,
    };
    const detail = {
      connector: connectorInfo,
      schemas: connector.schemas.sort((a, b) => methodSort(a.method, b.method)),
      examples: connector.examples,
      responses: connector.responses,
    };
    fs.writeFileSync(
      path.join(outputDir, `${connector.id}.json`),
      JSON.stringify(detail),
      "utf8"
    );
    return connectorInfo;
  });

fs.writeFileSync(path.resolve("data", "index.json"), JSON.stringify(index), "utf8");
fs.writeFileSync(
  path.resolve("data", "source.json"),
  JSON.stringify(
    {
      name: "AFASSoftware/OASContent",
      url: "https://github.com/AFASSoftware/OASContent",
      version: sourceVersion,
      connector_count: index.length,
      schema_count: index.reduce((sum, item) => sum + item.schema_count, 0),
      example_count: index.reduce((sum, item) => sum + item.example_count, 0),
    },
    null,
    2
  ),
  "utf8"
);

console.log(
  `Gesynchroniseerd: ${index.length} connectors, ${index.reduce((s, x) => s + x.schema_count, 0)} schema's en ${index.reduce((s, x) => s + x.example_count, 0)} voorbeelden (AFAS ${sourceVersion}).`
);

function safeName(value) {
  return String(value).trim().replace(/[^a-z0-9_-]+/gi, "_").replace(/^_+|_+$/g, "") || "voorbeeld";
}

function fallbackDescription(id) {
  const customFile = id.match(/^KnCustomK(\d+)$/);
  if (customFile) return `Vrij bestand ${Number(customFile[1])}`;
  const customContact = id.match(/^KnCustomLinkC(\d+)$/);
  if (customContact) return `Vrij contactbestand ${Number(customContact[1])}`;
  return id;
}

function walkFiles(folder) {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(folder, entry.name);
    return entry.isDirectory() ? walkFiles(fullPath) : [fullPath];
  });
}

function methodSort(a, b) {
  const order = { POST: 0, PUT: 1, DELETE: 2 };
  return (order[a] ?? 9) - (order[b] ?? 9);
}
