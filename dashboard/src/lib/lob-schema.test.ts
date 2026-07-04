import { test } from "node:test";
import assert from "node:assert/strict";
import { lobSchema } from "@/lib/lob-schema";
import { buildLobContent, LETTER_TEMPLATES, POSTCARD_FRONT_HTML, applyMhNote } from "@/lib/mailer-data";
import { MH_MAIL_LINE } from "@/lib/mh-eligibility";

const TO = { name: "John Miller", address_line1: "4521 Desert View Rd", city: "Kingman", state: "AZ", zip: "86401" };

// ── buildLobContent: gövde tipe göre doğru şema alanına gider ────────────────
test("buildLobContent: mektup tipleri → template alanı, front/back yok", () => {
  for (const t of ["yellow_letter", "offer_letter", "follow_up"] as const) {
    const c = buildLobContent(t, "Hi {{owner_name}}");
    assert.deepEqual(c, { template: "Hi {{owner_name}}" }, t);
  }
});

test("buildLobContent: postcard → front+back dolu, template YOK (eski sessiz-düşme bug'ı)", () => {
  const c = buildLobContent("postcard", "ATTENTION LANDOWNER\n\nCall us");
  assert.ok(!("template" in c), "postcard'da template alanı olmamalı");
  if (!("back" in c)) assert.fail("postcard back üretmeli");
  assert.equal(c.front, POSTCARD_FRONT_HTML);
  assert.ok(c.back.includes("ATTENTION LANDOWNER"), "gövde back içinde olmalı");
  assert.ok(c.back.includes("white-space:pre-line"), "satır sonları korunmalı");
});

test("buildLobContent: postcard gövdesindeki HTML karakterleri escape edilir, {{merge}} korunur", () => {
  const c = buildLobContent("postcard", "Fees < $5 & no <script> — {{county}}");
  if (!("back" in c)) assert.fail("postcard back üretmeli");
  assert.ok(!c.back.includes("<script>"), "ham HTML enjekte edilmemeli");
  assert.ok(c.back.includes("&lt;script&gt;"));
  assert.ok(c.back.includes("{{county}}"), "merge placeholder bozulmamalı");
});

test("POSTCARD_FRONT_HTML: iç sinyal/kişisel veri taşımaz (MH, spread, owner)", () => {
  const low = POSTCARD_FRONT_HTML.toLowerCase();
  for (const leak of ["mh", "road act", "spread", "{{"]) {
    assert.ok(!low.includes(leak), `ön yüz '${leak}' içermemeli`);
  }
});

// ── lobSchema: gerçek Quick Send payload'ları şemadan geçer ──────────────────
test("lobSchema: postcard şablonu (tpl2) buildLobContent çıktısıyla parse OLUR ve back'i taşır", () => {
  const tpl2 = LETTER_TEMPLATES.find((t) => t.id === "tpl2")!;
  const body = applyMhNote(tpl2.preview, null);
  const parsed = lobSchema.safeParse({ action: "send_postcard", to: TO, ...buildLobContent(tpl2.type, body) });
  assert.ok(parsed.success, JSON.stringify(!parsed.success && parsed.error.flatten()));
  if (parsed.data.action !== "send_postcard") assert.fail("action send_postcard olmalı");
  assert.ok(parsed.data.back && parsed.data.back.includes("ATTENTION LANDOWNER"), "içerik şemadan DÜŞMEDEN geçmeli");
  assert.ok(parsed.data.front, "front dolu olmalı");
});

test("lobSchema: MH kozlu uzun mektup gövdesi (tpl3) template'ten geçer (eski max200 regresyonu)", () => {
  const tpl3 = LETTER_TEMPLATES.find((t) => t.id === "tpl3")!;
  const body = applyMhNote(tpl3.preview, MH_MAIL_LINE);
  assert.ok(body.length > 200, "test öncülü: gövde 200 karakterden uzun olmalı");
  const parsed = lobSchema.safeParse({ action: "send_letter", to: TO, template: body });
  assert.ok(parsed.success);
  if (parsed.data.action !== "send_letter") assert.fail("action send_letter olmalı");
  assert.ok(parsed.data.template?.includes(MH_MAIL_LINE.trim()));
});

test("lobSchema: postcard back 10k sınırında — HTML zarflı en uzun şablon bile sığar, 10k+ reddedilir", () => {
  const longest = Math.max(...LETTER_TEMPLATES.map((t) => t.preview.length));
  const zarf = buildLobContent("postcard", "x".repeat(longest));
  if (!("back" in zarf)) assert.fail("postcard back üretmeli");
  assert.ok(lobSchema.safeParse({ action: "send_postcard", to: TO, ...zarf }).success);
  assert.ok(
    !lobSchema.safeParse({ action: "send_postcard", to: TO, back: "x".repeat(10_001) }).success,
    "10k üstü kötüye kullanım reddedilmeli"
  );
});
