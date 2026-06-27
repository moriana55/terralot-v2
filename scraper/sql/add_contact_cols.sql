-- Skip-trace ile gelen telefon/e-posta kolonları
alter table public.offmarket_leads add column if not exists phone1 text;
alter table public.offmarket_leads add column if not exists phone2 text;
alter table public.offmarket_leads add column if not exists email1 text;
alter table public.offmarket_leads add column if not exists skiptraced boolean default false;
