// ─────────────────────────────────────────────────────────────────────────────
// MULTI-TOUCH MAIL CADENCE (pure, no DB / no network)
//
// Tek mektup yerine OTOMATİK bir dizi: aynı lead'e zamana yayılmış 3 dokunuş.
// Land-wholesaling'de tek atış düşük yanıt verir; 2-3 dokunuş yanıtı belirgin
// yükseltir. Sahip yanıt verdiğinde dizi DURUR (responded=true).
//
//   Touch 1 — Teklif mektubu (letter, "offer")     → ŞİMDİ (0. gün)
//   Touch 2 — Hatırlatma kartı (postcard, "followup") → +14 gün
//   Touch 3 — Son mektup (letter, "final")          → +30 gün (≈ touch2'den +16)
//
// Bu dosya SAF: sadece adımları/zamanlamayı ve "sıradaki ne, ne zaman" mantığını
// tanımlar. DB şeması, Lob gönderimi ve loglama route'larda; burada hiç yan etki yok.
// ─────────────────────────────────────────────────────────────────────────────

export type CadenceChannel = "letter" | "postcard";
export type SequenceStatus = "active" | "done" | "paused";

export interface CadenceStep {
  /** 1-tabanlı dokunuş numarası (1, 2, 3). */
  step: number;
  channel: CadenceChannel;
  /** outreach_events.type ile aynı sözlük: offer | followup | final. */
  type: string;
  /** Bir ÖNCEKİ dokunuşun gönderim anından bu yana beklenecek gün. */
  delayDays: number;
  label: string;
}

// Adım tanımı tek kaynak. delayDays = önceki dokunuştan bu yana gün.
// Toplam gün: touch1=0, touch2=14, touch3=14+16=30.
export const CADENCE_STEPS: CadenceStep[] = [
  { step: 1, channel: "letter", type: "offer", delayDays: 0, label: "Teklif mektubu" },
  { step: 2, channel: "postcard", type: "followup", delayDays: 14, label: "Hatırlatma kartı (+14g)" },
  { step: 3, channel: "letter", type: "final", delayDays: 16, label: "Son mektup (+30g)" },
];

export const CADENCE_TOTAL_STEPS = CADENCE_STEPS.length;

const DAY_MS = 86_400_000;

// outreach_events satırının kadans-ilgili alanları (hepsi opsiyonel/graceful:
// migration uygulanmadan önce undefined gelebilir).
export interface CadenceEvent {
  /** Şimdiye dek GÖNDERİLMİŞ dokunuş sayısı (0 / yok = hiç başlamadı). */
  sequence_step?: number | null;
  /** Sıradaki dokunuşun planlandığı an (ISO string ya da Date). */
  next_action_at?: string | Date | null;
  /** Son gönderim anı (next_action_at yoksa buradan hesaplanır). */
  last_sent_at?: string | Date | null;
  sequence_status?: string | null;
  responded?: boolean | null;
}

export type NextAction =
  | { kind: "send"; step: CadenceStep; dueAt: Date; ready: boolean; reason: string }
  | { kind: "done"; reason: string }
  | { kind: "paused"; reason: string };

function toDate(v: string | Date | null | undefined): Date | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function clampStep(n: number | null | undefined): number {
  const v = Math.trunc(Number(n ?? 0));
  if (!Number.isFinite(v) || v < 0) return 0;
  if (v > CADENCE_TOTAL_STEPS) return CADENCE_TOTAL_STEPS;
  return v;
}

/**
 * Verili lead durumundan (kaç dokunuş gitti + son tarih + responded) sıradaki
 * eylemi döndürür: gönderilecek dokunuş + ne zaman, ya da "done" / "paused".
 *
 * Saf: `now` enjekte edilebilir (test için).
 */
export function nextAction(event: CadenceEvent, now: Date = new Date()): NextAction {
  // Sahip yanıt verdi → dizi durur (en yüksek öncelik).
  if (event.responded) {
    return { kind: "paused", reason: "Sahip yanıt verdi — kadans durduruldu" };
  }
  if (event.sequence_status === "paused") {
    return { kind: "paused", reason: "Kadans duraklatıldı" };
  }

  const sent = clampStep(event.sequence_step);
  if (event.sequence_status === "done" || sent >= CADENCE_TOTAL_STEPS) {
    return { kind: "done", reason: "Tüm dokunuşlar tamamlandı" };
  }

  // sent = gönderilmiş dokunuş sayısı → sıradaki = CADENCE_STEPS[sent] (0-tabanlı dizi).
  const step = CADENCE_STEPS[sent];

  // Vade: önce kayıtlı next_action_at; yoksa last_sent_at + step.delayDays; o da
  // yoksa (hiç başlamadı) → şimdi (Touch 1 hemen gönderilir).
  let dueAt: Date;
  const explicit = toDate(event.next_action_at ?? null);
  const lastSent = toDate(event.last_sent_at ?? null);
  if (explicit) {
    dueAt = explicit;
  } else if (lastSent) {
    dueAt = new Date(lastSent.getTime() + step.delayDays * DAY_MS);
  } else {
    dueAt = now;
  }

  const ready = dueAt.getTime() <= now.getTime();
  return {
    kind: "send",
    step,
    dueAt,
    ready,
    reason: ready
      ? `Touch ${step.step} (${step.label}) gönderilmeye hazır`
      : `Touch ${step.step} (${step.label}) ${dueAt.toISOString().slice(0, 10)} tarihinde`,
  };
}

/**
 * Bir dokunuş GÖNDERİLDİKTEN sonra kayda yazılacak yeni kadans işaretçisini
 * hesaplar: sequence_step ilerler, sıradaki dokunuş için next_action_at kurulur
 * (yoksa status "done").
 *
 * @param sentStepNumber 1-tabanlı, az önce gönderilen dokunuş (1, 2, 3)
 */
export function afterSend(
  sentStepNumber: number,
  sentAt: Date = new Date()
): { sequence_step: number; sequence_status: SequenceStatus; next_action_at: string | null; last_sent_at: string } {
  const sent = clampStep(sentStepNumber);
  // Gönderilen dokunuş 1-tabanlı; sıradaki adım dizide index = sent.
  const following = CADENCE_STEPS[sent];
  if (!following) {
    return {
      sequence_step: sent,
      sequence_status: "done",
      next_action_at: null,
      last_sent_at: sentAt.toISOString(),
    };
  }
  const due = new Date(sentAt.getTime() + following.delayDays * DAY_MS);
  return {
    sequence_step: sent,
    sequence_status: "active",
    next_action_at: due.toISOString(),
    last_sent_at: sentAt.toISOString(),
  };
}

/** Sahip yanıt verince yazılacak alanlar — diziyi durdurur. */
export function markResponded(): { responded: true; sequence_status: SequenceStatus } {
  return { responded: true, sequence_status: "paused" };
}

/** Tick için: bir lead şu an gönderilmeye hazır mı? (responded değil + vade geçmiş + bitmemiş) */
export function isDue(event: CadenceEvent, now: Date = new Date()): boolean {
  const a = nextAction(event, now);
  return a.kind === "send" && a.ready;
}
