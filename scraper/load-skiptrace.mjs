#!/usr/bin/env node
// Skip-trace edilmiş PropStream XLSX → offmarket_leads telefon/email güncelle.
// Önce: scraper/sql/add_contact_cols.sql çalıştır (phone1/phone2/email1/skiptraced).
import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
const FILE = process.argv[2] || "/Users/yigiterturk/Downloads/Property Export NM+LAND-2.xlsx";

// XLSX'i python ile JSON'a çevir (openpyxl)
const py = `
import openpyxl, json, sys
wb=openpyxl.load_workbook(${JSON.stringify(FILE)}, data_only=True); ws=wb.active
rows=list(ws.iter_rows(values_only=True)); hdr=[str(c).strip() if c is not None else "" for c in rows[0]]; idx={h:i for i,h in enumerate(hdr)}
def g(r,n):
    i=idx.get(n); return "" if i is None or r[i] is None else str(r[i]).strip()
out=[]
for r in rows[1:]:
    state=g(r,"State").upper()[:2]; apn=g(r,"APN")
    if not apn: continue
    ph=[g(r,x) for x in ["Phone 1","Phone 2","Phone 3","Phone 4","Phone 5"] if g(r,x)]
    em=[g(r,x) for x in ["Email 1","Email 2","Email 3","Email 4"] if g(r,x)]
    out.append({"lead_id":f"{state}-{apn}","phone1":ph[0] if ph else None,"phone2":ph[1] if len(ph)>1 else None,"email1":em[0] if em else None,"skiptraced":bool(ph or em)})
json.dump(out, sys.stdout)
`;
const recs = JSON.parse(execSync(`python3 -c ${JSON.stringify(py)}`, { encoding: "utf8", maxBuffer: 1<<26 }));
const hit = recs.filter(r => r.skiptraced);
console.log(`${recs.length} kayıt | telefon/mail dolu: ${hit.length}`);

const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let ok = 0, miss = false;
for (const r of recs) {
  const { error } = await s.from("offmarket_leads")
    .update({ phone1: r.phone1, phone2: r.phone2, email1: r.email1, skiptraced: r.skiptraced })
    .eq("lead_id", r.lead_id);
  if (error) {
    if (/column .* does not exist|Could not find/i.test(error.message)) { miss = true; break; }
  } else ok++;
}
if (miss) { console.error("\n❌ Kolonlar yok — önce scraper/sql/add_contact_cols.sql çalıştır (Supabase SQL Editor)."); process.exit(2); }
console.log(`✅ ${ok} kayıt güncellendi. Skip-traced (ulaşılabilir): ${hit.length}`);
