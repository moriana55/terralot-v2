import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const U = process.env.NEXT_PUBLIC_SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(U, K, { auth: { persistSession: false } });
const STATES = ["TX","FL","AZ","NM","CO"];
const PPA_MIN=500, PPA_MAX=250000;

// 1) competitor_listings -> state medyan $/acre
const { data: comps } = await sb.from("competitor_listings").select("state,price,acres").limit(5000);
const byState = {};
for (const c of comps||[]) {
  const p=+c.price, a=+c.acres; if(!(p>0&&a>0)) continue;
  const ppa=p/a; if(ppa<PPA_MIN||ppa>PPA_MAX) continue;
  const s=(c.state||"").toString().trim().toUpperCase().slice(0,2);
  (byState[s]??=[]).push(ppa);
}
const medPPA={}; for(const s in byState){const a=byState[s].sort((x,y)=>x-y);medPPA[s]=Math.round(a[a.length>>1]);}
console.log("State medyan $/acre:", medPPA);

// 2) tax_delinquent: hedef eyalet + dönüm + sahip var
let rows=[], from=0;
while(true){
  const { data, error } = await sb.from("tax_delinquent_properties")
    .select("state,county,apn,owner_name,owner_address,property_address,acres,minimum_bid,judgment_amount,lat,lng,raw_url,source")
    .in("state",STATES).not("acres","is",null).not("owner_name","is",null)
    .range(from,from+999);
  if(error){console.error(error.message);break;}
  rows.push(...data); if(data.length<1000)break; from+=1000;
}
console.log("Aday ham (hedef eyalet + dönüm + sahip):", rows.length);

const bulk=(ppa,ac)=> ac<=5?ppa:Math.round(ppa*Math.max(0.12,Math.sqrt(5/ac)));
const cands=[];
for(const r of rows){
  const ac=+r.acres; if(!(ac>=0.05&&ac<=1000)) continue;
  const ppa=medPPA[(r.state||"").toUpperCase()]; if(!ppa) continue;
  const val=Math.round(ac*bulk(ppa,ac));
  const acq=+r.minimum_bid||0; if(!(acq>0)) continue;
  const margin=Math.round((1-acq/val)*100);
  if(margin<25||margin>75) continue;            // gerçekçi bant
  const ownerSt=(r.owner_address||"").toUpperCase().match(/,\s*([A-Z]{2})\s*\d{5}/);
  const absentee = ownerSt && ownerSt[1]!==(r.state||"").toUpperCase();
  cands.push({state:r.state,county:r.county,apn:r.apn,acres:ac,acq,val,margin,absentee:!!absentee,owner:r.owner_name,owner_addr:r.owner_address,prop_addr:r.property_address,lat:r.lat,lng:r.lng,src:r.source});
}
// absentee + marj sırala
cands.sort((a,b)=> (b.absentee-a.absentee) || (b.margin-a.margin));
console.log("GERÇEK ADAY (comp+dönüm+sahip, %25-75 marj):", cands.length, "| absentee:", cands.filter(c=>c.absentee).length);

// CSV
const cols=["state","county","apn","acres","acq","val","margin","absentee","owner","owner_addr","prop_addr","lat","lng","src"];
const csv=[cols.join(",")].concat(cands.map(c=>cols.map(k=>`"${(c[k]??"").toString().replace(/"/g,'""')}"`).join(","))).join("\n");
fs.writeFileSync("/tmp/GERCEK-ADAYLAR.csv",csv);
console.log("\n=== TOP 15 (absentee öncelikli) ===");
for(const c of cands.slice(0,15)) console.log(`${c.absentee?"📮":"  "} ${c.county},${c.state} ${c.acres}ac · alış $${c.acq.toLocaleString()} → değer $${c.val.toLocaleString()} · %${c.margin} · ${c.owner?.slice(0,22)}`);
console.log("\nCSV: /tmp/GERCEK-ADAYLAR.csv");
