// ─────────────────────────────────────────────────────────────────────────────
// NOT KALİBRASYONU — saf yorum kuralları (DB/ağ yok, test edilebilir).
//
// Amaç: kalibrasyon tablosundaki bir satırın KANIT sayılıp sayılmayacağına ve
// notun gerçekten ayırt edici olup olmadığına karar veren mantığı tek yerde
// tutmak. Ekran bu kurallardan bağımsız yorum ÜRETMEZ — örneklem küçükse
// "yetersiz" der, uydurma cümle kurmaz (dürüstlük kuralı).
// ─────────────────────────────────────────────────────────────────────────────

/** Bir bandın kanıt sayılması için gereken en az gerçekleşmiş satış sayısı. */
export const MIN_SATIS_ORNEKLEM = 30;

/** Spearman ρ için "gürültü değil" eşiği (sıra korelasyonu, mutlak değer). */
export const MIN_SPEARMAN = 0.2;

export type KalibBand = {
  anahtar: string;
  n_lead: number | null;
  n_satis: number | null;
  med_satis: number | null;
  ort_skor: number | null;
};

/** Satır kanıt sayılır mı? (örneklem yeterli mi) */
export function ornekYeterli(n: number | null | undefined): boolean {
  return (n ?? 0) >= MIN_SATIS_ORNEKLEM;
}

/** Bir satır için insan-okur kanıt gücü etiketi. */
export function kanitGucu(n: number | null | undefined): string {
  const k = n ?? 0;
  return ornekYeterli(k)
    ? `n=${k} — kıyaslanabilir`
    : `n=${k} — ÖRNEKLEM YETERSİZ, bu satır kanıt sayılmaz`;
}

/** Spearman yorumu — eşik altında "gürültü" denir, süslenmez. */
export function spearmanYorum(rho: number | null | undefined): string {
  if (rho == null || !Number.isFinite(rho)) return "ölçülmedi";
  if (Math.abs(rho) < MIN_SPEARMAN) return "zayıf — skor sıralaması gürültüden ayrışmıyor";
  return rho > 0
    ? "pozitif ve anlamlı — skor yükseldikçe gerçekleşen satış fiyatı da yükseliyor"
    : "NEGATİF — skor ters çalışıyor, motor acilen gözden geçirilmeli";
}

/**
 * Bandlar arası ayrışma: YALNIZ örneklemi yeterli bandlar üzerinden,
 * medyan gerçek satış fiyatı not sırasına göre azalıyor mu?
 * Dönen: { bandlar, tekduze, atlanan } — atlanan = örneklemi yetersiz bandlar.
 */
export const NOT_SIRASI = ["A+", "A", "B", "C", "D", "F"];

export function ayrismaKontrol(bandlar: KalibBand[]): {
  kullanilan: string[];
  atlanan: string[];
  tekduze: boolean | null;
} {
  const sirali = NOT_SIRASI.map((g) => bandlar.find((b) => b.anahtar === g)).filter(
    (b): b is KalibBand => !!b
  );
  const kullanilan = sirali.filter((b) => ornekYeterli(b.n_satis) && b.med_satis != null);
  const atlanan = sirali.filter((b) => !ornekYeterli(b.n_satis)).map((b) => b.anahtar);
  if (kullanilan.length < 2)
    return { kullanilan: kullanilan.map((b) => b.anahtar), atlanan, tekduze: null };
  let tekduze = true;
  for (let i = 1; i < kullanilan.length; i++) {
    if (Number(kullanilan[i].med_satis) > Number(kullanilan[i - 1].med_satis)) tekduze = false;
  }
  return { kullanilan: kullanilan.map((b) => b.anahtar), atlanan, tekduze };
}
