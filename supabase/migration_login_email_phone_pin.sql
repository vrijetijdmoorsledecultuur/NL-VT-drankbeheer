-- Eigen toegangspoort voor Drankbeheer: e-mail of gsm + persoonlijke pincode.
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists active boolean not null default true;

create unique index if not exists profiles_phone_unique
  on public.profiles (phone)
  where phone is not null;

-- Bestaande gebruikers blijven actief en behouden hun huidige toegang.
update public.profiles set active = true where active is null;
