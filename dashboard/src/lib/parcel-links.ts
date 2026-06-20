// ─────────────────────────────────────────────────────────────────────────────
// "PARSELİ GÖR" — gerçek araziye/kayda götüren akıllı-fallback linkleri.
//
// Bir parsel kaydı (tax_delinquent_properties satırı veya türevi) alır; ELDE NE
// VARSA ona göre dış linkler üretir. Uydurma koordinat/parsel ÜRETMEZ — alan
// yoksa o link yoktur. Hiçbir veri yoksa hasData=false döner, UI dürüstçe
// "konum verisi yok" gösterir.
//
// Linkler:
//   1) lat/lng     → Google Maps UYDU görünümü ("Uydu Haritada Gör")
//   2) raw_url     → kaynak ilan/auction sayfası ("Kaynak İlan / Auction")
//   3) apn (+st)   → Regrid parsel araması + Google "{apn} {county} {state} parcel"
//   4) address     → Google Maps adres araması
// ─────────────────────────────────────────────────────────────────────────────

export interface ParcelLinkInput {
  lat?: number | string | null;
  lng?: number | string | null;
  apn?: string | null;
  state?: string | null;
  county?: string | null;
  /** property_address (snake) veya address (camel) — ikisi de kabul edilir. */
  property_address?: string | null;
  address?: string | null;
  /** kaynak ilan/auction URL'i. */
  raw_url?: string | null;
  rawUrl?: string | null;
}

export interface ParcelLink {
  /** kısa key (test/ikon eşlemesi için). */
  kind: "satellite" | "source" | "regrid" | "google_parcel" | "address";
  /** UI'da görünen Türkçe etiket. */
  label: string;
  href: string;
  /** harici link mi? (hep true; target=_blank kullan). */
  external: true;
}

export interface ParcelLinks {
  links: ParcelLink[];
  /** en az bir gerçek link üretildi mi? false → "konum verisi yok" göster. */
  hasData: boolean;
  lat: number | null;
  lng: number | null;
}

function toNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

function cleanStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

/** lat/lng dünya üzerinde geçerli mi? (uydurma/sıfır-koordinatı eler) */
function validLatLng(lat: number | null, lng: number | null): boolean {
  if (lat == null || lng == null) return false;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  // 0,0 (Gulf of Guinea) ABD parselleri için her zaman hatalı veri.
  if (lat === 0 && lng === 0) return false;
  return true;
}

/** Sadece http(s) URL'lere izin ver (javascript: vb. enjeksiyonu engelle). */
function safeUrl(v: string | null): string | null {
  if (!v) return null;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function buildParcelLinks(p: ParcelLinkInput): ParcelLinks {
  const lat = toNum(p.lat);
  const lng = toNum(p.lng);
  const apn = cleanStr(p.apn);
  const state = cleanStr(p.state);
  const county = cleanStr(p.county);
  const address = cleanStr(p.property_address ?? p.address);
  const rawUrl = safeUrl(cleanStr(p.raw_url ?? p.rawUrl));

  const links: ParcelLink[] = [];
  const hasGeo = validLatLng(lat, lng);

  // 1) Uydu haritası (en güçlü "araziyi gör" sinyali).
  if (hasGeo) {
    links.push({
      kind: "satellite",
      label: "Uydu Haritada Gör",
      href: `https://www.google.com/maps/@${lat},${lng},800m/data=!3m1!1e3`,
      external: true,
    });
  }

  // 2) Kaynak ilan / auction sayfası.
  if (rawUrl) {
    links.push({
      kind: "source",
      label: "Kaynak İlan / Auction",
      href: rawUrl,
      external: true,
    });
  }

  // 3) APN tabanlı parsel kayıtları (Regrid + Google parcel araması).
  if (apn) {
    links.push({
      kind: "regrid",
      label: "Regrid Parsel Kaydı",
      href: `https://app.regrid.com/search?query=${encodeURIComponent(apn)}`,
      external: true,
    });
    const q = [apn, county, state, "parcel"].filter(Boolean).join(" ");
    links.push({
      kind: "google_parcel",
      label: "Google'da Parsel Ara",
      href: `https://www.google.com/search?q=${encodeURIComponent(q)}`,
      external: true,
    });
  }

  // 4) Adres ile Google Maps araması (koordinat yoksa konum köprüsü).
  if (address && !hasGeo) {
    const q = [address, county, state].filter(Boolean).join(", ");
    links.push({
      kind: "address",
      label: "Adresi Haritada Ara",
      href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`,
      external: true,
    });
  }

  return {
    links,
    hasData: links.length > 0,
    lat: hasGeo ? lat : null,
    lng: hasGeo ? lng : null,
  };
}
