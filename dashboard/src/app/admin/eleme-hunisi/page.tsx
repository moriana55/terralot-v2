"use client";

/**
 * ELEME HUNİSİ — "milyonlarca parselden bir avuç deal'e" ekranı.
 *
 * KİME GÖSTERİLİYOR: sahibe ve YATIRIMCIYA. Bu yüzden buradaki her sayının
 * altında kaynağı yazar ve üç ölçü asla karıştırılmaz:
 *
 *   ERİŞİLEBİLİR  sorgulayabildiğimiz havuz   (kapsam ölçümü + eyalet katmanları)
 *   İNCELENEN     gerçekten çekilip elenen    (birikimli hasat logu)
 *   KAYITLI       DB'de duran lead            (canlı sorgu)
 *
 * Sayfada TEK BİR sabit rakam yoktur; hepsi /api/admin/eleme-hunisi'nden gelir.
 * Yeni bir hasat turu koştuğunda birikimli sayaç kendiliğinden büyür.
 *
 * SUNUM MODU: `?sunum=1` → sayfa tam ekran bir katman olarak açılır (sol menü
 * görünmez), tipografi büyür, iç sistem detayı (tablo/dosya/API adları, hata
 * mesajları, teknik kural anahtarları) GİZLENİR.
 *
 * Renk kuralı (dataviz): iki renk var, ikisi de anlam taşır —
 *   mavi  = ÖLÇÜLMÜŞ İŞ (incelenen/uygun/kayıtlı/eleme kırılımı)
 *   gri   = yalnızca ERİŞİLEBİLİR havuz — bilerek geri planda, "bu iş değil".
 * Gri, kroma tabanının altında olduğu için kategorik bir seri değildir;
 * "seri değil" mesajını taşıyan nötr işarettir. Her bar doğrudan etiketlidir.
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Filter, Loader2, AlertCircle, ArrowRight, Presentation, X } from "lucide-react";
import Dropdown from "@/components/Dropdown";
import type { ElemeSatiri, EyaletKatmani } from "@/lib/eleme-hunisi";

// ── Renkler — tek yerde ─────────────────────────────────────────────────────
const MAVI = "#3980f4"; // ölçülmüş iş
const GRI = "#8a8b92"; // yalnızca erişilebilir havuz

// ── Kural anahtarı → insan dili ─────────────────────────────────────────────
// Anahtar burada yoksa ham anahtar gösterilir (uydurma etiket üretilmez).
const KURAL_ADI: Record<string, { ad: string; aciklama: string }> = {
  // 2026-07-29'a kadar eleme kuralıydı; artık DEĞİL (absentee bir motivasyon
  // sinyali ve not motorunda zaten puanlanıyordu — çifte uygulanıyordu).
  // Anahtar burada duruyor çünkü eski turların defter kaydında hâlâ var.
  "absentee-degil": {
    ad: "Sahibi eyalet içinde oturuyor (kural kaldırıldı)",
    aciklama:
      "Eski turlarda eleme sebebiydi. 29 Tem 2026'dan beri elemiyor: uzakta oturmak bir motivasyon sinyali, notu etkiliyor ama kapıdan çevirmiyor.",
  },
  "deger-bandi": {
    ad: "Değer bandı dışında",
    aciklama: "Arazi değeri 300 $ altında ya da 75.000 $ üstünde.",
  },
  "acre-bandi": {
    ad: "Büyüklük bandı dışında",
    aciklama: "Dönüm bilgisi yok ya da 0,25 acre altı / 640 acre üstü.",
  },
  "kamu-sahipli": {
    ad: "Kamu / kurum sahipli",
    aciklama: "Eyalet, county, federal idare ya da şablon sahip kaydı.",
  },
  "mektup-eksik": {
    ad: "Posta adresi eksik",
    aciklama: "Beş posta alanından en az biri boş — mektup atılamaz.",
  },
  mukerrer: {
    ad: "Mükerrer kayıt",
    aciklama: "Aynı parsel numarası ikinci kez geldi.",
  },
};

// ── Tipler ──────────────────────────────────────────────────────────────────
interface Yanit {
  erisim: {
    kapsam: {
      toplamParsel: number;
      countySayisi: number;
      eyaletSayisi: number;
      olcumZamani: string | null;
      sayilamayan: number;
    };
    katmanlar: EyaletKatmani[];
    katmanToplam: number;
    dipnot: string;
  };
  is: {
    turSayisi: number;
    aday: number;
    yazilan: number;
    elenenToplam: number;
    eleme: ElemeSatiri[];
    eyaletler: string[];
    ilkTur: string | null;
    sonTur: string | null;
    gecisOrani: number | null;
  };
  havuz: {
    kayitli: number | null;
    eyaletSayisi: number | null;
    mektupAtilabilir: number | null;
    yatirimaUygun: number | null;
    dealler: { state: string; adet: number }[];
    geoBekleyen: number | null;
    geoDogrulanmis: number | null;
    hata: string | null;
  };
  olculmeZamani: string;
}

// ── Biçimleme ───────────────────────────────────────────────────────────────
const N = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("tr-TR"));

/** Yüzde — null ise "—". Bu fonksiyon sayesinde ekranda "%NaN" çıkamaz. */
function P(v: number | null | undefined, basamak = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `%${v.toFixed(basamak).replace(".", ",")}`;
}

