// ─────────────────────────────────────────────────────────────────────────────
// HASAT DURUMU — günlük veri hasadının makine-okunur sağlık görünümü.
//
// Kaynak: scraper/.hasat-durum.json — her koşu sonunda scraper/hasat-runner.mjs
// yazar. Bu dosyada UYDURMA YOK: panel ne yazıyorsa runner'ın ölçtüğü şeydir.
//
// NEDEN VAR (2026-07-29 teşhisi): eski kurulumda launchd bir AYNA klasörde
// koşuyordu, ayna 29 Haziran'da senkronsuz kalmıştı ve run-all.sh her hatayı
// yutup exit 0 döndüğü için durum dosyası 3,5 hafta boyunca her gün "başarılı"
// yazdı. Sahip veri aktığını sandı. Bu modül o yanılsamayı imkânsız kılar:
//   • "son BAŞARILI hasat" ayrı izlenir (son koşu ≠ son başarılı koşu),
//   • durum dosyasının KENDİSİ bayatlarsa (runner hiç koşmadıysa) kırmızı olur,
//   • dosya yoksa "bilinmiyor" denir — yeşil varsayılmaz.
// ─────────────────────────────────────────────────────────────────────────────

/** Son başarılı hasadın üstünden bu kadar saat geçerse kırmızı. */
export const HASAT_BAYAT_SAAT = 36;
/** Runner hiç koşmadıysa (başarılı/başarısız fark etmez) bu saatten sonra kırmızı. */
export const HASAT_SESSIZ_SAAT = 30;

export interface HasatAdim {
  ad: string;
  kod: number;
  sureSn: number;
  hata?: string | null;
}

export interface HasatSatir {
  once: number | null;
  sonra: number | null;
  delta: number | null;
}

export interface HasatDurumDosyasi {
  surum?: number;
  sonKosuBaslangic?: string | null;
  sonKosuBitis?: string | null;
  sonKosuBasarili?: boolean;
  sonBasariliKosu?: string | null;
  ustUsteHata?: number;
  sonHata?: string | null;
  smoke?: boolean;
  sureSn?: number;
  adimlar?: HasatAdim[];
  satirlar?: Record<string, HasatSatir>;
  toplamYeniSatir?: number;
  countyler?: { ad: string; satir: number }[];
  countySayisi?: number;
  log?: string | null;
}

export type HasatRenk = "yesil" | "sari" | "kirmizi" | "bilinmiyor";

export interface HasatSagligi {
  renk: HasatRenk;
  /** "Son başarılı hasat: 4 saat önce" gibi tek cümlelik başlık. */
  baslik: string;
  /** Neden bu renk — sahibe ne yapması gerektiğini söyleyen açıklama. */
  aciklama: string;
  /** Son başarılı hasadın üstünden geçen saat (bilinmiyorsa null). */
  basariliSaat: number | null;
  /** Son koşunun (başarılı ya da değil) üstünden geçen saat. */
  kosuSaat: number | null;
  basarisizAdimlar: HasatAdim[];
  toplamYeniSatir: number | null;
}

function saatFarki(ts: string | null | undefined, now: Date): number | null {
  if (!ts) return null;
  const ms = now.getTime() - new Date(ts).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, ms / 3600000);
}

/** "3 saat önce" / "az önce" / "2 gün önce" — insan diliyle yaş. */
export function yasEtiketi(saat: number | null): string {
  if (saat == null) return "hiç";
  if (saat < 1) return "az önce";
  if (saat < 48) return `${Math.floor(saat)} saat önce`;
  return `${Math.floor(saat / 24)} gün önce`;
}

/**
 * Durum dosyasını renk + cümleye çevirir.
 * @param d  .hasat-durum.json içeriği (dosya yoksa null)
 */
