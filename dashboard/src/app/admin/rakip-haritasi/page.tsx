/**
 * RAKİP HARİTASI — tek ekranda "piyasada kim var, nerede, ne büyüklükte".
 *
 * NEDEN AYRI BİR SAYFA:
 * Rakip verisi panelde 5 ekrana dağılmıştı (Gokce dosyası, Rakip Kanıtı, Rakip
 * Radar, Toplu Alıcılar, İstihbarat). Her biri kendi sorusuna doğru cevap
 * veriyor ama "bütün piyasa nerede duruyor, biz neredeyiz" sorusunun tek bir
 * cevabı yoktu. Bu sayfa o üst görünüm; detay için ilgili ekrana yollar.
 *
 * SUNUM SAYFASI DEĞİL, ÖLÇÜM SAYFASI. Kurallar:
 *  • Ortalama fiyat SADECE kirlenmemiş kaynaklarda gösterilir. Landio ve
 *    AZ satırlarındaki 3,4M–7,2M ortalamalar çiftlik/ranch ilanlarının
 *    kaçak girmesinden geliyor; sayı olarak gösterilir, FİYAT olarak değil.
 *  • Rakibin tapudaki bedeli "ucuza aldı" diye sunulmaz — Gokce'nin Putnam
 *    kayıtlarının tamamı quit-claim kodlu ve alım fiyatı değil. Bu ders
 *    iki kez alındı (Mohave, Gokce); freni sayfanın dibinde duruyor.
 *  • İlan fiyatı = İSTENEN fiyat. Gerçekleşmiş satış için Çevirme Kanıtı.
 */

import Link from "next/link";
import { Radar, Building2, Receipt, Gavel, Users, AlertTriangle, ExternalLink } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase";
import gokce from "@/data/gokce-capital.json";
import kanit from "@/data/rakip-kanit.json";
import defter from "@/data/rakip-defteri.json";
import buyukler from "@/data/buyuk-oyuncular.json";

export const dynamic = "force-dynamic";

const ACCENT = "#0f766e";
const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const tr = (n: number) => n.toLocaleString("tr-TR");

/**
 * Envanterimizin canlı ölçüsü. Sabit yazılmaz — hasat her gece satır ekliyor.
 *
 * `count: "exact"` KULLANILMAZ: 1,25 milyon satırda PostgREST sayımı zaman
 * aşımına düşüyor ve hatayı yutup 0 gösteriyordu — müşteri karşısında "envanter
 * 0" yazan bir ekran. Bunun yerine sunucu tarafında toplayan `offmarket_grade_matrix`
 * RPC'si (eyalet × not kırılımı, ~250 ms) kullanılır; Eleme Hunisi ekranı da
 * aynı kaynağı okuyor, dolayısıyla iki ekran asla çelişmez.
 *
 * Hata SESSİZCE 0'a düşmemeli: null döner, sayfa rakam yerine açık uyarı gösterir.
 */
type Matris = { state: string | null; grade: string | null; n: number };

async function bizimOlcek(): Promise<{ parsel: number; ustNot: number; eyalet: number } | null> {
  try {
    const { data, error } = await supabaseAdmin().rpc("offmarket_grade_matrix");
    if (error) throw error;
    const satirlar = (data ?? []) as Matris[];
    if (!satirlar.length) return null;

    let parsel = 0, ustNot = 0;
    const eyaletler = new Set<string>();
    for (const r of satirlar) {
      parsel += r.n;
      if (r.grade === "A+" || r.grade === "A") ustNot += r.n;
      if (r.state) eyaletler.add(r.state);
    }
    return { parsel, ustNot, eyalet: eyaletler.size };
  } catch (e) {
    console.error("[rakip-haritasi] envanter ölçümü başarısız:", e);
    return null;
  }
}

/** Rakip ilan durumlarını firma bazında toplar. */
function firmaOzeti() {
  const m = new Map<string, { aktif: number; sozlesmede: number; satildi: number; toplam: number; ortFiyat: number | null }>();
  for (const d of kanit.durum) {
    const v = m.get(d.competitor) ?? { aktif: 0, sozlesmede: 0, satildi: 0, toplam: 0, ortFiyat: null };
    if (d.status === "ACTIVE") { v.aktif += d.n; v.ortFiyat = d.ort_fiyat; }
    else if (d.status === "PENDING") v.sozlesmede += d.n;
    else if (d.status === "SUSPECTED_SOLD") v.satildi += d.n;
    v.toplam += d.n;
    m.set(d.competitor, v);
  }
  return m;
}

/**
 * Ortalama fiyat güvenilir mi? Çiftlik/ranch ilanı kaçmış listelerde ortalama
 * milyonlara fırlıyor — boş arsa piyasasını temsil etmiyor, gösterilmez.
 */
