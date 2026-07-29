"use client";

// ─────────────────────────────────────────────────────────────────────────────
// TEK OFF-MARKET ENVANTERİ (ADIM 1)
//
// Eskiden her county'nin kendi ekranı ve kendi statik JSON'u vardı:
//   /admin/mohave → src/data/mohave-offmarket.json (20.000 satır)
//   /admin/luna   → src/data/import-propstream-nm-luna.json (157 satır)
// Artık TEK ekran var; DOĞRUDAN `offmarket_leads` tablosunu okuyor — satır/eyalet
// sayısı CANLI sorgudan gelir, buraya sabit rakam yazma (hasat her gün ekliyor).
// İki eski yol bu ekrana county filtresi seçili olarak
// yönlendirilir — hiçbir sayfa silinmedi, hiçbir veri kaybolmadı.
// (Statik JSON'lardaki 345.969 satırın tamamının bu tabloda olduğu
//  scripts/kayip-veri-avi.mjs ile kanıtlandı.)
//
// Mohave'ye özel `offmarket_score` motoru county'den bağımsız hale getirildi
// (lib/offmarket-score.ts); Mohave'nin bölge-talep katsayıları kaybolmadı,
// county bazlı ayar tablosunda duruyor.
//
// UI kuralları: beyaz zemin, renk sadece anlamda, native <select> YOK (Dropdown).
// ─────────────────────────────────────────────────────────────────────────────

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { MapPin, ExternalLink, Home, Globe, Mail, Loader2, Search, Layers } from "lucide-react";
import Dropdown from "@/components/Dropdown";
import { ScoreBadge } from "@/components/ScoreBadge";
import { OFFMARKET_STATE_META, type OffmarketState } from "@/lib/offmarket-stats";

