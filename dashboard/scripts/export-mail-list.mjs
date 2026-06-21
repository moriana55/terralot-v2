// Borçlu arsa sahipleri — mail atılabilir GERÇEK liste (off-market model).
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data } = await s.from("tax_delinquent_properties")
  .select("owner_name,owner_address,property_address,county,state,judgment_amount,source")
  .not("owner_name", "is", null).not("owner_name", "ilike", "%unknown%")
  .not("owner_address", "is", null).not("owner_address", "ilike", "%unknown%")
  .order("judgment_amount", { ascending: true });

const rows = (data || []).filter(r => r.owner_address && r.property_address);
const esc = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
const note = (r) => {
  const a = [];
  if (/ESTATE OF/i.test(r.owner_name)) a.push("MIRAS-motive");
  const mp = (r.owner_address || "").toUpperCase(), pp = (r.property_address || "").toUpperCase();
  if (mp.slice(0, 12) !== pp.slice(0, 12)) a.push("absentee");
  if (/^0 /.test(r.property_address || "")) a.push("bos-arsa");
  return a.join("/");
};

let csv = "Sahip,Posta Adresi (mail),Arsa Adresi,County,Eyalet,Vergi Borcu,Tur,Not\n";
rows.forEach(r => {
  csv += [esc(r.owner_name), esc(r.owner_address), esc(r.property_address), esc(r.county), esc(r.state),
          esc(r.judgment_amount), esc((r.source || "").replace("TAX:LGBS:", "")), esc(note(r))].join(",") + "\n";
});
fs.writeFileSync("/Users/yigiterturk/Desktop/borclu-arsa-sahipleri.csv", csv);

const est = rows.filter(r => /ESTATE OF/i.test(r.owner_name)).length;
const abs = rows.filter(r => (r.owner_address || "").toUpperCase().slice(0, 12) !== (r.property_address || "").toUpperCase().slice(0, 12)).length;
const vac = rows.filter(r => /^0 /.test(r.property_address || "")).length;
console.log("Toplam mail atilabilir:", rows.length);
console.log("  miras (estate, cok motive):", est, "| absentee (uzakta oturan):", abs, "| bos arsa:", vac);
console.log("-> Desktop/borclu-arsa-sahipleri.csv");
process.exit(0);
