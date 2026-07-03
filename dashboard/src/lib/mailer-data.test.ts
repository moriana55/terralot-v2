import { test } from "node:test";
import assert from "node:assert/strict";
import { applyMhNote, LETTER_TEMPLATES } from "@/lib/mailer-data";
import { MH_MAIL_LINE } from "@/lib/mh-eligibility";

// ── applyMhNote — dolu: satır yerine oturur ──────────────────────────────────
test("applyMhNote: dolu not → placeholder'ın yerine geçer, paragraf yapısı korunur", () => {
  const out = applyMhNote("A\n\n{{mh_note}}\n\nB", MH_MAIL_LINE);
  assert.equal(out, `A\n\n${MH_MAIL_LINE}\n\nB`);
  assert.ok(!out.includes("{{mh_note}}"));
});

// ── applyMhNote — boş: satır İZSİZ kaybolur, boş paragraf kalmaz ─────────────
test("applyMhNote: boş/null not → placeholder ve paragraf boşluğu birlikte silinir", () => {
  for (const empty of ["", "   ", null, undefined] as const) {
    const out = applyMhNote("A\n\n{{mh_note}}\n\nB", empty);
    assert.equal(out, "A\n\nB", `boş not (${JSON.stringify(empty)}) artık paragraf bırakmamalı`);
  }
});

test("applyMhNote: placeholder metnin başında/sonunda olsa da yetim boşluk kalmaz", () => {
  assert.equal(applyMhNote("{{mh_note}}\n\nHi", null), "Hi");
  assert.equal(applyMhNote("Hi\n\n{{mh_note}}", null), "Hi\n");
  assert.equal(applyMhNote("no placeholder", null), "no placeholder");
});

// ── Şablonlar — mektup tipleri kozu taşır, sözleşme/postcard taşımaz ─────────
test("LETTER_TEMPLATES: tpl1/tpl3/tpl4 {{mh_note}} içerir; tpl2 (postcard) ve tpl5 (sözleşme) içermez", () => {
  const has = (id: string) => LETTER_TEMPLATES.find((t) => t.id === id)!.preview.includes("{{mh_note}}");
  assert.ok(has("tpl1") && has("tpl3") && has("tpl4"));
  assert.ok(!has("tpl2") && !has("tpl5"));
});

test("LETTER_TEMPLATES: boş mh_note ile render edilen hiçbir şablonda çift-boş paragraf kalmaz", () => {
  for (const t of LETTER_TEMPLATES) {
    const out = applyMhNote(t.preview, null);
    assert.ok(!out.includes("{{mh_note}}"), t.id);
    assert.ok(!/\n{3,}/.test(out), `${t.id} boş paragraf bıraktı`);
  }
});
