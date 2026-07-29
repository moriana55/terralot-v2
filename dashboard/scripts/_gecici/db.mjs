// Geçici keşif yardımcısı — Supabase service-role istemcisi
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "../..");
const env = Object.fromEntries(
  fs.readFileSync(path.join(root, ".env.local"), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; })
);
export const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
export const ENV = env;
export const ROOT = root;
