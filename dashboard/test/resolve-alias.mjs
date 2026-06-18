// Minimal ESM resolve hook so `node --test` can resolve the project's "@/..."
// path alias (mapped to ./src/* in tsconfig). No extra dependencies.
import { register } from "node:module";
import { pathToFileURL } from "node:url";
register("./_alias-hook.mjs", pathToFileURL(import.meta.dirname + "/"));
