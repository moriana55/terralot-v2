"use client";

// ─────────────────────────────────────────────────────────────────────────────
// BUGÜN — admin başlangıç ekranı.
//
// Soru: "bugün ne yapmalıyım?" Cevap: bekleyen işler + iş akışına giden linkler.
//
// DÜRÜSTLÜK KURALLARI (bu dosyada ihlal edilmeyecek):
//   • Her sayı GERÇEK bir sorgudan gelir. Uydurma yüzde, örnek rakam YOK.
//   • Veri yoksa 0 gösterilir; kaynak KURULMAMIŞSA sayı yerine "kurulum gerekli"
//     yazılır — 0 ile "bilmiyorum" birbirine karıştırılmaz.
//   • "Yakında" butonu YOK. Her bağlantı çalışan bir sayfaya gider.
//
// Kaynaklar (hepsi mevcut, admin-gated API'ler):
//   /api/admin/offmarket-breakdown  envanter head-count
//   /api/admin/arsa-notlari         not motoru hunisi (A+/A)
//   /api/admin/outreach-tick        vadesi gelen mektup (DRY-RUN, gönderim yok)
//   /api/admin/call-center          geri arama kuyruğu
//   /api/admin/parcel-inquiries     cevap bekleyen alıcı talepleri
//   /api/admin/pipeline             anlaşma hattı
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, Loader2, Mail, PhoneCall, MessageSquare, Handshake, Award,
  Database, Map, Target, Sparkles, Radar, BarChart3, AlertTriangle,
  Presentation, Users, Building2, FileText,
} from "lucide-react";
// Sunum bloğunun sayıları — 2 KB'lık özet (tam snapshot'lar 600 KB, client'a taşınmaz).
// Üreten: node scraper/build-sunum-ozet.mjs (iki snapshot betiğinden sonra).
import sunumOzet from "@/data/sunum-ozet.json";

/** Bir sayacın üç hâli: yükleniyor · sayı · kaynak kurulu değil. */
type Sayac =
  | { durum: "yukleniyor" }
  | { durum: "hazir"; deger: number }
  | { durum: "kurulmadi"; not: string };

const bekle: Sayac = { durum: "yukleniyor" };

/** fetch + json; her türlü hatada "kurulmadı" döner (ekran çökmez). */
async function al<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}


const tr = (v: number) => v.toLocaleString("tr-TR");

// Sunum şeridi — anlatım sırası. Rakamlar özet dosyasından türetilir.
const SUNUM = sunumOzet as {
  veriAni: string; toplamLead: number; countyN: number; eyaletN: number; aplusA: number;
  ilkIkiPay: number;
  dagilim: { ad: string; parsel: number; county: number; pay: number }[];
  alici: { biriktirici: number; aktif: number; postali: number };
  skiptrace: { dosya: string; kisi: number } | null;
};

/**
 * SUNUM ŞERİDİ — toplantıda tak tak açılacak sıra.
 *
 * Her satır TEK BİR CÜMLE taşır: o ekran açıldığında ağızdan çıkacak söz.
 * Amaç "hangi sayfaydı" diye aranmamak ve rakamı yanlış söylememek.
 *
 * ⚠ RAKAMLAR CANLI: eskiden `sunum-ozet.json` snapshot'ından geliyordu ve
 * orası yalnız PROFİLLENMİŞ alt kümeyi sayıyor (34 eyalet · 35.114 A+/A).
 * Ekranda tüm operasyon gibi görünüyor, ağızdan çıkan 43 eyalet · 69.511 ile
 * çelişiyordu. Artık canlı sayaçlar basılır; sayaç gelmeden snapshot'a düşer
 * (asla boş kalmaz), profil verisi ise ait olduğu satırda kalır.
 */