const FIYAT_TAVANI = 200_000;
const fiyatGuvenilir = (n: number | null): n is number => n !== null && n > 0 && n < FIYAT_TAVANI;

export default async function RakipHaritasi() {
  const biz = await bizimOlcek();
  const ozet = firmaOzeti();

  const dl = ozet.get("Discount Lots")!;
  const landio = ozet.get("Landio")!;
  const rina = ozet.get("Rina Land")!;

  // Mohave tapu kaydından çıkan, marka sitesi olmayan büyük sahipler.
  const mohave = buyukler.oyuncular.slice(0, 6);

  const firmalar = [
    {
      ad: "Gokce Capital",
      alt: "Erika Gokce · gokcecapital.com",
      model: "Sahipten nakit teklifle alır, kendi portföyünde tutar veya satar. Emlakçı değil — sattığı parselin sahibi.",
      olcek: `${gokce.ozet.parselSayisi} parsel · ${gokce.ozet.countySayisi} county · ${gokce.ozet.eyaletSayisi} eyalet`,
      ilan: `${gokce.ilanOzet.sayi} canlı ilan`,
      fiyat: null as number | null,
      neden: "İçerik motoru (kitap + YouTube + blog) ile inbound satıcı topluyor.",
      link: "/admin/gokce-capital",
      linkAd: "Dosyayı aç",
      vurgu: true,
    },
    {
      ad: "Discount Lots",
      alt: "discountlots.com",
      model: "Taksitli (owner-finance) boş arsa satışı. Tapu kaydında alım işlemleri izlenebiliyor.",
      olcek: `${dl.toplam} ilan izlendi`,
      ilan: `${dl.aktif} aktif · ${dl.satildi} ilanı kalktı`,
      fiyat: fiyatGuvenilir(dl.ortFiyat) ? dl.ortFiyat : null,
      neden: `İlanı kalkanlar SATILDI DEMEK DEĞİL — ilan siteden kaldırılmış olabilir, yeniden yayınlanmış da. Tapuyla eşleşen ${kanit.marj.length} kayıtta ilan fiyatı / tapu bedeli oranı ortalama x${kanit.ortKat}. ${kanit.tapuSiniri}`,
      link: "/admin/rakip-kanit",
      linkAd: "Kanıta git",
    },
    {
      ad: "Landio",
      alt: "landio.com · Proverbs Real Estate LLC",
      model: "Büyük parsel ağırlıklı, yüksek trafikli ilan sitesi. Taksit ve peşinat şartları açık yayınlıyor.",
      olcek: `${kanit.landioOzet.toplam} ilan · ${kanit.landioOzet.taksitli} taksitli · ${kanit.landioOzet.kendiMali} kendi malı`,
      ilan: `${landio.aktif} aktif · ${landio.sozlesmede} sözleşmede`,
      fiyat: null,
      neden: `İlan başına ortalama ${tr(kanit.landioOzet.ortGorulme)} görüntülenme. Ortalama fiyat çiftlik ilanlarıyla kirli — gösterilmiyor.`,
      link: "/admin/rakip-kanit",
      linkAd: "Kanıta git",
    },
    {
      ad: "Rina Land",
      alt: "rinaland.com · Land Century ailesi",
      model: "Küçük ölçekli, ucuz bant. 2006'dan beri arsa satan bir markanın devamı.",
      olcek: `${rina.toplam} ilan izlendi`,
      ilan: `${rina.aktif} aktif · ${rina.satildi} ilanı kalktı`,
      fiyat: fiyatGuvenilir(rina.ortFiyat) ? rina.ortFiyat : null,
      neden: "Bizim bandımızın en altıyla çakışıyor — fiyat tabanını okumak için faydalı.",
      link: "/admin/rakip-radar",
      linkAd: "Radara git",
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold flex items-center gap-2.5">
        <span className="inline-grid place-items-center w-10 h-10 rounded-xl" style={{ background: `${ACCENT}1c` }}>
          <Radar size={20} style={{ color: ACCENT }} />
        </span>
        Rakip Haritası — piyasada kim var, biz neredeyiz
      </h1>
      <p className="mt-2 text-sm max-w-3xl" style={{ color: "var(--muted)" }}>
        Marka sitesi olan operatörler, tapu kaydından çıkan sessiz büyük sahipler ve bizim
        envanterimizle örtüşen bölgeler. Rakamların hepsi ölçüm — iddia yok.
      </p>

      {/* ── Ölçek kıyası ─────────────────────────────────────────────── */}
      <section className="mt-6 rounded-xl border p-5" style={{ borderColor: `${ACCENT}44`, background: `${ACCENT}0a` }}>
        <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: ACCENT }}>Ölçek kıyası</h2>
        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            ["Bizim envanter", biz ? tr(biz.parsel) : "—", biz ? `${biz.eyalet} eyalette notlanmış parsel` : "ölçüm okunamadı"],
            ["Bizim A+ / A", biz ? tr(biz.ustNot) : "—", biz ? "üst dilim" : "ölçüm okunamadı"],
            ["En yakın rakip envanteri", tr(gokce.ozet.parselSayisi), "Gokce Capital, tapu kaydından"],
            ["İzlenen canlı rakip ilanı", tr(dl.toplam + landio.toplam + rina.toplam), "3 markanın toplamı"],
          ].map(([k, v, alt]) => (
            <div key={k}>
              <div className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>{k}</div>
              <div className="text-2xl font-bold tabular-nums mt-0.5">{v}</div>
              <div className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>{alt}</div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
          Bu kıyas <b>envanter büyüklüğü</b> içindir, satış performansı değil. Rakiplerin hepsi bizden
          çok daha uzun süredir satış yapıyor; bizim üstünlüğümüz elimizdeki aday havuzunun genişliği.
        </p>
      </section>

      {/* ── Marka siteli operatörler ─────────────────────────────────── */}
      <h2 className="mt-8 text-lg font-bold flex items-center gap-2">
        <Building2 size={18} style={{ color: ACCENT }} /> Marka siteli operatörler
      </h2>
      <div className="mt-3 grid md:grid-cols-2 gap-4">
        {firmalar.map((f) => (
          <div
            key={f.ad}
            className="rounded-xl border p-5 flex flex-col"
            style={{ borderColor: f.vurgu ? `${ACCENT}66` : "var(--border)", background: f.vurgu ? `${ACCENT}08` : "transparent" }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <div className="font-bold">{f.ad}</div>
                <div className="text-[11px]" style={{ color: "var(--muted)" }}>{f.alt}</div>
              </div>
              {f.fiyat !== null && (
                <div className="text-right shrink-0">
                  <div className="text-lg font-bold tabular-nums">{usd(f.fiyat)}</div>
                  <div className="text-[10px]" style={{ color: "var(--muted)" }}>ortalama istenen</div>
                </div>
              )}
            </div>
            <p className="mt-3 text-sm leading-relaxed">{f.model}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              <span className="px-2 py-1 rounded-md tabular-nums" style={{ background: "var(--border)" }}>{f.olcek}</span>
              <span className="px-2 py-1 rounded-md tabular-nums" style={{ background: "var(--border)" }}>{f.ilan}</span>
            </div>
            <p className="mt-3 text-xs leading-relaxed flex-1" style={{ color: "var(--muted)" }}>{f.neden}</p>
            <Link href={f.link} className="mt-3 text-xs font-bold inline-flex items-center gap-1" style={{ color: ACCENT }}>
              {f.linkAd} <ExternalLink size={12} />
            </Link>
          </div>
        ))}
      </div>

      {/* ── Örtüşme ──────────────────────────────────────────────────── */}
      <h2 className="mt-8 text-lg font-bold flex items-center gap-2">
        <Users size={18} style={{ color: ACCENT }} /> Aynı bölgede kaç parselimiz var
      </h2>
      <p className="mt-1.5 text-sm max-w-3xl" style={{ color: "var(--muted)" }}>
        Gokce Capital'in parsel tuttuğu her bölgede bizim envanterimiz. Rakibin bir bölgeye
        girmiş olması o bölgenin çalıştığının işareti — biz aynı yerde çok daha geniş bir
        aday havuzuyla duruyoruz.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              <th className="py-2 pr-4 font-semibold">Bölge</th>
              <th className="py-2 pr-4 font-semibold text-right">Bizim parsel</th>
              <th className="py-2 pr-4 font-semibold text-right">Bunun A+/A'sı</th>
            </tr>
          </thead>
          <tbody>
            {gokce.ortusme.map((o) => (
              <tr key={o.bolge} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="py-2 pr-4 font-medium">{o.bolge}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{tr(o.bizim_parsel)}</td>
                <td className="py-2 pr-4 text-right tabular-nums" style={{ color: ACCENT }}>{tr(o.bizim_ustnot)}</td>
              </tr>
            ))}
            <tr className="border-t-2 font-bold" style={{ borderColor: "var(--border)" }}>
              <td className="py-2 pr-4">Toplam</td>
              <td className="py-2 pr-4 text-right tabular-nums">{tr(gokce.ozet.ortusenBizimParsel)}</td>
              <td className="py-2 pr-4 text-right tabular-nums" style={{ color: ACCENT }}>{tr(gokce.ozet.ortusenBizimUstNot)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Sessiz büyük sahipler ────────────────────────────────────── */}
      <h2 className="mt-8 text-lg font-bold flex items-center gap-2">
        <Gavel size={18} style={{ color: ACCENT }} /> Sitesi olmayan büyük sahipler
      </h2>
      <p className="mt-1.5 text-sm max-w-3xl" style={{ color: "var(--muted)" }}>
        Mohave County tapu kaydından çıkarıldı — hiçbirinin satış sitesi yok, ama tek bir
        county'de bizim bir eyalette tuttuğumuzdan fazla parsel biriktirmişler. Bunlar rakip
        değil, <b>potansiyel toplu alıcı</b>: posta adresleri elimizde.
      </p>
      <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {mohave.map((o) => (
          <div key={o.id} className="rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-bold text-sm">{o.kisaAd}</span>
              <span className="text-lg font-bold tabular-nums shrink-0">{tr(o.parselSayisi)}</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>{o.not}</p>
          </div>
        ))}
      </div>
      <Link href="/admin/toplu-alicilar" className="mt-3 inline-flex items-center gap-1 text-xs font-bold" style={{ color: ACCENT }}>
        Toplu alıcılar ekranı — posta adresleriyle <ExternalLink size={12} />
      </Link>

      {/* ── Pazar ekonomisi ──────────────────────────────────────────── */}
      <h2 className="mt-8 text-lg font-bold flex items-center gap-2">
        <Receipt size={18} style={{ color: ACCENT }} /> Piyasa hangi şartlarla satıyor
      </h2>
      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ["Medyan peşinat", `%${kanit.medyanPesinat}`, `bant %${kanit.pesinatBandi.min} – %${kanit.pesinatBandi.max}`],
          ["Taksitli ilan", tr(kanit.landioOzet.taksitli), `Landio'nun ${kanit.landioOzet.toplam} ilanı içinde`],
          ["Sözleşmeye bağlanan", tr(landio.sozlesmede + dl.sozlesmede + rina.sozlesmede), "şu an pending görünen ilan"],
          // Kaynak eyalet alanı karışık ("Florida", "FL", bazen null) — ilk iki
          // harfe indirip tekilleştiriyoruz, boş satırlar sayıma girmiyor.
          ["İzlenen eyalet", tr(new Set(kanit.eyalet.map((e) => e.state?.slice(0, 2).toUpperCase()).filter(Boolean)).size), "rakip ilanı görülen"],
        ].map(([k, v, alt]) => (
          <div key={k} className="rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
            <div className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>{k}</div>
            <div className="text-xl font-bold tabular-nums mt-0.5">{v}</div>
            <div className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>{alt}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs leading-relaxed max-w-3xl" style={{ color: "var(--muted)" }}>
        Peşinat %2'ye kadar inebiliyor. Taksitli satış bu piyasada istisna değil kural —
        alıcının nakdi yetmediği için değil, satıcı vadeye yayınca fiyatı yukarı çekebildiği için.
      </p>

      {/* ── Dürüstlük freni ──────────────────────────────────────────── */}
      <section className="mt-8 rounded-xl border p-5" style={{ borderColor: "#d9770655", background: "#d977060f" }}>
        <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: "#d97706" }}>
          <AlertTriangle size={16} /> Bu sayfadan çıkarılamayacak sonuçlar
        </h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed">
          <li>
            <b>"Rakip ucuza alıp pahalıya satıyor" denemez.</b> Gokce'nin Putnam'daki 10 tapu
            kaydının tamamı quit-claim kodlu — bunlar piyasa alımı değil, devir işlemi. Ödenen
            bedel alım fiyatı sayılmaz. Aynı hata Mohave'de de yapıldı.
          </li>
          <li>
            <b>İlan fiyatı satış fiyatı değildir.</b> Buradaki bütün fiyatlar İSTENEN fiyat.
            Gerçekleşmiş alım–satım için{" "}
            <Link href="/admin/cevirme-kaniti" className="font-bold underline" style={{ color: ACCENT }}>Çevirme Kanıtı</Link>{" "}
            ekranı — orada tapu sicilinden çıkan gerçek çiftler var.
          </li>
          <li>
            <b>"Satılmış görünüyor" kesin değil.</b> İlanın siteden kalkması satıldığı anlamına
            gelmiyor; kaldırılmış da olabilir. Tapuyla doğrulanan tek küme{" "}
            {tr(kanit.marj.length)} kayıt.
          </li>
          <li>
            <b>Tapu verisi sınırlı.</b> {kanit.tapuSiniri}
          </li>
          <li>
            <b>Mohave sahipleri tek county'den.</b> Diğer county'lerde benzer birikimler
            büyük olasılıkla var, ama ölçülmedi — {tr(defter.toplamKayit)} kayıtlık defter
            yalnız Mohave'yi kapsıyor.
          </li>
        </ul>
      </section>
    </div>
  );
}
