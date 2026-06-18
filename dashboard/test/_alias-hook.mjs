import { pathToFileURL } from "node:url";
import { dirname, resolve as resolvePath, extname } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = resolvePath(dirname(fileURLToPath(import.meta.url)), "..", "src");

// Resolves the project's "@/..." alias (tsconfig paths -> ./src/*) for `node --test`.
// Appends a .ts/.tsx extension or /index.ts when the bare path has none.
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    let target = resolvePath(SRC, specifier.slice(2));
    if (!extname(target) || !existsSync(target)) {
      for (const cand of [target + ".ts", target + ".tsx", resolvePath(target, "index.ts")]) {
        if (existsSync(cand)) { target = cand; break; }
      }
    }
    return nextResolve(pathToFileURL(target).href, context);
  }
  return nextResolve(specifier, context);
}