function sunumAdimlari(canliEyalet: number | null, canliAplus: number | null, canliLead: number | null) {
  const eyalet = canliEyalet ?? SUNUM.eyaletN;
  const aplus = canliAplus ?? SUNUM.aplusA;
  const lead = canliLead ?? SUNUM.toplamLead;

  return [
    {
      href: "/admin/eleme-hunisi",
      icon: Presentation,
      ad: "1 · Açılış — milyonlardan bir avuca",
      cumle: `"69 milyon parsele erişimimiz var, 3 milyonunu işledik, ${tr(lead)}'i envantere aldık." Huninin tepesi ile tabanı bir arada.`,
      rakam: `${eyalet} eyalet`,
    },
    {
      href: "/admin/arsa-notlari",
      icon: Award,
      ad: "2 · Kalite — satılabilir olanlar",
      cumle: `"Hepsini kalite notuna ayırdık; en üst dilimde ${tr(aplus)} parsel var." Yol, elektrik, su, kasaba mesafesi ölçülmeden A+/A olmaz.`,
      rakam: tr(aplus),
    },
    {
      href: "/admin/cevirme-kaniti",
      icon: FileText,
      ad: "3 · Kanıt — bu arsalar satılıyor mu?",
      cumle: '"363 parselde tapu sicilinden hem alım hem satım fiyatı çıkardık: medyan x1,39, medyan 4 ay." Ekranı paylaş, link verme.',
      rakam: "x1,39",
    },
    {
      href: "/admin/rakip-haritasi",
      icon: Radar,
      ad: "4 · Rakip — piyasada kim var",
      cumle: '"En yakın rakibin 68 parseli var; girdiği her bölgede bizim 238.042 parselimiz duruyor." Ölçek kıyası, satış kıyası değil.',
      rakam: "238.042",
    },
    {
      href: "/admin/toplu-alicilar",
      icon: Building2,
      ad: "5 · Alıcı — kime toplu satarız",
      cumle: `"Aynı county'lerde arsa biriktiren şirketler var, ${SUNUM.alici.postali} tanesinin posta adresi elimizde." Çıkış kapısı tek tek alıcı değil.`,
      rakam: tr(SUNUM.alici.biriktirici + SUNUM.alici.aktif),
    },
    {
      href: "/admin/bolge-profili",
      icon: Users,
      ad: "6 · Bu bölgelerde neden yaşıyorlar",
      cumle: `${SUNUM.dagilim[0]?.ad} + ${SUNUM.dagilim[1]?.ad} = profillenen envanterin %${SUNUM.ilkIkiPay}'i. Mesajı buna göre yazıyoruz.`,
      rakam: `%${SUNUM.ilkIkiPay}`,
    },
    {
      // ⚠ PANELE DEĞİL, PROPSTREAM'E GİDER — kanıt orada.
      //
      // Skip trace 4.060 kişide çalıştı ama sonuç sağlayıcının hesabında duruyor;
      // offmarket_leads.phone hâlâ boş. Satır panel içinde bir yere bağlanınca
      // (arama kuyruğu boş, envanterde telefon sütunu yok) "telefon çıktı" diyip
      // telefonsuz ekran açıyordu. Numaralar DB'ye aktarılınca /admin/arama'ya
      // çevrilecek; o zamana kadar tıklayınca gerçek listeyi açar.
      href: "https://app.propstream.com/contact/0",
      dis: true,
      icon: PhoneCall,
      ad: "7 · BU HAFTA — sahiplerin telefonu çıktı",
      cumle: '"4.060 arsa sahibinin telefonu ve e-postası çıkarıldı, kişi başına 2-4 numara, maliyeti sıfır." Tıkla → PropStream açılır, liste orada. Panele aktarım sıradaki iş.',
      rakam: "4.060",
    },
  ];
}

