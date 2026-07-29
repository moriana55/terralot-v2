"use client";

// ── ALICI TALEPLERİ — TEK HUNİ ───────────────────────────────────────────────
// Sitedeki TÜM formların lead'leri burada toplanır (Supabase `parcel_inquiries`):
//   /p/[id] alıcı sayfası · ilan detay modalı · rezervasyon modalı ·
//   ana sayfa bülteni · /landforever · eski /api/inquiries ucu ·
//   eski `Inquiry` tablosundan taşınanlar.
// Tablo yoksa bellek-içi fallback devreye girer (satır "geçici" etiketlenir);
// kalıcılık için sql/parcel_inquiries.sql çalıştırılır.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check, Copy, Loader2, Mail, MessageSquare, Phone, RefreshCw, Trash2, TriangleAlert,
} from "lucide-react";
import Dropdown from "@/components/Dropdown";
import type { ParcelInquiry } from "@/lib/parcel-inquiry-store";

// Durum döngüsü: rozete tıklayınca bir sonrakine geçer.
const STATUS: Record<string, { label: string; cls: string; next: string }> = {
  NEW: { label: "YENİ", cls: "bg-emerald-100 text-emerald-700", next: "CONTACTED" },
  CONTACTED: { label: "İLETİŞİMDE", cls: "bg-sky-100 text-sky-700", next: "QUALIFIED" },
  QUALIFIED: { label: "NİTELİKLİ", cls: "bg-violet-100 text-violet-700", next: "CLOSED" },
  CLOSED: { label: "KAPANDI", cls: "bg-slate-100 text-slate-500", next: "NEW" },
};

// Lead'in geldiği form. Rozet nötr gri — renk sadece durum için anlam taşır.
const SOURCE_LABEL: Record<string, string> = {
  "p-sayfasi": "parsel sayfası",
  "ilan-detay": "ilan detay",
  rezervasyon: "rezervasyon",
  "ana-sayfa-bulten": "ana sayfa bülteni",
  landforever: "landforever",
  "eski-inquiry": "eski kayıt",
};

const DURUM_SECENEKLERI = [
  { value: "", label: "Tüm durumlar" },
  { value: "NEW", label: "Yeni" },
  { value: "CONTACTED", label: "İletişimde" },
  { value: "QUALIFIED", label: "Nitelikli" },
  { value: "CLOSED", label: "Kapandı" },
];

// `waitlist`, `01`, cuid gibi değerler gerçek bir /p/<id> sayfasına karşılık
// gelmez — kırık link göstermek yerine düz metin yazarız.
const parselLinkiVar = (id: string) => id.includes("-") && id.length >= 8;

