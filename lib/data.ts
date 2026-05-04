import "server-only";
import { promises as fs } from "fs";
import path from "path";

export type ConnectorIndexItem = {
  id: string;
  group: string;
  description: string;
  methods: string[];
  schema_count: number;
  example_count: number;
};

export type ConnectorSchema = {
  connector_id: string;
  method: "POST" | "PUT" | "DELETE";
  language: string;
  group: string;
  schema: unknown;
  source_file: string;
};

export type ConnectorExample = {
  connector_id: string;
  name: string;
  method_hint: string;
  relative_path: string;
  payload: unknown;
};

export type ConnectorDetail = {
  connector: ConnectorIndexItem & { description: string };
  schemas: ConnectorSchema[];
  examples: ConnectorExample[];
};

const DATA_DIR = path.join(process.cwd(), "data");

export async function loadIndex(): Promise<ConnectorIndexItem[]> {
  const raw = await fs.readFile(path.join(DATA_DIR, "index.json"), "utf-8");
  return JSON.parse(raw);
}

export async function loadConnector(id: string): Promise<ConnectorDetail | null> {
  try {
    const raw = await fs.readFile(
      path.join(DATA_DIR, "connectors", `${id}.json`),
      "utf-8"
    );
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function loadAllIds(): Promise<string[]> {
  const items = await loadIndex();
  return items.map((c) => c.id);
}
