-- Houdt de bestaande Nederlandstalige profielvelden compatibel met de webapp.
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists role text;
alter table public.profiles add column if not exists created_at timestamptz not null default now();

update public.profiles
set
  full_name = coalesce(full_name, naam),
  role = coalesce(role, rol::text),
  active = coalesce(active, actief),
  email = coalesce(email, (select u.email from auth.users u where u.id = profiles.id));

alter table public.profiles alter column role set default 'administratie';
alter table public.profiles alter column role set not null;
