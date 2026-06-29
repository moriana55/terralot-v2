-- outreach_cadence — çok-dokunuşlu mektup KADANSI için outreach_events kolonları.
-- Supabase SQL Editor'a yapıştır + Run. (Route'lar isMissing fallback'i ile bu
-- kolonlar OLMADAN da çalışır; ama kadans/tick gerçekten ilerlemek için bunu
-- bir kez çalıştırmak gerekir. Idempotent — tekrar çalıştırmak güvenli.)
--
-- Kadans: Touch1 letter/offer (0g) → Touch2 postcard/followup (+14g) →
--         Touch3 letter/final (+30g). Sahip yanıt verirse durur (responded=true).
-- Tek kaynak adım/zamanlama tanımı: src/lib/cadence.ts

alter table public.outreach_events
  add column if not exists sequence_step    integer     not null default 0,
  add column if not exists next_action_at   timestamptz,
  add column if not exists sequence_status  text        not null default 'active',
  add column if not exists responded        boolean     not null default false,
  add column if not exists last_sent_at     timestamptz;

-- Tick sorgusu: vadesi gelmiş + yanıt yok + hâlâ aktif satırları hızlı bulmak için.
create index if not exists outreach_events_cadence_due_idx
  on public.outreach_events (next_action_at)
  where responded = false and sequence_status = 'active';

-- Lead başına en son kadans işaretçisini (en yeni satır) bulmak için.
create index if not exists outreach_events_lead_recent_idx
  on public.outreach_events (lead_ref, created_at desc);

comment on column public.outreach_events.sequence_step   is 'Bu lead için GÖNDERİLMİŞ dokunuş sayısı (0=hiç, 3=tamam). cadence.ts ile uyumlu.';
comment on column public.outreach_events.next_action_at  is 'Sıradaki dokunuşun planlandığı an. NULL = dizi bitti/duraklatıldı.';
comment on column public.outreach_events.sequence_status is 'active | done | paused';
comment on column public.outreach_events.responded       is 'Sahip yanıt verdi mi — true ise kadans durur.';
comment on column public.outreach_events.last_sent_at    is 'Bu satırdaki dokunuşun gönderim anı.';
