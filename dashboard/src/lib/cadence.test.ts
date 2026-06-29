// Multi-touch cadence tests (pure, no DB/network). Çalıştırma: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CADENCE_STEPS,
  CADENCE_TOTAL_STEPS,
  nextAction,
  afterSend,
  markResponded,
  isDue,
} from "./cadence.ts";

const T0 = new Date("2026-01-01T00:00:00.000Z");
const days = (d: number) => new Date(T0.getTime() + d * 86_400_000);

test("dizi 3 dokunuş: letter/offer(0g) → postcard/followup(14g) → letter/final(30g)", () => {
  assert.equal(CADENCE_TOTAL_STEPS, 3);
  assert.deepEqual(
    CADENCE_STEPS.map((s) => [s.step, s.channel, s.type, s.delayDays]),
    [
      [1, "letter", "offer", 0],
      [2, "postcard", "followup", 14],
      [3, "letter", "final", 16], // 14 + 16 = toplam 30. gün
    ]
  );
  // toplam günler kümülatif olarak 0 / 14 / 30
  let acc = 0;
  const totals = CADENCE_STEPS.map((s) => (acc += s.delayDays));
  assert.deepEqual(totals, [0, 14, 30]);
});

test("hiç başlamamış lead → Touch 1'i ŞİMDİ gönder (ready)", () => {
  const a = nextAction({ sequence_step: 0 }, T0);
  assert.equal(a.kind, "send");
  if (a.kind !== "send") return;
  assert.equal(a.step.step, 1);
  assert.equal(a.step.channel, "letter");
  assert.equal(a.ready, true);
  assert.equal(a.dueAt.getTime(), T0.getTime());
});

test("Touch 1 gönderildi → next_action_at +14g, sıradaki postcard, henüz hazır DEĞİL", () => {
  const adv = afterSend(1, T0);
  assert.equal(adv.sequence_step, 1);
  assert.equal(adv.sequence_status, "active");
  assert.equal(adv.next_action_at, days(14).toISOString());

  // 5. günde bakınca: sıradaki Touch 2 ama vadesi gelmemiş
  const a = nextAction(
    { sequence_step: adv.sequence_step, next_action_at: adv.next_action_at, sequence_status: adv.sequence_status },
    days(5)
  );
  assert.equal(a.kind, "send");
  if (a.kind !== "send") return;
  assert.equal(a.step.step, 2);
  assert.equal(a.step.channel, "postcard");
  assert.equal(a.ready, false);

  // 14. günde vade geldi → hazır
  const b = nextAction(
    { sequence_step: 1, next_action_at: adv.next_action_at, sequence_status: "active" },
    days(14)
  );
  assert.equal(b.kind === "send" && b.ready, true);
});

test("Touch 2 gönderildi → next_action_at +16g (30. gün), sıradaki final letter", () => {
  const adv = afterSend(2, days(14));
  assert.equal(adv.sequence_step, 2);
  assert.equal(adv.next_action_at, days(30).toISOString());
  const a = nextAction({ sequence_step: 2, next_action_at: adv.next_action_at }, days(30));
  assert.equal(a.kind, "send");
  if (a.kind !== "send") return;
  assert.equal(a.step.step, 3);
  assert.equal(a.step.type, "final");
  assert.equal(a.ready, true);
});

test("Touch 3 (son) gönderildi → dizi tamamlandı (done, next_action_at null)", () => {
  const adv = afterSend(3, days(30));
  assert.equal(adv.sequence_status, "done");
  assert.equal(adv.next_action_at, null);
  const a = nextAction({ sequence_step: 3, sequence_status: "done" }, days(40));
  assert.equal(a.kind, "done");
});

test("sequence_step >= toplam → done (status verilmese bile)", () => {
  const a = nextAction({ sequence_step: 3 }, days(100));
  assert.equal(a.kind, "done");
});

test("responded=true → her zaman paused (vade geçmiş olsa bile)", () => {
  const a = nextAction({ sequence_step: 1, next_action_at: days(14).toISOString(), responded: true }, days(20));
  assert.equal(a.kind, "paused");
  // markResponded yardımcı alanları
  assert.deepEqual(markResponded(), { responded: true, sequence_status: "paused" });
});

test("isDue: vade geçmiş + bitmemiş + responded değil → true; aksi → false", () => {
  assert.equal(isDue({ sequence_step: 1, next_action_at: days(14).toISOString() }, days(20)), true);
  assert.equal(isDue({ sequence_step: 1, next_action_at: days(14).toISOString() }, days(5)), false);
  assert.equal(isDue({ sequence_step: 1, next_action_at: days(14).toISOString(), responded: true }, days(20)), false);
  assert.equal(isDue({ sequence_step: 3, sequence_status: "done" }, days(99)), false);
});

test("next_action_at yoksa last_sent_at + delay'den hesaplar (graceful kolon yokluğu)", () => {
  // sadece last_sent_at var (next_action_at kolonu migration öncesi yok)
  const a = nextAction({ sequence_step: 1, last_sent_at: T0.toISOString() }, days(10));
  assert.equal(a.kind, "send");
  if (a.kind !== "send") return;
  assert.equal(a.step.step, 2);
  // due = T0 + 14g
  assert.equal(a.dueAt.getTime(), days(14).getTime());
  assert.equal(a.ready, false);
});

test("bozuk/negatif sequence_step güvenli (0'a clamp)", () => {
  const a = nextAction({ sequence_step: -5 }, T0);
  assert.equal(a.kind === "send" && a.step.step === 1, true);
});
