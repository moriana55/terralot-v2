"use client";

/**
 * ⚔️ RAKİP DEFTERİ — Discount Lots (WP RE Ventures ailesi) her parselde ne
 * yaptı: aldı mı, sattı mı, taksitte mi, hâlâ stokta mı — satır satır.
 *
 * Veri: src/data/rakip-defteri.json (scraper/rakip-defteri-uret.mjs ile
 * scraper/rakip-tapu-sonuc.json [county tapu] + scraper/rakip-ilan-fiyat.json
 * [rakip ilanı] + scraper/rakip-tapu-diger.json [diğer oyuncular] birleşimi).
 * Hesaplar src/lib/rakip-defteri.ts'deki SAF fonksiyonlarla yapılır — burada
 * hard-code rakam YOK, hepsi canlı `rows`/`ozet`'ten türetilir.
 *
 * DÜRÜSTLÜK: "Aldı" = county tapu kaydı (Mohave Assessor); "Sattı/Çıkardı" =
 * discountlots.com ilanı (gerçek alıcıya el değiştirme fiyatı DEĞİL, ilan/asking
 * fiyatı) — ikisi ayrı etiketle gösterilir, asla karıştırılmaz.
 */

import { useMemo, useState } from "react";
import { ExternalLink, ShieldCheck, ArrowUpDown, ArrowUp, ArrowDown, Swords, Users } from "lucide-react";
import Dropdown from "@/components/Dropdown";
import rawData from "@/data/rakip-defteri.json";
import {
  buildRakipDefteriRows,
  computeRakipDefteriOzet,
  computeNeOgreniyoruz,
  sortRakipDefteriRows,
  filterRakipDefteriRows,
  type RakipDefteriData,
  type RakipDefteriKayitTipi,
  type RakipDefteriRow,
  type RakipDefteriSiraAlan,
} from "@/lib/rakip-defteri";

const data = rawData as RakipDefteriData;

