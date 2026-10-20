import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

// Isolated tests never read real provider keys or call external services.
export function loadTsModule(relative, { env = {}, fetch = () => { throw new Error("Unexpected external request"); } } = {}) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const nativeRequire = createRequire(import.meta.url), cache = new Map();
  function load(path) {
    if (cache.has(path)) return cache.get(path);
    const exports = {};
    cache.set(path, exports);
    const output = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const require = (name) => name.startsWith("@/") || name.startsWith(".")
      ? load(resolve(name.startsWith("@/") ? root : dirname(path), name.startsWith("@/") ? name.slice(2) : name).replace(/(?:\.ts)?$/, ".ts"))
      : nativeRequire(name);
    vm.runInNewContext(output, { exports, require, process: { env }, fetch, AbortSignal, URL, URLSearchParams }, { filename: path });
    return exports;
  }
  return load(resolve(root, relative));
}
