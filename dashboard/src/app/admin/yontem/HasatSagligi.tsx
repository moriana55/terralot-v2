"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, HelpCircle, Loader2 } from "lucide-react";
import type { HasatDurumDosyasi, HasatSagligi as Saglik } from "@/lib/hasat-durum";

// ─────────────────────────────────────────────────────────────────────────────
// HASAT SAĞLIĞI kartı — "veri gerçekten akıyor mu?" sorusunun tek cevabı.
//
// Eski /admin/sistem ekranı buraya (yontem) yönlendirildiği için kart burada
// duruyor; ayrıca /admin/scraper (Cerberus) sayfasında da gösterilir.
//
// HİÇBİR RAKAM UYDURULMAZ: hepsi scraper/.hasat-durum.json'dan gelir. Dosya
// yoksa kart "bilinmiyor" der — yeşil varsayılmaz. 2026 Haziran-Temmuz'da
// otomasyon 3,5 hafta ölüyken panel "başarılı" gösteriyordu; bu kart o hatanın
// tekrarını görünür kılmak için var.
// ─────────────────────────────────────────────────────────────────────────────

const RENKLER = {
  yesil: { arka: "#ecfdf5", kenar: "#a7f3d0", yazi: "#065f46", ikon: CheckCircle2 },
  sari: { arka: "#fffbeb", kenar: "#fde68a", yazi: "#92400e", ikon: AlertTriangle },
  kirmizi: { arka: "#fef2f2", kenar: "#fecaca", yazi: "#991b1b", ikon: AlertTriangle },
  bilinmiyor: { arka: "#f8fafc", kenar: "#e2e8f0", yazi: "#475569", ikon: HelpCircle },
} as const;

interface Cevap {
  saglik: Saglik;
  durum: HasatDurumDosyasi | null;
  okumaHatasi: string | null;
}

const say = (n: unknown) => (n == null ? "—" : Number(n).toLocaleString("tr-TR"));

export function HasatSagligiKarti() {
  const [veri, setVeri] = useState<Cevap | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    let iptal = false;
    fetch("/api/admin/hasat-durum")
      .then((r) => r.json())
      .then((j) => !iptal && setVeri(j))
      .catch(() => !iptal && setVeri(null))
      .finally(() => !iptal && setYukleniyor(false));
    return () => {
      iptal = true;
    };
  }, []);

  if (yukleniyor) {
    return (
      <div className="mb-6 flex items-center gap-2 rounded-xl border border-neutral-200 p-4 text-sm text-neutral-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Hasat durumu okunuyor…
      </div>
    );
  }

  if (!veri?.saglik) {
    return (
      <div className="mb-6 rounded-xl border border-neutral-200 p-4 text-sm text-neutral-500">
        Hasat durumu alınamadı (API yanıt vermedi).
      </div>
    );
  }

  const s = veri.saglik;
  const d = veri.durum;
  const stil = RENKLER[s.renk];
  const Ikon = stil.ikon;

  return (
    <section
      className="mb-6 rounded-xl border p-5"
      style={{ background: stil.arka, borderColor: stil.kenar }}
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <Ikon className="mt-0.5 h-5 w-5 shrink-0" style={{ color: stil.yazi }} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="font-bold" style={{ color: stil.yazi }}>
              {s.baslik}
            </h2>
            <span className="flex items-center gap-1 text-xs text-neutral-500">
              <Activity className="h-3 w-3" /> günlük hasat · com.terralot.sourcing
            </span>
          </div>
          <p className="mt-1 text-sm" style={{ color: stil.yazi }}>
            {s.aciklama}
          </p>

          {/* Ölçümler — hepsi durum dosyasından, hard-code yok. */}
          {d && (
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
              <Olcum ad="Son koşu" deger={d.sonKosuBitis ? yerelZaman(d.sonKosuBitis) : "—"} />
              <Olcum ad="Yeni satır" deger={say(d.toplamYeniSatir)} />
              <Olcum ad="County" deger={say(d.countySayisi)} />
              <Olcum
                ad="Tur süresi"
                deger={d.sureSn ? `${Math.round(d.sureSn / 60)} dk` : "—"}
              />
            </dl>
          )}

          {/* Patlayan adımlar — sessizce yutulmaz, isimleriyle listelenir. */}
          {s.basarisizAdimlar.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold" style={{ color: stil.yazi }}>
                Başarısız adımlar
              </p>
              <ul className="mt-1 space-y-0.5">
                {s.basarisizAdimlar.map((a) => (
                  <li key={a.ad} className="font-mono text-[11px]" style={{ color: stil.yazi }}>
                    ✗ {a.ad} — çıkış {a.kod} ({a.sureSn}sn)
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tablo bazlı satır deltaları */}
          {d?.satirlar && Object.keys(d.satirlar).length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="text-[11px] tabular-nums">
                <thead>
                  <tr className="text-neutral-500">
                    <th className="pr-4 text-left font-medium">Tablo</th>
                    <th className="pr-4 text-right font-medium">Önce</th>
                    <th className="pr-4 text-right font-medium">Sonra</th>
                    <th className="text-right font-medium">Fark</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(d.satirlar).map(([tablo, r]) => (
                    <tr key={tablo}>
                      <td className="pr-4 font-mono">{tablo}</td>
                      <td className="pr-4 text-right">{say(r.once)}</td>
                      <td className="pr-4 text-right">{say(r.sonra)}</td>
                      <td className="text-right font-semibold">
                        {r.delta == null ? "—" : r.delta > 0 ? `+${say(r.delta)}` : say(r.delta)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {veri.okumaHatasi && (
            <p className="mt-3 text-[11px] text-neutral-500">
              Durum dosyası okunamadı: {veri.okumaHatasi}. Elle tetikle:{" "}
              <code className="font-mono">bash scraper/launchd-kur.sh tetikle</code>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function Olcum({ ad, deger }: { ad: string; deger: string }) {
  return (
    <div>
      <dt className="text-neutral-500">{ad}</dt>
      <dd className="font-semibold tabular-nums">{deger}</dd>
    </div>
  );
}

function yerelZaman(iso: string) {
  try {
    return new Date(iso).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}
