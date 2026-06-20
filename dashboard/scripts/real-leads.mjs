import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
// Gerçek isimli, adresli, vergi borçlu sahipler (placeholder/jenerik hariç)
let rows=[],from=0;
while(true){
  const {data,error}=await sb.from("tax_delinquent_properties")
    .select("state,county,apn,owner_name,owner_address,property_address,acres,minimum_bid,judgment_amount,source")
    .not("owner_name","is",null).not("owner_address","is",null)
    .range(from,from+999);
  if(error){console.error(error.message);break;}
  rows.push(...data); if(data.length<1000)break; from+=1000; if(from>40000)break;
}
const generic=/absentee|owner|unknown|n\/a|test|^\s*$/i;
const leads=[];
for(const r of rows){
  const o=(r.owner_name||"").trim(); if(o.length<4||generic.test(o)) continue;
  const owed=+r.minimum_bid||+r.judgment_amount||0; if(!(owed>0)) continue;
  const m=(r.owner_address||"").toUpperCase().match(/,\s*([A-Z]{2})\s+\d{5}/);
  const absentee = m && m[1]!==(r.state||"").toUpperCase();
  leads.push({state:r.state,county:r.county,apn:r.apn,owner:o,owner_addr:(r.owner_address||"").replace(/\s+/g," ").trim(),prop:r.property_address||"",acres:r.acres??"",owed,absentee:!!absentee});
}
// absentee + düşük borç (ucuz kapatılır) öne
leads.sort((a,b)=>(b.absentee-a.absentee)||(a.owed-b.owed));
const byState={}; for(const l of leads) byState[l.state]=(byState[l.state]||0)+1;
console.log("Toplam gerçek-isimli lead:",leads.length,"| absentee:",leads.filter(l=>l.absentee).length);
console.log("Eyalet dağılımı:",byState);
const cols=["state","county","apn","owner","owner_addr","prop","acres","owed","absentee"];
fs.writeFileSync("/tmp/OFFMARKET-LEADS.csv",[cols.join(",")].concat(leads.map(l=>cols.map(k=>`"${(l[k]??"").toString().replace(/"/g,'""')}"`).join(","))).join("\n"));
console.log("\n=== TOP 18 (absentee + düşük borç) — bunlara mektup ===");
for(const l of leads.slice(0,18)) console.log(`${l.absentee?"📮":"  "} ${l.county},${l.state} · borç $${l.owed.toLocaleString()} · ${l.acres?l.acres+"ac":"dönüm?"} · ${l.owner.slice(0,26)} | ${l.owner_addr.slice(0,40)}`);
console.log("\nCSV: /tmp/OFFMARKET-LEADS.csv");
