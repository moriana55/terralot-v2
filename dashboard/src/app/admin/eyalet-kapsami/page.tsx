"use client";

/**
 * EYALET KAPSAMI — "nerede varız, nerede yokuz" ekranı.
 *
 * Kaynak: /api/admin/eyalet-kapsami (kayıt defteri + `scripts/kapsam-olc.mjs`
 * ile üretilmiş GERÇEK ölçüm sonucu). Ölçülmemiş county "ölçülmedi" görünür —
 * hiçbir satırda tahmini/örnek rakam GÖSTERİLMEZ.
 *
 * "Şimdi sorgula" düğmesi county'ye O AN canlı sorgu atar (/api/admin/live-county)
 * ve satırı yerinde günceller.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Globe, Loader2, RefreshCw, AlertCircle, CheckCircle2, XCircle,
  CircleSlash, KeyRound, HelpCircle, Radio,
} from "lucide-react";

interface Satir {
  key: string;
  label: string;
  state: string;
  county: string;
  kaynakZinciri: string;
  hasValue: boolean;
  not: string | null;
  bilinenDurum: string;
  olculenDurum: string | null;
  saglayici: string | null;
  ornekSatir: number | null;
  mailable: number | null;
  mailableOran: number | null;
  degerVar: boolean | null;
  toplamParsel: number | null;
  toplamHata: string | null;
  sureMs: number | null;
  mesaj: string | null;
  sonOlcum: string | null;
}

interface Yanit {
  olcumZamani: string | null;
  eyaletSayisi: number;
  countySayisi: number;
  calisan: number;
  olculmemis: number;
  eyaletler: string[];
  satirlar: Satir[];
}

// Durum rozetleri — renk YALNIZCA anlam taşıdığı yerde.
const DURUM: Record<string, { etiket: string; renk: string; bg: string; Icon: typeof CheckCircle2 }> = {
  calisiyor: { etiket: "Çalışıyor", renk: "var(--grade-a)", bg: "rgba(34,197,94,0.12)", Icon: CheckCircle2 },
  "veri-yok": { etiket: "Veri yok", renk: "var(--muted)", bg: "var(--surface-high)", Icon: CircleSlash },
  "posta-adresi-yok": { etiket: "Posta adresi yok", renk: "#b45309", bg: "rgba(217,119,6,0.12)", Icon: AlertCircle },
  "servis-kapali": { etiket: "Servis kapalı", renk: "#b91c1c", bg: "rgba(220,38,38,0.12)", Icon: XCircle },
  "kimlik-hatasi": { etiket: "API anahtarı geçersiz", renk: "#b91c1c", bg: "rgba(220,38,38,0.12)", Icon: KeyRound },
  "kota-doldu": { etiket: "Kota doldu", renk: "#b45309", bg: "rgba(217,119,6,0.12)", Icon: AlertCircle },
  "kaynak-yok": { etiket: "Kaynak yok", renk: "var(--muted)", bg: "var(--surface-high)", Icon: CircleSlash },
  deneniyor: { etiket: "Deneniyor", renk: "var(--muted)", bg: "var(--surface-high)", Icon: HelpCircle },
};

const OLCULMEDI = { etiket: "Ölçülmedi", renk: "var(--muted)", bg: "var(--surface-high)", Icon: HelpCircle };

function Rozet({ durum }: { durum: string | null }) {
  const d = durum ? (DURUM[durum] ?? DURUM.deneniyor) : OLCULMEDI;
  const { Icon } = d;
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: d.bg, color: d.renk }}
    >
      <Icon className="w-3 h-3" /> {d.etiket}
    </span>
  );
}

function yas(ts: string | null): string {
  if (!ts) return "—";
  const ms = Date.now() - new Date(ts).getTime();
  if (Number.isNaN(ms)) return "—";
  if (ms < 3_600_000) return `${Math.max(0, Math.round(ms / 60_000))}dk önce`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}sa önce`;
  return `${(ms / 86_400_000).toFixed(1)}g önce`;
}

const sayi = (n: number | null) => (n == null ? "—" : n.toLocaleString("tr-TR"));

export default function EyaletKapsamiPage() {
  const [data, setData] = useState<Yanit | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [sorgulanan, setSorgulanan] = useState<string | null>(null);
  const [sadeceSorun, setSadeceSorun] = useState(false);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    setHata(null);
    try {
      const res = await fetch("/api/admin/eyalet-kapsami");
      const j = await res.json();
      if (!res.ok) { setHata(j.error || `Yüklenemedi (HTTP ${res.status})`); return; }
      setData(j as Yanit);
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Ağ hatası");
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => { void yukle(); }, [yukle]);

  /** Tek county'yi O AN canlı sorgula ve satırı yerinde güncelle. */
  async function simdiSorgula(key: string) {
    setSorgulanan(key);
    try {
      const res = await fetch(`/api/admin/live-county?county=${encodeURIComponent(key)}`);
      const j = await res.json();
      const satirlar = Array.isArray(j.rows) ? j.rows : [];
      const mailableSayi = satirlar.filter(
        (r: Record<string, string>) =>
          r.owner?.trim() && r.mailing_address?.trim() && r.mailing_city?.trim() &&
          r.mailing_state?.trim() && r.mailing_zip?.trim(),
      ).length;

      let durum: string;
      if (j.status === "ok") durum = mailableSayi > 0 ? "calisiyor" : "posta-adresi-yok";
      else if (j.status === "bos") durum = "veri-yok";
      else if (j.status === "kimlik-hatasi") durum = "kimlik-hatasi";
      else if (j.status === "kota-doldu") durum = "kota-doldu";
      else if (j.status === "yapilandirilmamis") durum = "kaynak-yok";
      else durum = "servis-kapali";

      setData((d) => d && ({
        ...d,
        satirlar: d.satirlar.map((s) => s.key !== key ? s : {
          ...s,
          olculenDurum: durum,
          saglayici: j.provider ?? null,
          ornekSatir: satirlar.length,
          mailable: mailableSayi,
          mailableOran: satirlar.length ? Math.round((mailableSayi / satirlar.length) * 100) : null,
          degerVar: satirlar.some((r: { land_value: number | null }) => r.land_value != null && r.land_value > 0),
          mesaj: j.error ?? j.notice ?? null,
          sonOlcum: j.fetchedAt ?? new Date().toISOString(),
        }),
      }));
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Sorgu başarısız");
    } finally {
      setSorgulanan(null);
    }
  }

  const gruplar = useMemo(() => {
    if (!data) return [];
    const m = new Map<string, Satir[]>();
    for (const s of data.satirlar) {
      if (sadeceSorun && s.olculenDurum === "calisiyor") continue;
      const a = m.get(s.state) ?? [];
      a.push(s);
      m.set(s.state, a);
    }
    return [...m.entries()]
      .map(([state, satirlar]) => ({
        state,
        satirlar,
        calisan: satirlar.filter((s) => s.olculenDurum === "calisiyor").length,
      }))
      .sort((a, b) => b.calisan - a.calisan || a.state.localeCompare(b.state));
  }, [data, sadeceSorun]);

  const ozet = useMemo(() => {
    if (!data) return null;
    const s = data.satirlar;
    const calisanEyalet = new Set(s.filter((x) => x.olculenDurum === "calisiyor").map((x) => x.state)).size;
    const mailableToplam = s.reduce((t, x) => t + (x.toplamParsel ?? 0), 0);
    return {
      eyalet: data.eyaletSayisi,
      calisanEyalet,
      county: data.countySayisi,
      calisan: data.calisan,
      olculmemis: data.olculmemis,
      parsel: mailableToplam,
    };
  }, [data]);

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
            <Globe className="w-5 h-5" style={{ color: "var(--accent-ink)" }} />
            Eyalet Kapsamı
          </h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Kayıt defterindeki her county&apos;nin GERÇEK sorgu sonucu. Ölçülmemiş satır &quot;ölçülmedi&quot;
            yazar — tahmini rakam gösterilmez.
            {data?.olcumZamani && ` Son toplu ölçüm: ${yas(data.olcumZamani)}.`}
          </p>
        </div>
        <button
          onClick={() => void yukle()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: "var(--surface)", border: "1px solid var(--outline)" }}
        >
          <RefreshCw className="w-4 h-4" /> Yenile
        </button>
      </div>

      {hata && (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm mb-4"
          style={{ background: "rgba(220,38,38,0.1)", color: "#b91c1c" }}
        >
          <AlertCircle className="w-4 h-4" /> {hata}
        </div>
      )}

      {yukleniyor && !data && (
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
          <Loader2 className="w-4 h-4 animate-spin" /> Kapsam yükleniyor…
        </div>
      )}

      {ozet && (
        <>
          <div className="flex items-center gap-3 mb-5 flex-wrap text-sm">
            <Kutu etiket="Eyalet" deger={`${ozet.eyalet}`} alt={`${ozet.calisanEyalet} tanesinde çalışan county var`} />
            <Kutu etiket="County" deger={`${ozet.county}`} alt={`${ozet.calisan} çalışıyor`} />
            <Kutu etiket="Ölçülmemiş" deger={`${ozet.olculmemis}`} alt="henüz sorgu atılmadı" />
            <Kutu
              etiket="Ölçülen boş arsa"
              deger={ozet.parsel ? ozet.parsel.toLocaleString("tr-TR") : "—"}
              alt="çalışan county'lerin filtreye uyan toplamı"
            />
          </div>

          <label className="flex items-center gap-2 text-sm mb-4 cursor-pointer" style={{ color: "var(--muted)" }}>
            <input type="checkbox" checked={sadeceSorun} onChange={(e) => setSadeceSorun(e.target.checked)} />
            Sadece sorunlu satırları göster
          </label>

          <div className="space-y-6">
            {gruplar.map((g) => (
              <div key={g.state}>
                <h2 className="text-sm font-bold mb-2 flex items-center gap-2">
                  <span
                    className="inline-flex items-center justify-center w-8 h-6 rounded text-xs font-bold"
                    style={{ background: "var(--surface-high)" }}
                  >
                    {g.state}
                  </span>
                  <span style={{ color: "var(--muted)" }}>
                    {g.calisan}/{g.satirlar.length} county çalışıyor
                  </span>
                </h2>

                <div className="overflow-x-auto rounded-lg" style={{ border: "1px solid var(--outline)" }}>
                  <table className="w-full text-sm min-w-[900px]">
                    <thead>
                      <tr className="text-left text-xs" style={{ color: "var(--muted)", background: "var(--surface)" }}>
                        <th className="px-4 py-2.5 font-semibold">County</th>
                        <th className="px-4 py-2.5 font-semibold">Kaynak</th>
                        <th className="px-4 py-2.5 font-semibold">Durum</th>
                        <th className="px-4 py-2.5 font-semibold">Boş arsa</th>
                        <th className="px-4 py-2.5 font-semibold">Örnek</th>
                        <th className="px-4 py-2.5 font-semibold">Mailable</th>
                        <th className="px-4 py-2.5 font-semibold">Değer</th>
                        <th className="px-4 py-2.5 font-semibold">Son sorgu</th>
                        <th className="px-4 py-2.5 font-semibold"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.satirlar.map((s) => (
                        <tr key={s.key} className="border-t align-top" style={{ borderColor: "var(--outline)" }}>
                          <td className="px-4 py-2.5">
                            <div className="font-semibold whitespace-nowrap">{s.county}</div>
                            {s.not && (
                              <div className="text-[11px] mt-0.5 max-w-xs" style={{ color: "var(--muted)" }}>
                                {s.not}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ color: "var(--muted)" }}>
                            {s.saglayici ?? s.kaynakZinciri}
                          </td>
                          <td className="px-4 py-2.5">
                            <Rozet durum={s.olculenDurum} />
                            {s.mesaj && s.olculenDurum !== "calisiyor" && (
                              <div className="text-[11px] mt-1 max-w-sm" style={{ color: "var(--muted)" }}>
                                {s.mesaj}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2.5 tabular-nums whitespace-nowrap">
                            {s.toplamParsel != null ? sayi(s.toplamParsel)
                              : <span style={{ color: "var(--muted)" }} title={s.toplamHata ?? undefined}>ölçülemedi</span>}
                          </td>
                          <td className="px-4 py-2.5 tabular-nums">{sayi(s.ornekSatir)}</td>
                          <td className="px-4 py-2.5 tabular-nums whitespace-nowrap">
                            {s.mailableOran == null ? "—" : `${s.mailable}/${s.ornekSatir} (%${s.mailableOran})`}
                          </td>
                          <td className="px-4 py-2.5 text-xs" style={{ color: "var(--muted)" }}>
                            {s.degerVar == null ? "—" : s.degerVar ? "var" : "yok"}
                          </td>
                          <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ color: "var(--muted)" }}>
                            {yas(s.sonOlcum)}
                          </td>
                          <td className="px-4 py-2.5">
                            <button
                              onClick={() => void simdiSorgula(s.key)}
                              disabled={sorgulanan === s.key}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap disabled:opacity-50"
                              style={{ background: "var(--surface-high)", border: "1px solid var(--outline)" }}
                            >
                              {sorgulanan === s.key
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <Radio className="w-3 h-3" />}
                              Şimdi sorgula
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Kutu({ etiket, deger, alt }: { etiket: string; deger: string; alt: string }) {
  return (
    <div className="px-3.5 py-2 rounded-lg" style={{ background: "var(--surface)", border: "1px solid var(--outline)" }}>
      <div className="text-[11px]" style={{ color: "var(--muted)" }}>{etiket}</div>
      <div className="text-lg font-bold tabular-nums leading-tight">{deger}</div>
      <div className="text-[11px]" style={{ color: "var(--muted)" }}>{alt}</div>
    </div>
  );
}
