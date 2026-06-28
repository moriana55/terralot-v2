"use client";

import { useEffect, useState } from "react";
import {
  Compass, Search, Calculator, Mail, BadgeDollarSign, Database, ShieldCheck,
  Map as MapIcon, Building2, CheckCircle2, Clock, ArrowRight,
} from "lucide-react";

type Facets = { totalAll: number; byState: Record<string, number>; bySource: Record<string, number>; sourceLabels: Record<string, string> };

export default function SistemPage() {
  const [f, setF] = useState<Facets | null>(null);
  useEffect(() => {
    fetch("/api/admin/all-deals?pageSize=1").then((r) => r.json()).then(setF).catch(() => {});
  }, []);

  const states = f ? Object.entries(f.byState).sort((a, b) => b[1] - a[1]) : [];

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6 pb-24">
      {/* ── Başlık ── */}
      <header className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 p-8 text-white">
        <div className="text-xs font-semibold uppercase tracking-widest text-emerald-300">Terralot · Operasyon Anlatımı</div>
        <h1 className="mt-2 text-3xl font-black">Sistem &amp; Yöntem</h1>
        <p className="mt-2 max-w-2xl text-slate-300">
          ABD&apos;de ucuz boş arsayı <b className="text-white">bul → değerle → düşük teklifle al → taksitle pahalıya sat</b>.
          Bu ekran, her parselin ve her kararın arkasındaki veriyi ve mantığı kaynağıyla gösterir.
        </p>
        {f && (
          <div className="mt-5 flex flex-wrap gap-4">
            <Live n={f.totalAll.toLocaleString()} l="Sistemdeki deal" />
            <Live n={String(states.length)} l="Eyalet" />
            <Live n={String(Object.keys(f.bySource).length)} l="Veri kaynağı" />
          </div>
        )}
      </header>

      {/* ── 1. Döngü ── */}
      <Section icon={<Compass className="h-5 w-5" />} title="1 · İş Modeli — 5 Adımlık Döngü"
        sub="Rakiplerin (Discount Lots, Compass, LANDiO) yaptığı işin birebir akışı.">
        <div className="grid gap-3 md:grid-cols-5">
          {[
            { i: <Search className="h-5 w-5" />, t: "BUL", d: "Boş + absentee + vergi-borçlu arsa" },
            { i: <Calculator className="h-5 w-5" />, t: "DEĞERLE", d: "Comps ile gerçek piyasa değeri" },
            { i: <Mail className="h-5 w-5" />, t: "AL", d: "Blind offer = değerin %15–25'i" },
            { i: <BadgeDollarSign className="h-5 w-5" />, t: "SAT", d: "Owner-finance %9–11, 60 ay" },
            { i: <ArrowRight className="h-5 w-5" />, t: "KÂR", d: "2x–5x · deal başı $5K–18K" },
          ].map((s) => (
            <div key={s.t} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">{s.i}</div>
              <div className="mt-2 text-sm font-bold text-slate-900">{s.t}</div>
              <div className="text-xs text-slate-500">{s.d}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 2. Veri kaynakları ── */}
      <Section icon={<Database className="h-5 w-5" />} title="2 · Veri Kaynakları — “bu liste nereden geliyor?”"
        sub="Her satırın kaynağı belli. Uydurma yok; resmi/halka açık veri.">
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr><th className="px-4 py-2">Kaynak</th><th className="px-4 py-2">Ne sağlar</th><th className="px-4 py-2">Köken</th><th className="px-4 py-2 text-right">Adet</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <SrcRow k="Mohave Off-Market" v="20K boş parsel, sahip+adres, değer" o="Mohave County ParcelQueryLayer (ArcGIS, halka açık)" n={f?.bySource?.mohave} />
              <SrcRow k="Gerçek Dealler (Dallas)" v="Vergi-borçlu lotlar, spread" o="Dallas CAD (DCAD) + Regrid" n={f?.bySource?.dallas} />
              <SrcRow k="Ucuz Boş Arsa" v="Çoklu eyalet, skorlu fırsat" o="Tax-deed listeleri + Regrid değerleme" n={f?.bySource?.["cheap-land"]} />
              <SrcRow k="PropStream — Luna NM" v="Absentee + boş arazi" o="PropStream export (NM Luna County)" n={f?.bySource?.["propstream-nm"]} />
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-400">Enrichment: <b>Regrid</b> (parsel/sahip/kullanım) · değerleme eyaletten bağımsız.</p>
      </Section>

      {/* ── 3. Scrub ── */}
      <Section icon={<ShieldCheck className="h-5 w-5" />} title="3 · Scrub Kriterleri — “bu arsa neden iyi/kötü?”"
        sub="Her parsel bu faktörlerle elenir. Land Insights'ın AI-scrub'ının birebir karşılığı.">
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr><th className="px-4 py-2">Faktör</th><th className="px-4 py-2">Ne bakar</th><th className="px-4 py-2">Kırmızı çizgi</th><th className="px-4 py-2">Kaynak</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <ScrubRow f="🌊 Sel riski" w="FEMA flood zone" r="Zone A/V = ELE" s="FEMA NFHL (gerçek API)" />
              <ScrubRow f="🛣️ Yol erişimi" w="En yakın yola mesafe" r="Landlocked = ELE" s="OpenStreetMap (gerçek API)" />
              <ScrubRow f="📐 Boyut" w="Parsel acre'ı" r="0.2–5 acre ideal" s="Parsel verisi" />
              <ScrubRow f="👤 Sahip" w="Mailing eyaleti ≠ arsa eyaleti" r="Absentee = hedef" s="Mailing adresi" />
              <ScrubRow f="🏷️ Kullanım" w="Boş arazi mi" r="Vacant olmalı" s="County use code" />
              <ScrubRow f="💵 Değerleme" w="Spread + önerilen teklif" r="Teklif = değer × %20" s="Comps / assessed" />
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-400">“Tüm Dealler” sayfasında her satırdaki <b>🛡️ Scrub</b> butonu bu raporu A–F notu + AL/İNCELE/ELE kararıyla canlı üretir.</p>
      </Section>

      {/* ── 4. Eyalet stratejisi ── */}
      <Section icon={<MapIcon className="h-5 w-5" />} title="4 · Eyalet Stratejisi — “neden bu eyaletler?”"
        sub="Ucuz $/acre + kolay subdivide + gevşek düzenleme. (Kaynak: state statutes + county GIS, doğrulandı.)">
        <div className="grid gap-3 md:grid-cols-3">
          <TierCard tier="TIER 1 — İlk hedef" tone="emerald" items={[["New Mexico", "~$725/acre · en ucuz"], ["Texas", "Hudspeth $200–500/acre"], ["Arizona", "Mohave/Cochise · çöl lot"]]} />
          <TierCard tier="TIER 2 — Çok iyi" tone="sky" items={[["Nevada", "~$1.230"], ["Wyoming", "~$1.000 · vergi yok"], ["Arkansas / Oklahoma", "~$2.5K · düz, yeşil"]]} />
          <TierCard tier="🔴 KAÇIN" tone="rose" items={[["California", "$12K+ · bürokrasi"], ["New York", "5-5-3 kuralı"], ["NJ / MA / PA", "pahalı, sıkı"]]} />
        </div>
      </Section>

      {/* ── 5. Teklif & satış matematiği ── */}
      <Section icon={<Calculator className="h-5 w-5" />} title="5 · Teklif &amp; Satış Matematiği"
        sub="Rakamların hepsi yol haritasıyla hizalı — Ahmet sorduğunda gerekçesi hazır.">
        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <h4 className="font-bold text-slate-900">Alış (blind offer)</h4>
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              <li>• Teklif = <b>piyasa değeri × %15–25</b> (≤$10K parselde %15)</li>
              <li>• Beklenen yanıt %1–3 · kapanış %0.5–1</li>
              <li>• 1.000 mektup ≈ <b>1–3 deal</b></li>
              <li>• ⚠️ Assessed value çıpa DEĞİL — sadece comps</li>
            </ul>
          </Card>
          <Card>
            <h4 className="font-bold text-slate-900">Satış (owner-finance)</h4>
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              <li>• Faiz <b>%9–11</b> · peşinat $500–%10 · vade 60 ay</li>
              <li>• Kredi kontrolü / ön ödeme cezası yok</li>
              <li>• Tahsilat: GeekPay · İmza: SignNow</li>
              <li>• Hedef: %20–40&apos;a al, %50–80&apos;e sat = <b>2x–5x ROI</b></li>
            </ul>
          </Card>
        </div>
      </Section>

      {/* ── 6. Rakip kıyas ── */}
      <Section icon={<Building2 className="h-5 w-5" />} title="6 · Rakip Kıyaslaması — “bunu kim yapıyor?”"
        sub="Hepsi WebSearch ile doğrulandı.">
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Rakip</th><th className="px-4 py-2">Model</th><th className="px-4 py-2">Bizim aldığımız ders</th></tr></thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              <tr><td className="px-4 py-2 font-semibold">Discount Lots</td><td className="px-4 py-2">~1.500 deal/yıl, off-market al-sat</td><td className="px-4 py-2">Ölçek kanıtı = hedef model</td></tr>
              <tr><td className="px-4 py-2 font-semibold">Compass Land USA</td><td className="px-4 py-2">2–10 kişi, 0.16–1.16 acre, %7.9/60ay</td><td className="px-4 py-2">Yalın başlangıç şablonu</td></tr>
              <tr><td className="px-4 py-2 font-semibold">LANDiO</td><td className="px-4 py-2">NM/CO/AZ, BLM komşusu, YouTube</td><td className="px-4 py-2">Kademeli faiz + pazarlama</td></tr>
              <tr><td className="px-4 py-2 font-semibold">Land Insights</td><td className="px-4 py-2">AI scrub + 5dk değerleme ($5K/yıl)</td><td className="px-4 py-2">Terralot scrub motorunun rakibi</td></tr>
              <tr><td className="px-4 py-2 font-semibold">PropStream</td><td className="px-4 py-2">160M kayıt, filtre+skip+mail ($99/ay)</td><td className="px-4 py-2">“Tüm Dealler” bunun yerini tutuyor</td></tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── 7. Durum ── */}
      <Section icon={<CheckCircle2 className="h-5 w-5" />} title="7 · Ne Yaptık / Ne Kaldı"
        sub="Dürüst durum panosu — yol haritasının ~%70'i kodda hazır.">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
            <div className="mb-2 flex items-center gap-2 font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Hazır</div>
            <ul className="space-y-1 text-sm text-slate-700">
              {["Birleşik deal tarayıcı (filtre + sıralama + CSV)", "Scrub scorecard (FEMA + OSM + değerleme)", "AI skorlama + grade (absentee/vacant)", "Blind-offer mektup şablonu + Lob entegrasyon", "Owner-finance calculator (APR/peşinat/vade)", "Çoklu eyalet veri (AZ/TX/NM + tax-deed)"].map((x) => (
                <li key={x} className="flex gap-2"><span className="text-emerald-500">✓</span>{x}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
            <div className="mb-2 flex items-center gap-2 font-bold text-amber-700"><Clock className="h-4 w-4" /> Sırada (demo için)</div>
            <ul className="space-y-1 text-sm text-slate-700">
              {["Florida deal seed (FL'ye genişleme kanıtı)", "Teklif mantığı = piyasa değeri × %20", "“Owner-Finance ile Sat” butonu + presetler", "Mektup → satışa-koy loop'unu kapat", "Lob canlı key + Stripe/GeekPay (demo sonrası)"].map((x) => (
                <li key={x} className="flex gap-2"><span className="text-amber-500">○</span>{x}</li>
              ))}
            </ul>
          </div>
        </div>
      </Section>
    </div>
  );
}

/* ── küçük yardımcılar ── */
function Live({ n, l }: { n: string; l: string }) {
  return (
    <div className="rounded-xl bg-white/10 px-4 py-2">
      <div className="text-2xl font-black">{n}</div>
      <div className="text-[11px] uppercase tracking-wide text-slate-300">{l}</div>
    </div>
  );
}
function Section({ icon, title, sub, children }: { icon: React.ReactNode; title: string; sub: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white">{icon}</div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500">{sub}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4">{children}</div>;
}
function SrcRow({ k, v, o, n }: { k: string; v: string; o: string; n?: number }) {
  return (
    <tr>
      <td className="px-4 py-2 font-semibold text-slate-800">{k}</td>
      <td className="px-4 py-2 text-slate-600">{v}</td>
      <td className="px-4 py-2 text-xs text-slate-500">{o}</td>
      <td className="px-4 py-2 text-right font-mono text-slate-700">{n != null ? n.toLocaleString() : "—"}</td>
    </tr>
  );
}
function ScrubRow({ f, w, r, s }: { f: string; w: string; r: string; s: string }) {
  return (
    <tr>
      <td className="px-4 py-2 font-semibold text-slate-800">{f}</td>
      <td className="px-4 py-2 text-slate-600">{w}</td>
      <td className="px-4 py-2 text-slate-600">{r}</td>
      <td className="px-4 py-2 text-xs text-slate-500">{s}</td>
    </tr>
  );
}
function TierCard({ tier, tone, items }: { tier: string; tone: "emerald" | "sky" | "rose"; items: [string, string][] }) {
  const ring = tone === "emerald" ? "border-emerald-200" : tone === "sky" ? "border-sky-200" : "border-rose-200";
  const head = tone === "emerald" ? "text-emerald-700" : tone === "sky" ? "text-sky-700" : "text-rose-700";
  return (
    <div className={`rounded-xl border ${ring} bg-white p-4`}>
      <div className={`mb-2 text-xs font-bold uppercase tracking-wide ${head}`}>{tier}</div>
      <ul className="space-y-1.5 text-sm">
        {items.map(([a, b]) => (
          <li key={a}><span className="font-semibold text-slate-800">{a}</span> <span className="text-slate-500">— {b}</span></li>
        ))}
      </ul>
    </div>
  );
}
