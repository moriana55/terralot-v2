import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// LOB İSTEK ŞEMASI (route'tan ayrıldı → node:test ile test edilebilir)
//
// /api/lob ücretli Lob API'sine proxy'dir; buradaki zod discriminated union
// yalnız üç bilinen action'ı iyi-biçimli payload'la upstream'e geçirir.
// Route tarafındaki gate + rate limit korumaları api/lob/route.ts'te durur.
// ─────────────────────────────────────────────────────────────────────────────

export const addressTo = z.object({
  name: z.string().trim().min(1).max(120),
  address_line1: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(2).max(40),
  zip: z.string().trim().min(3).max(12),
});

export const addressFrom = z
  .object({
    name: z.string().trim().max(120).optional(),
    address_line1: z.string().trim().max(200).optional(),
    city: z.string().trim().max(100).optional(),
    state: z.string().trim().max(40).optional(),
    zip: z.string().trim().max(12).optional(),
  })
  .optional();

// merge_variables: shallow record of short strings only (no nested objects /
// arrays / huge blobs reaching Lob).
const mergeVars = z.record(z.string().max(60), z.string().max(500)).optional();

export const lobSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("send_letter"),
    to: addressTo,
    from: addressFrom,
    // Mektup GÖVDESİ buradan geçer (Lob "file" alanı düz metin/HTML içeriği de
    // kabul eder). Eski max(200) sınırı template-ID varsayımıydı; oysa
    // LETTER_TEMPLATES önizlemeleri ~240-750 karakter → Quick Send mektupları
    // sandbox'ta bile zod'da 400 dönüyordu. Üst sınır kötüye kullanıma karşı
    // duruyor, sadece gerçek gövdeye yer açacak kadar genişletildi.
    template: z.string().trim().max(10_000).optional(),
    description: z.string().trim().max(200).optional(),
    merge_variables: mergeVars,
  }),
  z.object({
    action: z.literal("send_postcard"),
    to: addressTo,
    from: addressFrom,
    // front/back Lob'da HTML gövde ya da tmpl_ ID taşır. Mektuptaki max(200)
    // bug'ının aynısı buradaydı: Quick Send postcard gövdesi (~240+ karakter,
    // HTML sarmalı ile daha uzun) 200 sınırına takılırdı → 10_000.
    front: z.string().trim().max(10_000).optional(),
    back: z.string().trim().max(10_000).optional(),
    description: z.string().trim().max(200).optional(),
    merge_variables: mergeVars,
  }),
  z.object({
    action: z.literal("verify_address"),
    address: z.object({
      address_line1: z.string().trim().min(1).max(200),
      city: z.string().trim().max(100).optional(),
      state: z.string().trim().max(40).optional(),
      zip: z.string().trim().max(12).optional(),
    }),
  }),
]);

export type LobInput = z.infer<typeof lobSchema>;