function tarih(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Sıfıra bölünmeyen bar genişliği (%). */
function bar(deger: number | null, enBuyuk: number): number {
  if (deger == null || !(enBuyuk > 0)) return 0;
  return Math.max(0, Math.min(100, (deger / enBuyuk) * 100));
}

// ── Küçük parçalar ──────────────────────────────────────────────────────────

function Kart({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-[14px] border p-5 sm:p-6 ${className}`}
      style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}
    >
      {children}
    </section>
  );
}

function Baslik({ ust, alt }: { ust: string; alt?: string }) {
  return (
    <header className="mb-4">
      <h2 className="text-base sm:text-lg font-bold" style={{ color: "var(--foreground)" }}>
        {ust}
      </h2>
      {alt && (
        <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--muted)" }}>
          {alt}
        </p>
      )}
    </header>
  );
}

/** Bir sayının nereden geldiği — ekranda her bloğun altında görünür. */
function Kaynak({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>
      kaynak · {children}
    </p>
  );
}

/** Yatay bar + doğrudan etiket. Renk kategori değil, ölçü TÜRÜ demek. */
function BarSatiri({
  ad,
  aciklama,
  deger,
  oranMetni,
  genislik,
  renk,
  buyuk = false,
}: {
  ad: string;
  aciklama?: string;
  deger: number | null;
  oranMetni?: string | null;
  genislik: number;
  renk: string;
  buyuk?: boolean;
}) {
  return (
    <li className="py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span
          className={`font-semibold ${buyuk ? "text-[15px] sm:text-base" : "text-[13px] sm:text-sm"}`}
          style={{ color: "var(--foreground)" }}
        >
          {ad}
        </span>
        <span className="flex items-baseline gap-2 tabular-nums">
          <span
            className={`font-bold ${buyuk ? "text-lg sm:text-2xl" : "text-[15px] sm:text-lg"}`}
            style={{ color: "var(--foreground)" }}
          >
            {N(deger)}
          </span>
          {oranMetni && (
            <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
              {oranMetni}
            </span>
          )}
        </span>
      </div>
      <div
        className="mt-1.5 h-2.5 w-full overflow-hidden rounded-[4px]"
        style={{ background: "var(--surface-high)" }}
        role="img"
        aria-label={`${ad}: ${N(deger)}`}
      >
        <div className="h-full rounded-[4px]" style={{ width: `${genislik}%`, background: renk }} />
      </div>
      {aciklama && (
        <p className="mt-1 text-[12px] leading-snug" style={{ color: "var(--muted)" }}>
          {aciklama}
        </p>
      )}
    </li>
  );
}

// ── Sayfa ───────────────────────────────────────────────────────────────────

export default function ElemeHunisiPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm" style={{ color: "var(--muted)" }}>
          Yükleniyor…
        </div>
      }
    >
      <ElemeHunisiIcerik />
    </Suspense>
  );
}

function ElemeHunisiIcerik() {
  const [d, setD] = useState<Yanit | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [siralama, setSiralama] = useState<"adet" | "ad">("adet");

  /** `?sunum=1` → temiz yatırımcı görünümü (sol menü ve iç detay gizli). */
  const sunum = useSearchParams().get("sunum") === "1";

  // Sunum modunda arka plan (sol menü + admin gövdesi) kaymasın: katman kendi
  // içinde kayar. Moddan çıkılınca gövde eski haline döner.
  useEffect(() => {
    if (!sunum) return;
    const onceki = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = onceki;
    };
  }, [sunum]);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    setHata(null);
    try {
      const res = await fetch("/api/admin/eleme-hunisi");
      const j = await res.json();
      if (!res.ok) {
        setHata(j?.error || `Yüklenemedi (HTTP ${res.status})`);
        return;
      }
      setD(j as Yanit);
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Ağ hatası");
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  const dealler = useMemo(() => {
    const liste = [...(d?.havuz.dealler ?? [])];
    return siralama === "ad"
      ? liste.sort((a, b) => a.state.localeCompare(b.state))
      : liste.sort((a, b) => b.adet - a.adet);
  }, [d, siralama]);

  /** Tablo barlarının ölçeği — sıralamadan bağımsız, en büyük eyalet %100. */
  const enBuyukDeal = useMemo(
    () => (d?.havuz.dealler ?? []).reduce((m, x) => Math.max(m, x.adet), 0),
    [d]
  );

  const kabuk = sunum
    ? "fixed inset-0 z-[60] overflow-y-auto overflow-x-hidden"
    : "min-h-screen overflow-x-hidden";

  if (yukleniyor || (!d && !hata)) {
    return (
      <div className={kabuk} style={{ background: "var(--surface)" }}>
        <div className="flex min-h-[60vh] items-center justify-center gap-2" style={{ color: "var(--muted)" }}>
          <Loader2 className="h-5 w-5 animate-spin" /> Canlı sayılar okunuyor…
        </div>
      </div>
    );
  }

  if (hata || !d) {
    return (
      <div className={kabuk} style={{ background: "var(--surface)" }}>
        <div className="mx-auto max-w-3xl px-5 py-16">
          <Kart>
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--error)" }} />
              <div>
                <p className="font-semibold" style={{ color: "var(--foreground)" }}>
                  Huni verisi okunamadı
                </p>
                <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                  {sunum ? "Veri kaynağına ulaşılamadı." : hata}
                </p>
                <button
                  onClick={() => void yukle()}
                  className="mt-3 rounded-lg border px-3 py-1.5 text-sm font-medium"
                  style={{ borderColor: "var(--border-strong)", color: "var(--foreground)" }}
                >
                  Yeniden dene
                </button>
              </div>
            </div>
          </Kart>
        </div>
      </div>
    );
  }

  const { erisim, is, havuz } = d;

  // ── Huni A: yapılan iş (birikimli) ────────────────────────────────────────
  const isEnBuyuk = is.aday;
  // ── Huni B: kayıtlı havuz (canlı) ─────────────────────────────────────────
  const havuzEnBuyuk = havuz.kayitli ?? 0;
  // ── Erişim barları ────────────────────────────────────────────────────────
  const erisimEnBuyuk = Math.max(erisim.kapsam.toplamParsel, erisim.katmanToplam);
  // ── Eleme kırılımı ────────────────────────────────────────────────────────
  const elemeEnBuyuk = is.eleme.reduce((m, e) => Math.max(m, e.adet), 0);

  const kapsamKaynagi = `kapsam ölçümü ${tarih(erisim.kapsam.olcumZamani)}`;
  const hasatKaynagi = is.sonTur ? `hasat logu ${tarih(is.sonTur)}` : "hasat logu — henüz tur yok";
  const canliKaynak = `canlı sorgu ${tarih(d.olculmeZamani)}`;

  return (
    <div className={kabuk} style={{ background: "var(--surface)", color: "var(--foreground)" }}>
      <div className={`mx-auto w-full px-4 sm:px-6 ${sunum ? "max-w-5xl py-10 sm:py-14" : "max-w-5xl py-8"}`}>
        {/* ── Başlık ─────────────────────────────────────────────────────── */}
        <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1
              className={`font-bold tracking-tight ${sunum ? "text-3xl sm:text-5xl" : "text-2xl sm:text-3xl"}`}
              style={{ color: "var(--foreground)" }}
            >
              Eleme Hunisi
            </h1>
            <p
              className={`mt-2 ${sunum ? "text-base sm:text-lg" : "text-sm"}`}
              style={{ color: "var(--muted)" }}
            >
              Yüz binlerce parseli tarayıp bir avuç yatırımlık arsaya inen yol — her rakam
              ölçümden gelir.
            </p>
          </div>
          {!sunum && (
            <a
              href="?sunum=1"
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium"
              style={{ borderColor: "var(--border-strong)", color: "var(--foreground)" }}
            >
              <Presentation className="h-4 w-4" /> Sunum görünümü
            </a>
          )}
        </div>

        {/* ── HERO: İNCELENEN → UYGUN ────────────────────────────────────── */}
        <Kart className="mb-6">
          <div className="flex flex-col items-stretch gap-5 sm:flex-row sm:items-center sm:gap-8">
            <div className="flex-1">
              <p
                className="text-[11px] font-bold uppercase tracking-widest"
                style={{ color: "var(--muted)" }}
              >
                İncelenen parsel
              </p>
              <p
                className={`mt-1 font-bold tabular-nums leading-none ${sunum ? "text-5xl sm:text-7xl" : "text-4xl sm:text-5xl"}`}
                style={{ color: "var(--foreground)" }}
              >
                {N(is.aday)}
              </p>
              <p className="mt-2 text-[13px] leading-snug" style={{ color: "var(--muted)" }}>
                Kaynaktan çekilip süzgeçten geçirildi. Birikimli — her hasat turunda artar.
              </p>
            </div>

            <ArrowRight
              className="hidden h-7 w-7 shrink-0 sm:block"
              style={{ color: "var(--border-strong)" }}
              aria-hidden
            />

            <div className="flex-1">
              <p
                className="text-[11px] font-bold uppercase tracking-widest"
                style={{ color: "var(--muted)" }}
              >
                Uygun parsel
              </p>
              <p
                className={`mt-1 font-bold tabular-nums leading-none ${sunum ? "text-5xl sm:text-7xl" : "text-4xl sm:text-5xl"}`}
                style={{ color: MAVI }}
              >
                {N(is.yazilan)}
              </p>
              <p className="mt-2 text-[13px] leading-snug" style={{ color: "var(--muted)" }}>
                Beş kuralın altından da geçti — incelenenin {P(is.gecisOrani)}&apos;i.
              </p>
            </div>
          </div>

          <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--border)" }}>
            <p className="text-[13px] leading-relaxed" style={{ color: "var(--muted)" }}>
              {is.turSayisi > 0 ? (
                <>
                  {is.turSayisi} hasat turu kayda geçti ({is.eyaletler.join(" · ")}).{" "}
                  {is.ilkTur === is.sonTur
                    ? `Tur tarihi: ${tarih(is.sonTur)}.`
                    : `${tarih(is.ilkTur)} → ${tarih(is.sonTur)}.`}{" "}
                  Bundan önceki hasatların parsel bazlı logu tutulmuyordu; bu sayaç yalnızca
                  kanıtlanabilir turları sayar, geçmişi tahminle doldurmaz.
                </>
              ) : (
                <>Henüz kayda geçmiş hasat turu yok. Bu ekran ilk turdan sonra dolar.</>
              )}
            </p>
            <Kaynak>{hasatKaynagi}</Kaynak>
          </div>
        </Kart>

        {/* ── ERİŞİLEBİLİR HAVUZ (ayrı ölçü) ─────────────────────────────── */}
        <Kart className="mb-6">
          <Baslik
            ust="Erişilebilir havuz — sorgulayabildiğimiz parsel"
            alt="Bu sayı TARANMIŞ parsel değildir; kaynak servislerin bize açık olan toplam kayıt sayısıdır. Yukarıdaki 'incelenen' ile ASLA toplanmaz."
          />
          <ul>
            <BarSatiri
              ad="Ölçülmüş county havuzu"
              aciklama={`${N(erisim.kapsam.countySayisi)} county · ${N(erisim.kapsam.eyaletSayisi)} eyalet — her county'ye gerçek sorgu atılarak sayıldı.${
                erisim.kapsam.sayilamayan > 0
                  ? ` ${N(erisim.kapsam.sayilamayan)} çalışan county'nin toplamı sayılamadı, bu yüzden gerçek havuz daha büyük.`
                  : ""
              }`}
              deger={erisim.kapsam.toplamParsel}
              genislik={bar(erisim.kapsam.toplamParsel, erisimEnBuyuk)}
              renk={GRI}
            />
            <BarSatiri
              ad="Eyalet geneli katmanlar"
              aciklama={erisim.katmanlar
                .map((k) => `${k.state} ${N(k.parsel)}`)
                .join(" · ")}
              deger={erisim.katmanToplam}
              genislik={bar(erisim.katmanToplam, erisimEnBuyuk)}
              renk={GRI}
            />
          </ul>

          {!sunum && (
            <ul className="mt-4 space-y-2 border-t pt-4" style={{ borderColor: "var(--border)" }}>
              {erisim.katmanlar.map((k) => (
                <li key={k.state} className="text-[12px] leading-snug" style={{ color: "var(--muted)" }}>
                  <span className="font-semibold" style={{ color: "var(--foreground)" }}>
                    {k.state} · {k.ad} — {N(k.parsel)}
                  </span>
                  <br />
                  {k.not} <span className="opacity-70">({k.kayit})</span>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-3 text-[12px] leading-relaxed" style={{ color: "var(--muted)" }}>
            {erisim.dipnot}
          </p>
          <Kaynak>
            {kapsamKaynagi}
            {!sunum && " · kayıt defteri (county-registry)"}
          </Kaynak>
        </Kart>

        {/* ── HUNİ A: yapılan iş ─────────────────────────────────────────── */}
        <Kart className="mb-6">
          <Baslik
            ust="1 · Yapılan iş (birikimli)"
            alt="Motorun gerçekten çekip buy-box'tan geçirdiği parseller. Yüzde, bir üstteki kademeye göredir."
          />
          <ul>
            <BarSatiri
              ad="İncelenen parsel"
              aciklama="Kaynaktan indirildi ve beş kurala tek tek sokuldu."
              deger={is.aday}
              genislik={bar(is.aday, isEnBuyuk)}
              renk={MAVI}
              buyuk
            />
            <BarSatiri
              ad="Uygun parsel"
              aciklama="Süzgeci geçip veritabanına yazıldı."
              deger={is.yazilan}
              oranMetni={P(is.gecisOrani)}
              genislik={bar(is.yazilan, isEnBuyuk)}
              renk={MAVI}
              buyuk
            />
          </ul>
          <Kaynak>{hasatKaynagi}</Kaynak>
        </Kart>

        {/* ── ELEME KIRILIMI ─────────────────────────────────────────────── */}
        <Kart className="mb-6">
          <Baslik
            ust="2 · Hangi kural kaç parseli eledi"
            alt={`İncelenen ${N(is.aday)} parselin ${N(is.elenenToplam)} tanesi bir kurala takıldı. Yüzdeler incelenen havuza göredir.`}
          />
          {is.eleme.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Henüz eleme kaydı yok.
            </p>
          ) : (
            <ul>
              {is.eleme.map((e) => {
                const meta = KURAL_ADI[e.kural];
                return (
                  <BarSatiri
                    key={e.kural}
                    ad={meta?.ad ?? e.kural}
                    aciklama={
                      sunum ? meta?.aciklama : `${meta?.aciklama ?? "Kural açıklaması tanımlı değil."} (${e.kural})`
                    }
                    deger={e.adet}
                    oranMetni={P(e.pay)}
                    genislik={bar(e.adet, elemeEnBuyuk)}
                    renk={MAVI}
                  />
                );
              })}
            </ul>
          )}
          <Kaynak>{hasatKaynagi}</Kaynak>
        </Kart>

        {/* ── HUNİ B: kayıtlı havuz ──────────────────────────────────────── */}
        <Kart className="mb-6">
          <Baslik
            ust="3 · Kayıtlı havuz ve mektup hattı (canlı)"
            alt="Veritabanında duran lead'ler. Bu havuz yukarıdaki 'incelenen' sayısından büyüktür: önceki hasat turları, birikimli sayaç kurulmadan önce koştu — o turların parsel bazlı logu yok, ama indirdikleri satırlar burada."
          />
          <ul>
            <BarSatiri
              ad="Kayıtlı lead"
              aciklama={havuz.eyaletSayisi ? `${N(havuz.eyaletSayisi)} eyalet` : undefined}
              deger={havuz.kayitli}
              genislik={bar(havuz.kayitli, havuzEnBuyuk)}
              renk={MAVI}
              buyuk
            />
            <BarSatiri
              ad="Mektup atılabilir"
              aciklama="Sahip adı ve dört posta alanının hepsi dolu."
              deger={havuz.mektupAtilabilir}
              oranMetni={
                havuz.kayitli && havuz.mektupAtilabilir != null
                  ? P((havuz.mektupAtilabilir / havuz.kayitli) * 100)
                  : "—"
              }
              genislik={bar(havuz.mektupAtilabilir, havuzEnBuyuk)}
              renk={MAVI}
              buyuk
            />
            <BarSatiri
              ad="Yatırıma uygun A+/A"
              aciklama="Coğrafi doğrulaması yapılmış, mektup atılabilir en iyi parseller."
              deger={havuz.yatirimaUygun}
              oranMetni={
                havuz.mektupAtilabilir && havuz.yatirimaUygun != null
                  ? P((havuz.yatirimaUygun / havuz.mektupAtilabilir) * 100, 2)
                  : "—"
              }
              genislik={bar(havuz.yatirimaUygun, havuzEnBuyuk)}
              renk={MAVI}
              buyuk
            />
          </ul>
          {havuz.hata && (
            <p className="mt-3 text-[12px]" style={{ color: "var(--error)" }}>
              {sunum ? "Canlı sayılar şu an okunamadı." : `Canlı sorgu hatası: ${havuz.hata}`}
            </p>
          )}
          <Kaynak>{canliKaynak}</Kaynak>
        </Kart>

        {/* ── EYALET TABLOSU ─────────────────────────────────────────────── */}
        <Kart className="mb-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold" style={{ color: "var(--foreground)" }}>
                4 · Eyalet bazında yatırımlık deal
              </h2>
              <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>
                A+/A notlu ve mektup atılabilir parseller — toplam {N(havuz.yatirimaUygun)}.
              </p>
            </div>
            {!sunum && (
              <Dropdown
                size="sm"
                className="w-52"
                aria-label="Eyalet tablosu sıralaması"
                placeholder="Sıralama"
                icon={<Filter className="h-4 w-4" />}
                value={siralama}
                onChange={(v) => setSiralama(v === "ad" ? "ad" : "adet")}
                options={[
                  { value: "adet", label: "Deal sayısı (çoktan aza)" },
                  { value: "ad", label: "Eyalet adı (A→Z)" },
                ]}
              />
            )}
          </div>

          {dealler.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Henüz A+/A notlu, mektup atılabilir parsel yok.
            </p>
          ) : (
            <div className="-mx-1 overflow-x-auto px-1">
              {/* Dağılım barı dar ekranda GİZLENİR: kırpılmış bar hepsini eşit
                  gösterip yanlış izlenim verir; "Pay" sütunu aynı bilgiyi taşır. */}
              <table className="w-full min-w-[260px] border-collapse text-sm">
                <thead>
                  <tr style={{ color: "var(--muted)" }}>
                    <th className="border-b py-2 text-left font-semibold" style={{ borderColor: "var(--border)" }}>
                      Eyalet
                    </th>
                    <th className="border-b py-2 text-right font-semibold" style={{ borderColor: "var(--border)" }}>
                      Deal
                    </th>
                    <th className="border-b py-2 text-right font-semibold" style={{ borderColor: "var(--border)" }}>
                      Pay
                    </th>
                    <th
                      className="hidden border-b py-2 pl-4 text-left font-semibold sm:table-cell"
                      style={{ borderColor: "var(--border)" }}
                    >
                      Dağılım
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dealler.map((r) => {
                    const pay =
                      havuz.yatirimaUygun && havuz.yatirimaUygun > 0
                        ? (r.adet / havuz.yatirimaUygun) * 100
                        : null;
                    return (
                      <tr key={r.state}>
                        <td className="border-b py-2 font-semibold" style={{ borderColor: "var(--border)" }}>
                          {r.state}
                        </td>
                        <td
                          className="border-b py-2 text-right font-bold tabular-nums"
                          style={{ borderColor: "var(--border)" }}
                        >
                          {N(r.adet)}
                        </td>
                        <td
                          className="border-b py-2 text-right tabular-nums"
                          style={{ borderColor: "var(--border)", color: "var(--muted)" }}
                        >
                          {P(pay)}
                        </td>
                        <td className="hidden border-b py-2 pl-4 sm:table-cell" style={{ borderColor: "var(--border)" }}>
                          <div
                            className="h-2 w-full min-w-[80px] overflow-hidden rounded-[4px]"
                            style={{ background: "var(--surface-high)" }}
                          >
                            <div
                              className="h-full rounded-[4px]"
                              style={{ width: `${bar(r.adet, enBuyukDeal)}%`, background: MAVI }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <Kaynak>{canliKaynak}</Kaynak>
        </Kart>

        {/* ── DERECELENDİRME SIRASI ──────────────────────────────────────── */}
        <Kart className="mb-6">
          <Baslik
            ust="5 · Derecelendirme sırası — neden sayı zamanla artacak"
            alt="A+/A notu YALNIZCA coğrafi olarak doğrulanmış parsele verilir: yol, elektrik, su ve yerleşim mesafesi açık kaynaktan ölçülmeden hiçbir parsel A olamaz. Doğrulaması yapılmamış kayıtlar B tavanında bekler."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                Doğrulama bekleyen
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums" style={{ color: "var(--foreground)" }}>
                {N(havuz.geoBekleyen)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                Doğrulanmış
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums" style={{ color: MAVI }}>
                {N(havuz.geoDogrulanmis)}
              </p>
            </div>
          </div>
          <p className="mt-4 text-[13px] leading-relaxed" style={{ color: "var(--muted)" }}>
            Bu bir eksiklik değil, kalite kuralıdır: doğrulanmamış parseli A göstermek yerine
            B&apos;de bekletiyoruz. Kuyruk her turda ilerlediği için yatırımlık deal sayısı
            kendiliğinden artar — bugünkü rakam tavan değil, taban.
          </p>
          <Kaynak>{canliKaynak}</Kaynak>
        </Kart>

        {/* ── Dipnot / çıkış ─────────────────────────────────────────────── */}
        <p className="pb-4 text-center text-[12px]" style={{ color: "var(--muted)" }}>
          Hiçbir rakam elle yazılmadı. Ölçüm ve hasat kaynakları her turda yenilenir; bu sayfa
          yenilendiğinde güncel sayıları okur.
        </p>

        {sunum && (
          <div className="pb-8 text-center">
            <a
              href="?"
              className="inline-flex items-center gap-1.5 text-[12px] font-medium opacity-50 hover:opacity-100"
              style={{ color: "var(--muted)" }}
            >
              <X className="h-3.5 w-3.5" /> sunumdan çık
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