export default function TaleplerPage() {
  const [rows, setRows] = useState<ParcelInquiry[]>([]);
  const [tableOk, setTableOk] = useState(true);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState("");
  const [durumFiltre, setDurumFiltre] = useState("");
  const [kaynakFiltre, setKaynakFiltre] = useState("");
  const [silinecek, setSilinecek] = useState<ParcelInquiry | null>(null);
  const [siliniyor, setSiliniyor] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/parcel-inquiries")
      .then((r) => r.json())
      .then((d) => { setRows(d.rows ?? []); setTableOk(!!d.tableOk); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  // Kaynak seçenekleri veriden türer — uydurma seçenek gösterme.
  const kaynakSecenekleri = useMemo(() => {
    const set = new Set(rows.map((r) => r.source || "").filter(Boolean));
    return [
      { value: "", label: "Tüm kaynaklar" },
      ...[...set].sort().map((s) => ({ value: s, label: SOURCE_LABEL[s] ?? s })),
    ];
  }, [rows]);

  const gorunen = useMemo(
    () => rows.filter(
      (r) => (!durumFiltre || r.status === durumFiltre) && (!kaynakFiltre || r.source === kaynakFiltre)
    ),
    [rows, durumFiltre, kaynakFiltre]
  );

  const setStatus = async (id: string, status: string) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
    await fetch("/api/admin/parcel-inquiries", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    }).catch(() => {});
  };

  const sil = async (r: ParcelInquiry) => {
    setSiliniyor(true);
    await fetch(`/api/admin/parcel-inquiries?id=${encodeURIComponent(r.id)}`, {
      method: "DELETE",
    }).catch(() => {});
    setRows((rs) => rs.filter((x) => x.id !== r.id));
    setSiliniyor(false);
    setSilinecek(null);
  };

  const copyLink = (parcelId: string) => {
    const url = `${location.origin}/p/${encodeURIComponent(parcelId)}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(parcelId);
      setTimeout(() => setCopied(""), 1500);
    });
  };

  return (
    <div className="p-6">
      {/* Silme onayı */}
      {silinecek && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-80 rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="font-bold text-slate-900">Talep silinsin mi?</h3>
            <p className="mt-2 text-sm text-slate-500">
              <b>{silinecek.name}</b> kaydı kalıcı olarak silinecek. Bu işlem geri alınamaz.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setSilinecek(null)}
                className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Vazgeç
              </button>
              <button
                onClick={() => sil(silinecek)}
                disabled={siliniyor}
                className="flex-1 rounded-lg bg-rose-600 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {siliniyor ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Sil"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">💬 Alıcı Talepleri</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Sitedeki tüm formların tek hunisi — parsel sayfası, ilan detay, rezervasyon,
            ana sayfa bülteni ve landforever.
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
          <RefreshCw className="h-3.5 w-3.5" /> Yenile
        </button>
      </div>

      {!tableOk && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <b>parcel_inquiries tablosu yok</b> — talepler şu an bellek-içi (deploy/restart&apos;ta silinir).
            Kalıcılaştırmak için <code className="rounded bg-amber-100 px-1">sql/parcel_inquiries.sql</code>&apos;i bir kez çalıştır.
          </div>
        </div>
      )}

      {/* Filtreler — native <select> kullanılmaz (bkz. AGENTS.md) */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="w-48">
          <Dropdown
            options={DURUM_SECENEKLERI}
            value={durumFiltre}
            onChange={setDurumFiltre}
            placeholder="Tüm durumlar"
            size="sm"
            aria-label="Duruma göre filtrele"
          />
        </div>
        <div className="w-52">
          <Dropdown
            options={kaynakSecenekleri}
            value={kaynakFiltre}
            onChange={setKaynakFiltre}
            placeholder="Tüm kaynaklar"
            size="sm"
            aria-label="Kaynağa göre filtrele"
          />
        </div>
        <span className="text-xs text-slate-400">
          {gorunen.length} / {rows.length} talep
        </span>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="mt-10 text-center text-sm text-slate-400">
          Henüz talep yok. Haritadaki parsel popup&apos;ından &quot;🔗 Müşteri linki&quot;ni kopyalayıp WhatsApp&apos;tan gönder —
          alıcı formu doldurunca burada görünür.
        </div>
      ) : gorunen.length === 0 ? (
        <div className="mt-10 text-center text-sm text-slate-400">Bu filtreye uyan talep yok.</div>
      ) : (
        <div className="mt-4 space-y-3">
          {gorunen.map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">{r.name}</span>
                  <button
                    onClick={() => setStatus(r.id, STATUS[r.status]?.next || "CONTACTED")}
                    disabled={!!r.volatile}
                    title={r.volatile ? "Geçici kayıt — durum güncellenemez" : "Durumu değiştir"}
                    className={`rounded px-2 py-0.5 text-[11px] font-bold ${STATUS[r.status]?.cls ?? "bg-slate-100 text-slate-500"} ${r.volatile ? "opacity-60" : "cursor-pointer"}`}
                  >
                    {STATUS[r.status]?.label ?? r.status}
                  </button>
                  {r.source && (
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500" title="Lead'in geldiği form">
                      {SOURCE_LABEL[r.source] ?? r.source}
                    </span>
                  )}
                  {r.volatile && (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700" title="Bellek-içi — restart'ta kaybolur">geçici</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">{new Date(r.created_at).toLocaleString("tr-TR")}</span>
                  <button
                    onClick={() => setSilinecek(r)}
                    disabled={!!r.volatile}
                    title={r.volatile ? "Geçici kayıt — silinemez" : "Talebi sil"}
                    className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-rose-600 disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                {r.email && <a href={`mailto:${r.email}`} className="flex items-center gap-1 hover:text-emerald-700"><Mail className="h-3.5 w-3.5" />{r.email}</a>}
                {r.phone && <a href={`tel:${r.phone}`} className="flex items-center gap-1 hover:text-emerald-700"><Phone className="h-3.5 w-3.5" />{r.phone}</a>}
              </div>

              {r.message && (
                <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-slate-50 p-2.5 text-sm text-slate-700">
                  <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />{r.message}
                </p>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-400">Parsel:</span>
                {parselLinkiVar(r.parcel_id) ? (
                  <>
                    <a href={`/p/${encodeURIComponent(r.parcel_id)}`} target="_blank" rel="noreferrer" className="font-semibold text-sky-600 hover:underline">
                      {r.parcel_title || r.parcel_id}
                    </a>
                    <button onClick={() => copyLink(r.parcel_id)} className="flex items-center gap-1 rounded border border-slate-200 px-2 py-0.5 font-medium text-slate-500 hover:bg-slate-50">
                      {copied === r.parcel_id ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      {copied === r.parcel_id ? "Kopyalandı" : "Müşteri linki"}
                    </button>
                    <a href={`/admin/parcel-sunum?id=${encodeURIComponent(r.parcel_id)}`} target="_blank" rel="noreferrer" className="rounded border border-slate-200 px-2 py-0.5 font-medium text-slate-500 hover:bg-slate-50">
                      🖨 Sunum
                    </a>
                  </>
                ) : (
                  // "waitlist" / "01" gibi değerler parsel sayfasına karşılık gelmiyor.
                  <span className="font-medium text-slate-600">{r.parcel_title || r.parcel_id}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