export function hasatSagligi(d: HasatDurumDosyasi | null, now = new Date()): HasatSagligi {
  const basarisizAdimlar = (d?.adimlar ?? []).filter((a) => a.kod !== 0);

  if (!d) {
    return {
      renk: "bilinmiyor",
      baslik: "Hasat durumu bilinmiyor",
      aciklama:
        "scraper/.hasat-durum.json bulunamadı. Otomasyon hiç koşmamış olabilir — " +
        "kur: bash scraper/launchd-kur.sh",
      basariliSaat: null,
      kosuSaat: null,
      basarisizAdimlar,
      toplamYeniSatir: null,
    };
  }

  const basariliSaat = saatFarki(d.sonBasariliKosu, now);
  const kosuSaat = saatFarki(d.sonKosuBitis ?? d.sonKosuBaslangic, now);
  const yeni = d.toplamYeniSatir ?? null;
  const ortak = { basariliSaat, kosuSaat, basarisizAdimlar, toplamYeniSatir: yeni };

  // 1) Runner hiç koşmuyor mu? (launchd ölmüş / plist bozuk)
  if (kosuSaat == null || kosuSaat > HASAT_SESSIZ_SAAT) {
    return {
      ...ortak,
      renk: "kirmizi",
      baslik: `Hasat ${yasEtiketi(kosuSaat)} koştu`,
      aciklama:
        `Otomasyon ${HASAT_SESSIZ_SAAT} saattir hiç çalışmadı. launchd görevini kontrol et: ` +
        `bash scraper/launchd-kur.sh durum`,
    };
  }

  // 2) Son koşu patladı mı?
  if (d.sonKosuBasarili === false) {
    const ustUste = d.ustUsteHata ?? 1;
    return {
      ...ortak,
      renk: "kirmizi",
      baslik: `Son hasat BAŞARISIZ · son başarılı: ${yasEtiketi(basariliSaat)}`,
      aciklama:
        `Üst üste ${ustUste} başarısız koşu. ${d.sonHata ?? "Hata mesajı yok."}` +
        (basarisizAdimlar.length
          ? ` Patlayan adım(lar): ${basarisizAdimlar.map((a) => a.ad).join(", ")}.`
          : ""),
    };
  }

  // 3) Koşu başarılı ama son BAŞARILI hasat bayat mı?
  if (basariliSaat == null || basariliSaat > HASAT_BAYAT_SAAT) {
    return {
      ...ortak,
      renk: "kirmizi",
      baslik: `Son başarılı hasat: ${yasEtiketi(basariliSaat)}`,
      aciklama: `${HASAT_BAYAT_SAAT} saati geçti — veri bayatlıyor.`,
    };
  }

  // 4) Başarılı ama tek satır veri gelmediyse: yeşil DEĞİL. Sessiz boş turu
  //    "başarılı" saymak, bu projeyi 3,5 hafta yanıltan hatanın ta kendisiydi.
  if (yeni === 0) {
    return {
      ...ortak,
      renk: "sari",
      baslik: `Son başarılı hasat: ${yasEtiketi(basariliSaat)} · 0 yeni satır`,
      aciklama:
        "Koşu hatasız bitti ama hiçbir tabloya yeni satır yazılmadı. " +
        "Kaynaklar boş dönüyor olabilir — adım loglarına bak.",
    };
  }

  // 5) Smoke turu gerçek hasat sayılmaz.
  if (d.smoke) {
    return {
      ...ortak,
      renk: "sari",
      baslik: `Son koşu yalnızca smoke testiydi (${yasEtiketi(kosuSaat)})`,
      aciklama: "Ortam doğrulandı ama hasat betikleri çalışmadı.",
    };
  }

  return {
    ...ortak,
    renk: "yesil",
    baslik: `Son başarılı hasat: ${yasEtiketi(basariliSaat)}`,
    aciklama:
      `${(yeni ?? 0).toLocaleString("tr-TR")} yeni satır` +
      (d.countySayisi ? ` · ${d.countySayisi} county güncellendi` : "") +
      (d.sureSn ? ` · tur ${Math.round(d.sureSn / 60)} dk sürdü` : ""),
  };
}