const YESIL = "#16a34a";
const usd = (n: number | null | undefined) =>
  n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`;
const say = (n: number | null | undefined) => (n ?? 0).toLocaleString("tr-TR");

type OzetSatiri = {
  state: string; county: string; lead_sayisi: number; koordinatli: number;
  postalanabilir: number; absentee: number; acre_bilinen: number;
  ort_acre: number | null; bolge_sayisi: number;
};

type Satir = {
  lead_id: string; state: string; county: string | null; county_normalized: string | null;
  region: string | null; apn: string | null; owner: string | null;
  mailing_address: string | null; mailing_city: string | null;
  mailing_state: string | null; mailing_zip: string | null;
  situs: string | null; use: string | null; acres: number | null;
  land_value: number | null; est_offer: number | null; est_retail: number | null;
  est_margin: number | null; absentee: boolean | null;
  lat: number | null; lng: number | null; grade: string | null; source: string | null;
  offmarket_score: number;
  skor_kirilim: { margin: number; size: number; demand: number; motivation: number; total: number };
};

type Cevap = {
  ozet: OzetSatiri[];
  toplam: number;
  secim: { state: string | null; county: string | null; q?: string | null };
  kapsam?: { countyToplam: number; cekilen: number; tamKapsam: boolean; ornekTavani: number };
  istatistik?: {
    postalanabilir: number; koordinatli: number; absentee: number; ortAcre: number;
    cokParselliSahip: number; cokParselliParsel: number;
    bolgeler: [string, number][]; sahipEyaleti: [string, number][];
  };
  cokParselli?: { owner: string; mail: string; adet: number; acres: number; landValue: number }[];
  satirlar: Satir[];
  not?: string;
  hata?: string | null;
};

export default function OffMarketEnvanterPage() {
  return (
    <Suspense fallback={<Yukleniyor />}>
      <Icerik />
    </Suspense>
  );
}

function Yukleniyor() {
  return (
    <div className="flex items-center gap-2 p-6 text-sm" style={{ color: "var(--muted)" }}>
      <Loader2 className="h-4 w-4 animate-spin" /> Envanter yükleniyor…
    </div>
  );
}

function Icerik() {
  const router = useRouter();
  const sp = useSearchParams();
  const state = sp.get("state") ?? "";
  const county = sp.get("county") ?? "";
  const q = sp.get("q") ?? "";

  const [veri, setVeri] = useState<Cevap | null>(null);
  const [mesgul, setMesgul] = useState(true);
  const [aramaKutusu, setAramaKutusu] = useState(q);

  useEffect(() => setAramaKutusu(q), [q]);

  useEffect(() => {
    const iptal = new AbortController();
    setMesgul(true);
    const qs = new URLSearchParams();
    if (state) qs.set("state", state);
    if (county) qs.set("county", county);
    if (q) qs.set("q", q);
    fetch(`/api/admin/offmarket-envanter?${qs}`, { signal: iptal.signal, cache: "no-store" })
      .then((r) => r.json())
      .then((j: Cevap) => setVeri(j))
      .catch(() => {})
      .finally(() => setMesgul(false));
    return () => iptal.abort();
  }, [state, county, q]);

  /** Filtre değişince URL'yi güncelle (yer imi + geri tuşu çalışsın). */
  const git = useCallback(
    (yeni: Partial<{ state: string; county: string; q: string }>) => {
      const p = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(yeni)) {
        if (v) p.set(k, v);
        else p.delete(k);
      }
      // Eyalet değişince county seçimi geçersizleşir.
      if (yeni.state !== undefined && yeni.county === undefined) p.delete("county");
      router.replace(`/admin/off-market-envanter?${p}`, { scroll: false });
    },
    [router, sp]
  );

  const ozet = veri?.ozet ?? [];

  const eyaletler = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of ozet) m.set(o.state, (m.get(o.state) ?? 0) + o.lead_sayisi);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [ozet]);

  const countyler = useMemo(
    () => ozet.filter((o) => o.state === state).sort((a, b) => b.lead_sayisi - a.lead_sayisi),
    [ozet, state]
  );

  const eyaletSecenek = useMemo(
    () => [
      { value: "", label: `Tüm eyaletler — ${say(veri?.toplam)} lead` },
      ...eyaletler.map(([kod, n]) => ({
        value: kod,
        label: `${OFFMARKET_STATE_META[kod as OffmarketState]?.label ?? kod} (${kod}) — ${say(n)}`,
      })),
    ],
    [eyaletler, veri?.toplam]
  );

  const countySecenek = useMemo(
    () => [
      { value: "", label: state ? `Tüm county'ler (${countyler.length})` : "Önce eyalet seç" },
      ...countyler.map((c) => ({ value: c.county, label: `${c.county} — ${say(c.lead_sayisi)}` })),
    ],
    [countyler, state]
  );

  const ist = veri?.istatistik;
  const kapsam = veri?.kapsam;
  const satirlar = veri?.satirlar ?? [];
  const eyaletMeta = state ? OFFMARKET_STATE_META[state as OffmarketState] : undefined;

  return (
    <div className="space-y-6 p-6" style={{ color: "var(--foreground)" }}>
      <header>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: YESIL }}>
          ✅ Tek kaynak · offmarket_leads
        </div>
        <h1 className="flex items-center gap-2 text-[26px] font-bold">
          <Layers className="h-6 w-6" style={{ color: YESIL }} /> Off-Market Envanteri
        </h1>
        <p className="mt-1 max-w-3xl text-sm" style={{ color: "var(--muted)" }}>
          Açık artırma <strong>değil</strong> — doğrudan absentee sahipten. Bütün eyalet ve county&apos;ler
          artık <strong>tek tabloda</strong>: <strong style={{ color: YESIL }}>{say(veri?.toplam)}</strong> lead ·{" "}
          {eyaletler.length} eyalet · {ozet.length} county. Her satırda gerçek sahip adı + posta adresi →
          blind-offer mektubu (Lob).
        </p>
        {veri?.not && (
          <p className="mt-2 rounded-lg px-3 py-2 text-xs" style={{ background: "var(--surface-high)", color: "var(--grade-c)" }}>
            {veri.not}
          </p>
        )}
      </header>

      {/* ── Filtreler — native <select> YOK (proje kuralı) ── */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="min-w-[240px]">
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Eyalet</label>
          <Dropdown
            options={eyaletSecenek}
            value={state}
            onChange={(v) => git({ state: v, county: "" })}
            placeholder="Eyalet seç"
            size="sm"
            aria-label="Eyalet seç"
          />
        </div>
        <div className="min-w-[240px]">
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>County</label>
          <Dropdown
            options={countySecenek}
            value={county}
            onChange={(v) => git({ county: v })}
            placeholder={state ? "County seç" : "Önce eyalet"}
            size="sm"
            aria-label="County seç"
          />
        </div>
        <form
          className="flex min-w-[260px] flex-1 items-end gap-2"
          onSubmit={(e) => { e.preventDefault(); git({ q: aramaKutusu.trim() }); }}
        >
          <div className="flex-1">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Ara (sahip · APN · adres)</label>
            <input
              value={aramaKutusu}
              onChange={(e) => setAramaKutusu(e.target.value)}
              placeholder="ör. SMITH veya 248-00777"
              className="h-9 w-full rounded-lg px-3 text-sm outline-none"
              style={{ background: "var(--surface-high)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            />
          </div>
          <button type="submit" className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold" style={{ background: YESIL, color: "#fff" }}>
            <Search className="h-3.5 w-3.5" /> Ara
          </button>
        </form>
        {(state || county || q) && (
          <button
            onClick={() => router.replace("/admin/off-market-envanter", { scroll: false })}
            className="h-9 rounded-lg px-3 text-xs font-semibold"
            style={{ border: "1px solid var(--border)", color: "var(--muted)" }}
          >
            Filtreyi temizle
          </button>
        )}
        {state && (
          <Link
            href={`/admin/harita?mod=offmarket&st=${state}`}
            className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold"
            style={{ border: "1px solid var(--border)", color: "var(--muted)" }}
          >
            <MapPin className="h-3.5 w-3.5" /> Haritada gör
          </Link>
        )}
      </div>

      {mesgul && <Yukleniyor />}

      {/* ── Eyalet seçilmediyse: eyalet/county kırılım tablosu ── */}
      {!mesgul && !state && (
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide" style={{ background: "var(--surface-high)", color: "var(--muted)" }}>
                <th className="px-3 py-2.5 font-bold">Eyalet</th>
                <th className="px-3 py-2.5 font-bold">County</th>
                <th className="px-3 py-2.5 text-right font-bold">Lead</th>
                <th className="px-3 py-2.5 text-right font-bold">Postalanabilir</th>
                <th className="px-3 py-2.5 text-right font-bold">Koordinatlı</th>
                <th className="px-3 py-2.5 text-right font-bold">Absentee</th>
                <th className="px-3 py-2.5 text-right font-bold">Ort. acre</th>
                <th className="px-3 py-2.5 font-bold">Aç</th>
              </tr>
            </thead>
            <tbody>
              {ozet.map((o) => (
                <tr key={`${o.state}|${o.county}`} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-3 py-2 font-bold">{o.state}</td>
                  <td className="px-3 py-2">{o.county}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold" style={{ color: YESIL }}>{say(o.lead_sayisi)}</td>
                  <td className="px-3 py-2 text-right tabular-nums" style={{ color: "var(--muted)" }}>{say(o.postalanabilir)}</td>
                  <td className="px-3 py-2 text-right tabular-nums" style={{ color: "var(--muted)" }}>{say(o.koordinatli)}</td>
                  <td className="px-3 py-2 text-right tabular-nums" style={{ color: "var(--muted)" }}>{say(o.absentee)}</td>
                  <td className="px-3 py-2 text-right tabular-nums" style={{ color: "var(--muted)" }}>{o.ort_acre ?? "—"}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => git({ state: o.state, county: o.county })}
                      className="text-xs font-semibold hover:underline"
                      style={{ color: YESIL }}
                    >
                      envanteri aç →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="p-3 text-xs" style={{ color: "var(--muted)" }}>
            {ozet.length} county satırı · toplam {say(veri?.toplam)} lead. Sayaçlar
            <code className="mx-1 rounded px-1.5 py-0.5" style={{ background: "var(--surface-high)" }}>offmarket_envanter_ozet_mv</code>
            görünümünden gelir; import sonrası
            <code className="mx-1 rounded px-1.5 py-0.5" style={{ background: "var(--surface-high)" }}>scripts/envanter-ozet-tazele.mjs</code>
            ile yenilenir.
          </p>
        </div>
      )}

      {/* ── Seçili eyalet/county detayı ── */}
      {!mesgul && state && (
        <>
          {kapsam && !kapsam.tamKapsam && (
            <p className="rounded-lg px-3 py-2 text-xs" style={{ background: "var(--surface-high)", color: "var(--grade-c)" }}>
              ⚠️ Dürüstlük notu: bu county&apos;de {say(kapsam.countyToplam)} lead var; skorlama örnek tavanı
              ({say(kapsam.ornekTavani)}) nedeniyle <strong>{say(kapsam.cekilen)}</strong> satır üzerinden yapıldı.
              Marj bileşeni bu kümenin bölge medyanına göredir. County filtresi veya arama ile daraltırsan
              skor tam kapsamlı olur.
            </p>
          )}

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            <Kutu icon={<Home className="h-4 w-4" />} etiket="Bu seçimde lead" deger={say(kapsam?.countyToplam)} vurgu />
            <Kutu icon={<Mail className="h-4 w-4" />} etiket="Postalanabilir" deger={say(ist?.postalanabilir)} vurgu />
            <Kutu icon={<MapPin className="h-4 w-4" />} etiket="Koordinatlı" deger={say(ist?.koordinatli)} />
            <Kutu icon={<Globe className="h-4 w-4" />} etiket="Absentee" deger={say(ist?.absentee)} />
            <Kutu icon={<Layers className="h-4 w-4" />} etiket="Ort. acre" deger={`${ist?.ortAcre ?? 0} acre`} />
            <Kutu icon={<MapPin className="h-4 w-4" />} etiket="Bölge" deger={`${ist?.bolgeler.length ?? 0} bölge`} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <h3 className="mb-2 text-sm font-semibold">
                Bölge dağılımı {eyaletMeta ? <span style={{ color: "var(--muted)" }}>· {eyaletMeta.region}</span> : null}
              </h3>
              <div className="max-h-56 space-y-1.5 overflow-auto">
                {(ist?.bolgeler ?? []).map(([b, n]) => (
                  <div key={b} className="flex items-center justify-between text-sm">
                    <span style={{ color: "var(--muted)" }}>{b}</span>
                    <span className="font-semibold tabular-nums">{say(n)}</span>
                  </div>
                ))}
                {!ist?.bolgeler.length && <p className="text-xs" style={{ color: "var(--muted)" }}>Bu seçimde bölge etiketi yok.</p>}
              </div>
            </div>
            <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <h3 className="mb-2 text-sm font-semibold">En çok absentee sahip eyaleti</h3>
              <div className="flex flex-wrap gap-2">
                {(ist?.sahipEyaleti ?? []).map(([st, n]) => (
                  <span key={st} className="rounded-md px-2 py-1 text-xs font-medium" style={{ background: "var(--surface-high)" }}>
                    {st} <span className="font-bold" style={{ color: YESIL }}>{say(n)}</span>
                  </span>
                ))}
                {!ist?.sahipEyaleti.length && <p className="text-xs" style={{ color: "var(--muted)" }}>Posta eyaleti verisi yok.</p>}
              </div>
            </div>
          </div>

          {/* 🎯 Çok parselli sahipler — toplu teklif hedefi (Mohave ekranından taşındı) */}
          {!!veri?.cokParselli?.length && (
            <div className="rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <div className="border-b p-4" style={{ borderColor: "var(--border)" }}>
                <h3 className="text-base font-bold">🎯 Çok parselli sahipler — toplu teklif hedefi</h3>
                <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                  <strong style={{ color: YESIL }}>{say(ist?.cokParselliSahip)}</strong> sahip 2+ parsel tutuyor →
                  tek mektupla <strong style={{ color: YESIL }}>{say(ist?.cokParselliParsel)}</strong> parsele ulaşılır.
                  Bir toptancıdan tek seferde yüzlerce lot = portföy alımı.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide" style={{ background: "var(--surface-high)", color: "var(--muted)" }}>
                      <th className="px-3 py-2.5 font-bold">Sahip</th>
                      <th className="px-3 py-2.5 font-bold">Posta adresi</th>
                      <th className="px-3 py-2.5 text-right font-bold">Parsel</th>
                      <th className="px-3 py-2.5 text-right font-bold">Toplam acre</th>
                      <th className="px-3 py-2.5 text-right font-bold">Toplam land value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {veri.cokParselli.map((g, i) => (
                      <tr key={i} className="border-t" style={{ borderColor: "var(--border)" }}>
                        <td className="px-3 py-2 font-medium">{g.owner}</td>
                        <td className="px-3 py-2" style={{ color: "var(--muted)" }}>{g.mail}</td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums" style={{ color: YESIL }}>{g.adet}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{g.acres.toFixed(1)}</td>
                        <td className="px-3 py-2 text-right tabular-nums" style={{ color: "var(--muted)" }}>{usd(g.landValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Parsel listesi — skora göre azalan */}
          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide" style={{ background: "var(--surface-high)", color: "var(--muted)" }}>
                  <th className="px-3 py-2.5 text-center font-bold">Skor ▼</th>
                  <th className="px-3 py-2.5 font-bold">Sahip</th>
                  <th className="px-3 py-2.5 font-bold">Posta adresi (mektup)</th>
                  <th className="px-3 py-2.5 font-bold">Bölge</th>
                  <th className="px-3 py-2.5 text-right font-bold">Acre</th>
                  <th className="px-3 py-2.5 text-right font-bold">Land value</th>
                  <th className="px-3 py-2.5 text-right font-bold">Teklif</th>
                  <th className="px-3 py-2.5 font-bold">APN</th>
                  <th className="px-3 py-2.5 font-bold">Aç</th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((r) => (
                  <tr key={r.lead_id} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="px-3 py-2 text-center">
                      <span
                        title={`marj ${r.skor_kirilim.margin} · boyut ${r.skor_kirilim.size} · bölge talebi ${r.skor_kirilim.demand} · sahip motivasyonu ${r.skor_kirilim.motivation}`}
                      >
                        <ScoreBadge score={r.offmarket_score} size={30} />
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium">{r.owner ?? "—"}</td>
                    <td className="px-3 py-2" style={{ color: "var(--muted)" }}>
                      {[r.mailing_address, r.mailing_city, r.mailing_state, r.mailing_zip].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="px-3 py-2" style={{ color: "var(--muted)" }}>{r.region ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.acres ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{usd(r.land_value)}</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: "var(--muted)" }}>{usd(r.est_offer)}</td>
                    <td className="px-3 py-2 text-xs" style={{ color: "var(--muted)" }}>{r.apn ?? "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {r.apn && (
                          <Link href={`/admin/apn-dogrula?apn=${encodeURIComponent(r.apn)}`} className="text-xs hover:underline" style={{ color: YESIL }}>
                            doğrula
                          </Link>
                        )}
                        {r.lat != null && r.lng != null && (
                          <a
                            href={`https://www.google.com/maps?q=${r.lat},${r.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs hover:underline"
                            style={{ color: YESIL }}
                          >
                            <ExternalLink className="h-3 w-3" /> harita
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!satirlar.length && (
                  <tr><td colSpan={9} className="px-3 py-6 text-center text-sm" style={{ color: "var(--muted)" }}>Bu filtreyle satır yok.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Skora göre azalan ilk {satirlar.length} satır gösteriliyor. <strong>offmarket_score</strong> =
            marj + boyut + bölge talebi + sahip motivasyonu (0-100, bkz.{" "}
            <code className="rounded px-1.5 py-0.5" style={{ background: "var(--surface-high)" }}>src/lib/offmarket-score.ts</code>).
            Skor rozetinin üstüne gelince bileşen kırılımı görünür. Mohave için kullanılan bölge-talep
            katsayıları korunmuştur; ayar tablosu olmayan county&apos;lerde bölge talebi nötr-düşük varsayılır
            (uydurma katsayı yok).
          </p>
        </>
      )}
    </div>
  );
}

function Kutu({ icon, etiket, deger, vurgu }: { icon: React.ReactNode; etiket: string; deger: string; vurgu?: boolean }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--muted)" }}>{icon} {etiket}</div>
      <div className="mt-1 text-xl font-bold" style={vurgu ? { color: YESIL } : undefined}>{deger}</div>
    </div>
  );
}
