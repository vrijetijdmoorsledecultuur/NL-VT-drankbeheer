-- Eigen toegangspoort voor Drankbeheer: e-mail of gsm + persoonlijke pincode.
set search_path = beheerportaal, public, extensions;

alter table beheerportaal.profiles add column if not exists phone text;
alter table beheerportaal.profiles add column if not exists active boolean not null default true;

create unique index if not exists profiles_phone_unique
  on beheerportaal.profiles (phone)
  where phone is not null;

-- Bestaande gebruikers blijven actief en behouden hun huidige toegang.
update beheerportaal.profiles set active = true where active is null;

-- Koppel de reeds bestaande Auth-gebruikers aan Beheerportaal. Waar het huidige
-- publieke profiel dezelfde gebruiker bevat, nemen we diens naam, rol, gsm en
-- actieve status over. Er worden geen gegevens uit het publieke profiel gewist.
insert into beheerportaal.profiles (id, email, full_name, role, phone, active)
select
  u.id,
  coalesce(p.email, u.email),
  coalesce(p.full_name, u.raw_user_meta_data ->> 'full_name', u.email),
  case
    when p.role in ('systeembeheerder', 'afdelingshoofd', 'gebouwbeheerder', 'administratie')
      then p.role
    else 'administratie'
  end,
  p.phone,
  coalesce(p.active, true)
from auth.users u
left join public.profiles p on p.id = u.id
where u.email is not null
on conflict (id) do update set
  email = excluded.email,
  full_name = coalesce(excluded.full_name, beheerportaal.profiles.full_name),
  role = excluded.role,
  phone = coalesce(excluded.phone, beheerportaal.profiles.phone),
  active = excluded.active;

grant select, insert, update, delete on all tables in schema beheerportaal
  to anon, authenticated, service_role;
grant usage, select on all sequences in schema beheerportaal
  to anon, authenticated, service_role;
grant execute on all functions in schema beheerportaal
  to anon, authenticated, service_role;