const usd = (n: number | null | undefined) => (n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`);
const carpanStr = (n: number | null | undefined) => (n == null ? "—" : `×${n.toFixed(2)}`);

const STATU_RENK: Record<RakipDefteriKayitTipi, string> = {
  dogrulanmis_satis: "var(--grade-a)",
  satis_taksitte: "var(--accent-ink)",
  envanter: "var(--muted)",
  belirsiz: "var(--muted)",
};

const PAGE_SIZE = 50;

// `?sekme=defter` gövdesi (eski /admin/rakip-defteri ekranı) — kendi 2 alt sekmesiyle.
export default function SekmeDefter() {
  const [tab, setTab] = useState<"defter" | "diger">("defter");

  const allRows = useMemo(() => buildRakipDefteriRows(data), []);
  const ozet = useMemo(() => computeRakipDefteriOzet(allRows), [allRows]);
  const neOgreniyoruz = useMemo(() => computeNeOgreniyoruz(ozet, allRows), [ozet, allRows]);

  const [statuFiltre, setStatuFiltre] = useState<RakipDefteriKayitTipi | "hepsi">("hepsi");
  const [bolgeFiltre, setBolgeFiltre] = useState<string>("hepsi");
  const [arama, setArama] = useState("");
  const [siraAlan, setSiraAlan] = useState<RakipDefteriSiraAlan>("carpan");
  const [siraYon, setSiraYon] = useState<"asc" | "desc">("desc");
  const [sayfa, setSayfa] = useState(0);

  const bolgeler = useMemo(() => {
    const set = new Set<string>();
    for (const r of allRows) if (r.bolge) set.add(r.bolge);
    return [...set].sort();
  }, [allRows]);

  const filtered = useMemo(() => {
    const f = filterRakipDefteriRows(allRows, { statu: statuFiltre, bolge: bolgeFiltre, arama });
    return sortRakipDefteriRows(f, siraAlan, siraYon);
  }, [allRows, statuFiltre, bolgeFiltre, arama, siraAlan, siraYon]);

  const sayfalanan = filtered.slice(sayfa * PAGE_SIZE, (sayfa + 1) * PAGE_SIZE);
  const toplamSayfa = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  function toggleSort(alan: RakipDefteriSiraAlan) {
    if (siraAlan === alan) {
      setSiraYon((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSiraAlan(alan);
      setSiraYon("desc");
    }
    setSayfa(0);
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold flex items-center gap-2">
          <Swords className="w-6 h-6" /> Rakip Defteri
        </h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Discount Lots (WP RE Ventures ailesi) her parselde ne yaptı — aldı, sattı, taksitte, hâlâ stokta.
          {data.generatedAt && (
            <> Son güncelleme: {new Date(data.generatedAt).toLocaleDateString("tr-TR")}.</>
          )}
        </p>
      </div>

      <div className="rounded-xl border p-4 text-sm flex items-start gap-3"
        style={{ borderColor: "rgba(99,102,241,0.35)", background: "rgba(99,102,241,0.08)" }}>
        <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          <b>Kaynak ayrımı önemli:</b> &quot;Aldı&quot; rakamları Mohave County tapu kaydından (recording no ile
          doğrulanabilir); &quot;Sattı/Çıkardı&quot; rakamları discountlots.com ilanından (asking/ilan fiyatı,
          gerçek alıcı ödemesi county&apos;de ayrıca doğrulanmadıkça KANITLANMIŞ satış fiyatı değildir). Veri yoksa
          &quot;—&quot; gösterilir, uydurulmaz.
        </div>
      </div>

      <div className="flex items-center gap-2 border-b" style={{ borderColor: "var(--surface-high)" }}>
        <TabButton active={tab === "defter"} onClick={() => setTab("defter")} icon={<Swords className="w-4 h-4" />}>
          Rakibin Defteri ({ozet.toplamKayit})
        </TabButton>
        <TabButton active={tab === "diger"} onClick={() => setTab("diger")} icon={<Users className="w-4 h-4" />}>
          Diğer Oyuncular ({data.digerOyuncular?.length ?? 0})
        </TabButton>
      </div>

      {tab === "defter" ? (
        <>
          {/* Özet kartları */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <OzetKarti label="Toplam Kayıt" deger={String(ozet.toplamKayit)} />
            <OzetKarti label="Tamamlanmış Satış" deger={String(ozet.tamamlanmisSatis)} renk="var(--grade-a)" />
            <OzetKarti label="Aktif Taksitli" deger={String(ozet.aktifTaksitli)} renk="var(--accent-ink)" />
            <OzetKarti label="Envanterde (Stok)" deger={String(ozet.envanterSayisi)} />
            <OzetKarti label="Medyan Alım" deger={usd(ozet.medyanAlim)} kaynak="county tapu" />
            <OzetKarti label="Medyan Satış" deger={usd(ozet.medyanSatis)} kaynak="rakip ilanı" />
            <OzetKarti label="Medyan Çarpan" deger={carpanStr(ozet.medyanCarpan)} renk="var(--primary)" />
            <OzetKarti
              label="Tahmini Aylık Tahsilat"
              deger={usd(ozet.tahminiAylikToplam)}
              alt={ozet.aktifTaksitliMedyanVade != null ? `medyan vade ${ozet.aktifTaksitliMedyanVade} ay` : undefined}
              renk="var(--grade-a)"
            />
          </div>

          {/* Ne öğreniyoruz */}
          {neOgreniyoruz.length > 0 && (
            <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
              <h2 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: "var(--muted)" }}>
                Ne öğreniyoruz
              </h2>
              <ul className="space-y-1.5 text-sm">
                {neOgreniyoruz.map((madde, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span aria-hidden style={{ color: "var(--primary)" }}>→</span>
                    <span>{madde}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Filtreler */}
          <div className="flex items-center gap-3 flex-wrap rounded-xl border p-4"
            style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
            {/* Filtreler — native <select> yerine ortak Dropdown bileşeni */}
            <Dropdown
              className="w-44"
              size="sm"
              aria-label="Statü filtresi"
              placeholder="Tüm statüler"
              value={statuFiltre}
              onChange={(v) => { setStatuFiltre(v as RakipDefteriKayitTipi | "hepsi"); setSayfa(0); }}
              options={[
                { value: "hepsi", label: "Tüm statüler" },
                { value: "dogrulanmis_satis", label: "Satıldı ✓" },
                { value: "satis_taksitte", label: "Taksitte" },
                { value: "envanter", label: "Stokta" },
                { value: "belirsiz", label: "Bilinmiyor" },
              ]}
            />
            <Dropdown
              className="w-52"
              size="sm"
              aria-label="Bölge filtresi"
              placeholder="Tüm bölgeler"
              value={bolgeFiltre}
              onChange={(v) => { setBolgeFiltre(v); setSayfa(0); }}
              options={[{ value: "hepsi", label: "Tüm bölgeler" }, ...bolgeler.map((b) => ({ value: b, label: b }))]}
            />
            <input value={arama} onChange={(e) => { setArama(e.target.value); setSayfa(0); }} placeholder="APN / bölge ara..."
              className="flex-1 min-w-[200px] px-4 py-2 rounded-lg text-sm" style={{ background: "var(--surface-low)", border: "1px solid var(--surface-high)" }} />
            <span className="text-xs font-semibold tabular-nums ml-auto" style={{ color: "var(--muted)" }}>
              {filtered.length.toLocaleString()} sonuç
            </span>
          </div>

          {/* Ana tablo */}
          <div className="rounded-xl border overflow-x-auto" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
            {filtered.length === 0 ? (
              <div className="py-16 text-center text-sm" style={{ color: "var(--muted)" }}>Kayıt bulunamadı.</div>
            ) : (
              <table className="w-full min-w-[1100px]">
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--surface-high)" }}>
                    <Th>APN</Th>
                    <Th>Bölge</Th>
                    <SortTh label="Acre" alan="acres" siraAlan={siraAlan} siraYon={siraYon} onSort={toggleSort} />
                    <SortTh label="Aldı" alan="etkinAlim" siraAlan={siraAlan} siraYon={siraYon} onSort={toggleSort} />
                    <SortTh label="Sattı/Çıkardı" alan="satisFiyati" siraAlan={siraAlan} siraYon={siraYon} onSort={toggleSort} />
                    <Th>Statü</Th>
                    <SortTh label="Kâr" alan="karMarji" siraAlan={siraAlan} siraYon={siraYon} onSort={toggleSort} />
                    <SortTh label="Çarpan" alan="carpan" siraAlan={siraAlan} siraYon={siraYon} onSort={toggleSort} />
                    <Th>Taksit</Th>
                    <Th>{""}</Th>
                  </tr>
                </thead>
                <tbody>
                  {sayfalanan.map((r) => (
                    <RakipDefteriSatir key={r.apn} row={r} />
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {toplamSayfa > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button disabled={sayfa === 0} onClick={() => setSayfa((s) => Math.max(0, s - 1))}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-30"
                style={{ background: "var(--surface-high)" }}>
                Önceki
              </button>
              <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
                Sayfa {sayfa + 1} / {toplamSayfa}
              </span>
              <button disabled={sayfa >= toplamSayfa - 1} onClick={() => setSayfa((s) => Math.min(toplamSayfa - 1, s + 1))}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-30"
                style={{ background: "var(--surface-high)" }}>
                Sonraki
              </button>
            </div>
          )}
        </>
      ) : (
        <DigerOyuncularTab data={data} />
      )}
    </div>
  );
}

function RakipDefteriSatir({ row: r }: { row: RakipDefteriRow }) {
  return (
    <tr className="border-t transition-colors hover:bg-[var(--surface-low)]" style={{ borderColor: "var(--surface-high)" }}>
      <td className="py-3 px-4 text-xs font-mono font-semibold whitespace-nowrap">{r.apn}</td>
      <td className="py-3 px-4 text-xs" style={{ color: "var(--muted)" }}>{r.bolge ?? "—"}</td>
      <td className="py-3 px-4 text-xs whitespace-nowrap">{r.acres != null ? `${r.acres} ac` : "—"}</td>
      <td className="py-3 px-4 text-xs">
        <div className="font-bold">{usd(r.etkinAlim)}</div>
        <div className="text-[10px]" style={{ color: "var(--muted)" }}>
          {r.alimTarihi ?? "—"} <span className="opacity-70">· county tapu</span>
        </div>
        {r.paket && (
          <div className="mt-0.5 inline-block text-[9px] font-bold px-1.5 py-0.5 rounded"
            style={{ background: "rgba(245,158,11,0.15)", color: "#b45309" }}>
            {r.deedParcelCount} parsellik paket
          </div>
        )}
      </td>
      <td className="py-3 px-4 text-xs">
        <div className="font-bold">{usd(r.satisFiyati)}</div>
        <div className="text-[10px]" style={{ color: "var(--muted)" }}>
          {r.kayitTipi === "dogrulanmis_satis" ? (r.snapshotTarihi ?? "ilan fiyatı") : "ilan fiyatı"}
          <span className="opacity-70"> · rakip ilanı</span>
        </div>
      </td>
      <td className="py-3 px-4">
        <span className="text-[11px] font-bold px-2 py-1 rounded-full whitespace-nowrap"
          style={{ color: STATU_RENK[r.kayitTipi], background: "var(--surface-low)" }}>
          {r.statuRozeti}
        </span>
      </td>
      <td className="py-3 px-4 text-xs font-bold" style={{ color: r.karMarji != null && r.karMarji > 0 ? "var(--grade-a)" : "var(--muted)" }}>
        {usd(r.karMarji)}
      </td>
      <td className="py-3 px-4 text-xs font-bold" style={{ color: "var(--primary)" }}>
        {carpanStr(r.carpan)}
      </td>
      <td className="py-3 px-4 text-xs" style={{ color: "var(--muted)" }}>
        {r.taksitOzeti ?? "—"}
      </td>
      <td className="py-3 px-4 whitespace-nowrap">
        <div className="flex items-center gap-2">
          {r.ilanUrl && (
            <a href={r.ilanUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: "var(--primary)" }}>
              İlan <ExternalLink className="w-3 h-3" />
            </a>
          )}
          <a href={`/admin/apn-dogrula?apn=${encodeURIComponent(r.apn)}`}
            className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: "var(--accent-ink)" }}>
            APN Doğrula
          </a>
        </div>
      </td>
    </tr>
  );
}

function DigerOyuncularTab({ data }: { data: RakipDefteriData }) {
  const oyuncular = data.digerOyuncular ?? [];
  const toplamParsel = oyuncular.reduce((s, o) => s + (o.parselSayisi || 0), 0);
  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Discount Lots dışındaki bilinen rakipler/oyuncular — Mohave County tapu tersine mühendisliğiyle bulundu.
        Bilgi amaçlı, henüz Rakip Defteri&apos;ndeki gibi derinlemesine izlenmiyor.
        Toplam {oyuncular.length} oyuncu · {toplamParsel} bilinen parsel.
      </p>
      <div className="rounded-xl border overflow-x-auto" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--surface-high)" }}>
              <Th>Firma / Owner</Th>
              <Th>Tip</Th>
              <Th>Parsel Sayısı</Th>
              <Th>Bölgeler</Th>
              <Th>Örnek APN</Th>
            </tr>
          </thead>
          <tbody>
            {oyuncular.map((o, i) => (
              <tr key={i} className="border-t" style={{ borderColor: "var(--surface-high)" }}>
                <td className="py-3 px-4 text-xs font-semibold max-w-[280px]" title={o.not ?? undefined}>{o.firma}</td>
                <td className="py-3 px-4 text-xs" style={{ color: "var(--muted)" }}>{o.tip ?? "—"}</td>
                <td className="py-3 px-4 text-xs font-bold">{o.parselSayisi}</td>
                <td className="py-3 px-4 text-xs max-w-[240px] truncate" style={{ color: "var(--muted)" }}>
                  {o.bolgeler.join(", ") || "—"}
                </td>
                <td className="py-3 px-4 text-xs font-mono" style={{ color: "var(--muted)" }}>
                  {o.ornekApnler.slice(0, 3).join(", ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors"
      style={{ borderColor: active ? "var(--primary)" : "transparent", color: active ? "var(--primary)" : "var(--muted)" }}>
      {icon} {children}
    </button>
  );
}

function OzetKarti({ label, deger, alt, renk, kaynak }: { label: string; deger: string; alt?: string; renk?: string; kaynak?: string }) {
  return (
    <div className="rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--surface-high)" }}>
      <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--muted)" }}>{label}</div>
      <div className="text-xl font-extrabold" style={{ color: renk ?? "var(--fg)" }}>{deger}</div>
      {alt && <div className="text-[10px] mt-0.5" style={{ color: "var(--muted)" }}>{alt}</div>}
      {kaynak && <div className="text-[9px] mt-1 opacity-60">kaynak: {kaynak}</div>}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: "var(--muted)" }}>
      {children}
    </th>
  );
}

function SortTh({ label, alan, siraAlan, siraYon, onSort }: {
  label: string; alan: RakipDefteriSiraAlan; siraAlan: RakipDefteriSiraAlan; siraYon: "asc" | "desc"; onSort: (a: RakipDefteriSiraAlan) => void;
}) {
  const active = siraAlan === alan;
  return (
    <th className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: active ? "var(--primary)" : "var(--muted)" }}>
      <button onClick={() => onSort(alan)} className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity uppercase tracking-widest">
        {label}
        {active ? (siraYon === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
      </button>
    </th>
  );
}