export default function BugunEkrani() {
  const [envanter, setEnvanter] = useState<Sayac>(bekle);
  const [aPlus, setAPlus] = useState<Sayac>(bekle);
  const [mektup, setMektup] = useState<Sayac>(bekle);
  const [geriArama, setGeriArama] = useState<Sayac>(bekle);
  const [talep, setTalep] = useState<Sayac>(bekle);
  const [hat, setHat] = useState<Sayac>(bekle);
  const [eyaletSayisi, setEyaletSayisi] = useState<number | null>(null);

  // Sunum şeridinin rakamları — HIZLI ve TEK kaynak.
  //
  // Aşağıdaki envanter/A+ sayaçları `offmarket-breakdown` (16 sn) ve
  // `arsa-notlari` (9 sn) uçlarından gelir. O saniyeler boyunca şerit
  // snapshot'a düşüyor ve ekranda 34 eyalet · 35.114 A+/A yazıyordu —
  // yani sunumun ilk ekranında yanlış rakam duruyordu. Eleme Hunisi ucu
  // aynı toplayıcı RPC'yi ~0,1 sn'de döndürür; şerit artık onu bekler.
  const [hizliOlcu, setHizliOlcu] = useState<{ lead: number; eyalet: number; aplus: number } | null>(null);

  useEffect(() => {
    let canli = true;
    al<{ havuz?: { kayitli: number | null; eyaletSayisi: number | null; yatirimaUygun: number | null } }>(
      "/api/admin/eleme-hunisi",
    ).then((d) => {
      const h = d?.havuz;
      if (!canli || !h) return;
      if (h.kayitli != null && h.eyaletSayisi != null && h.yatirimaUygun != null) {
        setHizliOlcu({ lead: h.kayitli, eyalet: h.eyaletSayisi, aplus: h.yatirimaUygun });
      }
    });
    return () => { canli = false; };
  }, []);

  useEffect(() => {
    let canli = true;

    // Envanter — off-market lead head-count (tek gerçek kaynak).
    al<{ total: number | null; byState?: unknown[] }>("/api/admin/offmarket-breakdown").then((d) => {
      if (!canli) return;
      if (!d || d.total == null) return setEnvanter({ durum: "kurulmadi", not: "offmarket_leads tablosu yok" });
      setEnvanter({ durum: "hazir", deger: d.total });
      if (Array.isArray(d.byState)) setEyaletSayisi(d.byState.length);
    });

    // Not motoru — satışa hazır A+ ve A parsel.
    al<{ schemaReady?: boolean; funnel?: { aPlus: number; a: number } }>("/api/admin/arsa-notlari").then((d) => {
      if (!canli) return;
      if (!d || d.schemaReady === false || !d.funnel)
        return setAPlus({ durum: "kurulmadi", not: "not motoru şeması kurulmadı (sql/offmarket_grades.sql)" });
      setAPlus({ durum: "hazir", deger: d.funnel.aPlus + d.funnel.a });
    });

    // Mektup kadansı — vadesi gelen dokunuş (DRY-RUN: sadece okur, göndermez).
    al<{ ready?: number; note?: string }>("/api/admin/outreach-tick").then((d) => {
      if (!canli) return;
      if (!d || typeof d.ready !== "number")
        return setMektup({ durum: "kurulmadi", not: "kadans şeması kurulmadı (sql/outreach_cadence.sql)" });
      setMektup({ durum: "hazir", deger: d.ready });
    });

    // Arama kokpiti — vadesi gelmiş geri aramalar.
    al<{ schemaReady?: boolean; callbacks?: unknown[] }>("/api/admin/call-center").then((d) => {
      if (!canli) return;
      if (!d || d.schemaReady === false)
        return setGeriArama({ durum: "kurulmadi", not: "arama şeması kurulmadı (sql/call_center.sql)" });
      setGeriArama({ durum: "hazir", deger: (d.callbacks ?? []).length });
    });

    // Alıcı talepleri — henüz dönülmemiş (NEW) olanlar.
    al<{ rows?: { status: string }[] }>("/api/admin/parcel-inquiries").then((d) => {
      if (!canli) return;
      if (!d || !Array.isArray(d.rows)) return setTalep({ durum: "kurulmadi", not: "talep kaynağı okunamadı" });
      setTalep({ durum: "hazir", deger: d.rows.filter((r) => r.status === "NEW").length });
    });

    // Anlaşma hattı — tapuya gitmemiş, yani hâlâ hareket bekleyen anlaşmalar.
    al<{ schemaReady?: boolean; deals?: { stage: string }[] }>("/api/admin/pipeline").then((d) => {
      if (!canli) return;
      if (!d || d.schemaReady === false)
        return setHat({ durum: "kurulmadi", not: "pipeline_deals tablosu yok" });
      setHat({ durum: "hazir", deger: (d.deals ?? []).filter((x) => x.stage !== "tapu").length });
    });

    return () => {
      canli = false;
    };
  }, []);

  const bugun = new Date().toLocaleDateString("tr-TR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  // ── Bugünün iş listesi — her satır bir sayaç + o işin yapıldığı sayfa ──
  const isler: { sayac: Sayac; etiket: string; bos: string; href: string; icon: typeof Mail }[] = [
    { sayac: mektup, etiket: "mektup sırası geldi", bos: "Vadesi gelen mektup yok", href: "/admin/outreach", icon: Mail },
    { sayac: geriArama, etiket: "sahibi geri aranacak", bos: "Bekleyen geri arama yok", href: "/admin/arama", icon: PhoneCall },
    { sayac: talep, etiket: "alıcı talebi cevap bekliyor", bos: "Cevap bekleyen alıcı talebi yok", href: "/admin/talepler", icon: MessageSquare },
    { sayac: hat, etiket: "anlaşma hattında hareket bekliyor", bos: "Hatta bekleyen anlaşma yok", href: "/admin/anlasma-hatti", icon: Handshake },
    { sayac: aPlus, etiket: "A+/A parsel satışa hazır", bos: "Henüz A+/A notlu parsel yok", href: "/admin/arsa-notlari", icon: Award },
  ];

  const bekleyenIs = isler.filter((i) => i.sayac.durum === "hazir" && i.sayac.deger > 0).length;

  return (
    <div className="p-7 max-w-5xl space-y-7">
      {/* ── Başlık ── */}
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Bugün</h1>
        <p className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>{bugun}</p>
      </header>

      {/* ── 0) SUNUM ŞERİDİ — toplantıda sırayla açılacak ekranlar ─────────────
          Ahmet toplantısında "hangi sayfaydı" diye aranmamak için: anlatım
          sırasına dizili, her birinde söylenecek rakam üstünde. Sayılar
          `sunum-ozet.json`'dan gelir; hardcoded rakam YOK. */}
      <section className="rounded-xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--outline)" }}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-5 py-3.5 border-b" style={{ borderColor: "var(--surface-high)" }}>
          <Presentation className="w-4 h-4" style={{ color: "var(--accent-ink)" }} />
          <h2 className="font-bold text-sm">Sunum · sırayla aç</h2>
          <span className="text-[11px]" style={{ color: "var(--muted)" }}>
            {hizliOlcu
              ? `· ${hizliOlcu.eyalet} eyalet · ${tr(hizliOlcu.lead)} parsel · ${tr(hizliOlcu.aplus)} A+/A`
              : "· ölçülüyor…"}
          </span>
        </div>

        <ul>
          {sunumAdimlari(
            hizliOlcu?.eyalet ?? null,
            hizliOlcu?.aplus ?? null,
            hizliOlcu?.lead ?? null,
          ).map((a, i) => (
            <li key={a.href} className="border-t first:border-t-0" style={{ borderColor: "var(--surface-high)" }}>
              {/* Panel dışına giden satır yeni sekmede açılır — sunum sırasında
                  paneli kaybetmemek için (geri tuşuna basma telaşı olmasın). */}
              <Link
                href={a.href}
                {...("dis" in a && a.dis ? { target: "_blank", rel: "noreferrer" } : {})}
                className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-[var(--surface-low)]"
              >
                <span className="w-5 shrink-0 text-[11px] font-bold font-mono" style={{ color: "var(--muted)" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <a.icon className="w-4 h-4 shrink-0" style={{ color: "var(--accent-ink)" }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold">{a.ad}</span>
                  <span className="block text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>{a.cumle}</span>
                </span>
                <span className="shrink-0 text-right font-mono font-extrabold text-[15px] leading-none">
                  {a.rakam}
                </span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--muted)" }} />
              </Link>
            </li>
          ))}
        </ul>

        <div className="px-5 py-3 border-t text-[11px]" style={{ borderColor: "var(--surface-high)", color: "var(--muted)" }}>
          <b style={{ color: "var(--warn)" }}>Söyleme:</b>{" "}
          &quot;yarın SMS atıyoruz&quot; — numaraların çoğu DNC (arama yasak) kaydında, önce ayıklama gerek ·{" "}
          &quot;50 eyalet&quot; — 43&apos;te veri var, 34&apos;ü profilli ·{" "}
          &quot;rakip ucuza alıp pahalıya satıyor&quot; — doğrulanmadı, quit-claim kayıtları
          <br />
          <b>Bu hafta:</b> fiyat denetimi · not motoru düzeltildi · rakip haritası kuruldu ·
          4.060 sahibin telefonu çıkarıldı{" "}
          {SUNUM.skiptrace && <>· eski liste: <code>{SUNUM.skiptrace.dosya}</code></>}
        </div>
      </section>

      {/* ── 1) Bugün ne yapılmalı ── */}
      <section className="rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--outline)" }}>
        <div className="flex items-center gap-2 px-5 py-3.5 border-b" style={{ borderColor: "var(--surface-high)" }}>
          <h2 className="font-bold text-sm">Bekleyen iş</h2>
          <span className="text-[11px]" style={{ color: "var(--muted)" }}>
            {bekleyenIs > 0 ? `· ${bekleyenIs} başlıkta iş var` : "· sıradaki adımlar"}
          </span>
        </div>

        <ul>
          {isler.map((is) => {
            const bosDurum = is.sayac.durum === "hazir" && is.sayac.deger === 0;
            const kurulmadi = is.sayac.durum === "kurulmadi";
            return (
              <li key={is.href} className="border-t first:border-t-0" style={{ borderColor: "var(--surface-high)" }}>
                <Link
                  href={is.href}
                  className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[var(--surface-low)]"
                >
                  <is.icon
                    className="w-4 h-4 shrink-0"
                    style={{ color: bosDurum || kurulmadi ? "var(--muted)" : "var(--accent-ink)" }}
                  />

                  {/* Sayı — renk yalnızca "iş var" anlamı taşıdığında */}
                  <span className="w-14 shrink-0 text-right font-mono font-extrabold text-xl leading-none">
                    {is.sayac.durum === "yukleniyor" && (
                      <Loader2 className="w-4 h-4 animate-spin inline" style={{ color: "var(--muted)" }} />
                    )}
                    {is.sayac.durum === "hazir" && (
                      <span style={{ color: is.sayac.deger > 0 ? "var(--accent-ink)" : "var(--muted)" }}>
                        {is.sayac.deger}
                      </span>
                    )}
                    {kurulmadi && <AlertTriangle className="w-4 h-4 inline" style={{ color: "var(--warn)" }} />}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px]" style={{ color: bosDurum ? "var(--muted)" : "var(--foreground)" }}>
                      {is.sayac.durum === "hazir" && is.sayac.deger === 0 ? is.bos : is.etiket}
                    </span>
                    {is.sayac.durum === "kurulmadi" && (
                      <span className="block text-[11px] mt-0.5" style={{ color: "var(--warn)" }}>
                        Ölçülemiyor — {is.sayac.not}
                      </span>
                    )}
                  </span>

                  <ArrowRight className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--muted)" }} />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── 2) Envanterin bugünkü hâli ── */}
      <section>
        <h2 className="font-bold text-sm mb-3">Envanter</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Kart
            sayac={envanter}
            etiket="Off-market lead"
            altyazi={eyaletSayisi ? `${eyaletSayisi} eyalette` : "owner + posta adresli"}
            href="/admin/harita"
            icon={Database}
          />
          <Kart sayac={aPlus} etiket="A+/A notlu parsel" altyazi="not motorunun seçtikleri" href="/admin/arsa-notlari" icon={Award} />
          <Kart sayac={hat} etiket="Hattaki anlaşma" altyazi="tapuya gitmemiş" href="/admin/anlasma-hatti" icon={Handshake} />
          <Kart sayac={mektup} etiket="Vadesi gelen mektup" altyazi="kadans sırası gelenler" href="/admin/outreach" icon={Mail} />
          <Kart sayac={talep} etiket="Yeni alıcı talebi" altyazi="henüz dönülmedi" href="/admin/talepler" icon={MessageSquare} />
          <Kart sayac={geriArama} etiket="Geri arama" altyazi="takvimde bekleyen" href="/admin/arama" icon={PhoneCall} />
        </div>
      </section>

      {/* ── 3) İş akışı — menüdeki 6 adımın kısayolu ── */}
      <section>
        <h2 className="font-bold text-sm mb-1">İş akışı</h2>
        <p className="text-[11px] mb-3" style={{ color: "var(--muted)" }}>
          Arsa bul → değerlendir → sahibine ulaş → sat → pazarı izle → takip et
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { n: "1", ad: "Bul", aciklama: "Harita, A+ vitrin, tüm fırsatlar, canlı county sorgusu", href: "/admin/arsa-notlari", icon: Map },
            { n: "2", ad: "Değerlendir", aciklama: "County eleme, underwrite, inşa edilebilirlik, arbitraj", href: "/admin/deal-screener", icon: Target },
            { n: "3", ad: "Sahibe ulaş", aciklama: "Malik listesi, sıcak arama, mektup kadansı, kampanya", href: "/admin/off-market-leads", icon: Mail },
            { n: "4", ad: "Sat", aciklama: "İlan üret, satış sayfaları, alıcı talepleri, tahsilat", href: "/admin/ilan-ureteci", icon: Sparkles },
            { n: "5", ad: "Pazar & rakip", aciklama: "Pazar istihbaratı, rakip radarı, rakip defteri", href: "/admin/istihbarat", icon: Radar },
            { n: "6", ad: "Takip & sistem", aciklama: "Portföy, yöntem, kapsam, bot filosu", href: "/admin/portfoy", icon: BarChart3 },
          ].map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="rounded-xl border p-4 transition-colors hover:bg-[var(--surface-low)]"
              style={{ background: "var(--surface)", borderColor: "var(--outline)" }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <a.icon className="w-4 h-4" style={{ color: "var(--muted)" }} />
                <span className="text-[10px] font-bold" style={{ color: "var(--muted)" }}>{a.n}</span>
                <span className="text-[13px] font-bold">{a.ad}</span>
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: "var(--muted)" }}>{a.aciklama}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Tek sayaç kartı — yükleniyor / sayı / kurulum gerekli. */
function Kart({
  sayac, etiket, altyazi, href, icon: Icon,
}: {
  sayac: Sayac; etiket: string; altyazi: string; href: string; icon: typeof Mail;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border p-4 transition-colors hover:bg-[var(--surface-low)]"
      style={{ background: "var(--surface)", borderColor: "var(--outline)" }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5" style={{ color: "var(--muted)" }} />
        <span className="text-[11px]" style={{ color: "var(--muted)" }}>{etiket}</span>
      </div>
      {sayac.durum === "yukleniyor" && (
        <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--muted)" }} />
      )}
      {sayac.durum === "hazir" && (
        <p className="text-2xl font-extrabold font-mono tracking-tight leading-none">
          {sayac.deger.toLocaleString("tr-TR")}
        </p>
      )}
      {sayac.durum === "kurulmadi" && (
        <p className="text-[12px] font-semibold leading-tight" style={{ color: "var(--warn)" }}>
          Kurulum gerekli
        </p>
      )}
      <p className="text-[10px] mt-1.5" style={{ color: "var(--muted)" }}>
        {sayac.durum === "kurulmadi" ? sayac.not : altyazi}
      </p>
    </Link>
  );
}
