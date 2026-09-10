-- ============================================================================
-- Beheerportaal — database schema
-- Plak dit volledig in Supabase: Dashboard > SQL Editor > New query > Run
-- ============================================================================

create schema if not exists beheerportaal;
grant usage on schema beheerportaal to anon, authenticated, service_role;
set search_path = beheerportaal, public, extensions;

alter default privileges in schema beheerportaal
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema beheerportaal
  grant usage, select on sequences to anon, authenticated, service_role;
alter default privileges in schema beheerportaal
  grant execute on functions to anon, authenticated, service_role;

-- 1. PROFIELEN (koppelt een ingelogde gebruiker aan een rol)
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'administratie'
    check (role in ('systeembeheerder', 'afdelingshoofd', 'gebouwbeheerder', 'administratie')),
  created_at timestamptz not null default now()
);

-- 2. GEBOUWEN
create table if not exists buildings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  actief boolean not null default true,
  created_at timestamptz not null default now()
);

-- Welke gebouwen een "gebouwbeheerder" mag beheren
create table if not exists profile_buildings (
  profile_id uuid not null references profiles (id) on delete cascade,
  building_id uuid not null references buildings (id) on delete cascade,
  primary key (profile_id, building_id)
);

-- 2b. VOORAF KLAARGEZETTE ROLLEN (nog niet uitgenodigd)
-- Hiermee kan de systeembeheerder al een rol (en gebouw, indien gebouwbeheerder)
-- instellen voor iemand vóór er effectief een uitnodigingsmail verstuurd wordt.
create table if not exists pending_roles (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text,
  role text not null default 'administratie'
    check (role in ('systeembeheerder', 'afdelingshoofd', 'gebouwbeheerder', 'administratie')),
  created_at timestamptz not null default now()
);

create table if not exists pending_role_buildings (
  pending_id uuid not null references pending_roles (id) on delete cascade,
  building_id uuid not null references buildings (id) on delete cascade,
  primary key (pending_id, building_id)
);

-- 3. PRODUCTEN (drank, versnaperingen, boetes/toeslagen, ...)
-- afrekenmodus:
--  'standaard' -> normaal product (ook grote flessen e.d.), per gebouw aan te vinken of het
--                 tot het standaardassortiment behoort; kan overal, nergens, of maar op enkele
--                 gebouwen aangevinkt staan
--  'toeslag'   -> boete/toeslag, vast bedrag, aan te vinken per reservatie (niet per gebouw)
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  prijs numeric(10,2) not null default 0,
  categorie text not null default 'Diversen',
  verpakking integer not null default 1,
  actief boolean not null default true,
  afrekenmodus text not null default 'standaard'
    check (afrekenmodus in ('standaard', 'toeslag')),
  created_at timestamptz not null default now()
);

create table if not exists product_buildings (
  product_id uuid not null references products (id) on delete cascade,
  building_id uuid not null references buildings (id) on delete cascade,
  primary key (product_id, building_id)
);

-- 5. CONTACTEN (eenmalig te splitsen huurdersnamen uit PDF-uploads: vereniging + contactpersoon)
create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  ruwe_naam text not null unique, -- exacte "Klant"-tekst zoals ze uit de PDF komt; matchingsleutel
  vereniging text,
  contactpersoon text,
  telefoon text,
  adres text,
  created_at timestamptz not null default now()
);

-- 6. RESERVATIES (ingelezen uit PDF, of manueel ingevoerd)
create table if not exists reservations (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings (id) on delete cascade,
  contact_id uuid references contacts (id) on delete set null,
  huurder text not null, -- ruwe naam op moment van import, ook als contact nadien wijzigt
  adres text,
  telefoon text,
  activiteit text,
  ruimte text,
  begin_datum date not null,
  eind_datum date not null,
  toegang_start time,
  activiteit_start time,
  activiteit_eind time,
  toegang_eind time,
  status text not null default 'wacht' check (status in ('wacht', 'gecontroleerd')),
  bron text not null default 'manueel' check (bron in ('pdf', 'manueel')),
  created_at timestamptz not null default now()
);

-- 7. TELLINGEN, LEVERINGEN, EIGEN VERBRUIK EN BOETES PER RESERVATIE
-- \u00e9\u00e9n rij per (reservatie, product): vooraf- en nadien-telling naast elkaar
create table if not exists reservation_product_tellingen (
  reservation_id uuid not null references reservations (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  vooraf integer,
  nadien integer,
  primary key (reservation_id, product_id)
);

-- leveringen en eigen verbruik: gekoppeld aan een reservatie, OF los (gebouw + datum,
-- bv. een levering van de drankleverancier of verbruik door een eigen dienst)
create table if not exists leveringen (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid references reservations (id) on delete cascade,
  building_id uuid references buildings (id) on delete cascade,
  datum date,
  product_id uuid not null references products (id) on delete cascade,
  aantal integer not null default 0,
  wie text,
  created_at timestamptz not null default now(),
  constraint leveringen_gekoppeld_of_los check (
    (reservation_id is not null) or (building_id is not null and datum is not null)
  )
);

create table if not exists eigen_verbruik (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid references reservations (id) on delete cascade,
  building_id uuid references buildings (id) on delete cascade,
  datum date,
  product_id uuid not null references products (id) on delete cascade,
  aantal integer not null default 0,
  wie text,
  created_at timestamptz not null default now(),
  constraint eigen_verbruik_gekoppeld_of_los check (
    (reservation_id is not null) or (building_id is not null and datum is not null)
  )
);

-- aangevinkte boetes/toeslagen (producten met afrekenmodus 'toeslag') per reservatie
create table if not exists reservation_boetes (
  reservation_id uuid not null references reservations (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  primary key (reservation_id, product_id)
);

-- ============================================================================
-- Helper: rol van de ingelogde gebruiker opzoeken (voor gebruik in policies)
-- ============================================================================
create or replace function current_role_name()
returns text
language sql stable
security definer set search_path = beheerportaal, public, extensions
as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function can_edit_masterdata()
returns boolean
language sql stable
security definer set search_path = beheerportaal, public, extensions
as $$
  select current_role_name() in ('systeembeheerder', 'administratie');
$$;

create or replace function is_systeembeheerder()
returns boolean
language sql stable
security definer set search_path = beheerportaal, public, extensions
as $$
  select current_role_name() = 'systeembeheerder';
$$;

create or replace function can_edit_reservations()
returns boolean
language sql stable
security definer set search_path = beheerportaal, public, extensions
as $$
  select current_role_name() in ('systeembeheerder', 'administratie', 'gebouwbeheerder');
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table profiles enable row level security;
alter table profile_buildings enable row level security;
alter table pending_roles enable row level security;
alter table pending_role_buildings enable row level security;
alter table buildings enable row level security;
alter table products enable row level security;
alter table product_buildings enable row level security;
alter table reservations enable row level security;
alter table reservation_product_tellingen enable row level security;
alter table leveringen enable row level security;
alter table eigen_verbruik enable row level security;
alter table reservation_boetes enable row level security;
alter table contacts enable row level security;

-- profiles: iedereen die ingelogd is mag alle profielen lezen (nodig voor "wie doet wat");
-- een gebruiker mag enkel zijn eigen naam aanpassen. Rol-wijzigingen gebeuren via een
-- beveiligde server action met de service-role key (zie lib/supabase/admin.ts), niet
-- rechtstreeks door de gebruiker.
create policy "profiles_select_authenticated" on profiles
  for select using (auth.role() = 'authenticated');
create policy "profiles_update_own_name" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "profile_buildings_select" on profile_buildings
  for select using (auth.role() = 'authenticated');

-- pending_roles / pending_role_buildings: enkel de systeembeheerder mag dit zien en beheren.
create policy "pending_roles_all" on pending_roles for all
  using (is_systeembeheerder()) with check (is_systeembeheerder());
create policy "pending_role_buildings_all" on pending_role_buildings for all
  using (is_systeembeheerder()) with check (is_systeembeheerder());

-- buildings / products / product_buildings:
-- iedereen ingelogd mag lezen, enkel systeembeheerder + administratie mogen schrijven.
create policy "buildings_select" on buildings for select using (auth.role() = 'authenticated');
create policy "buildings_write" on buildings for all
  using (can_edit_masterdata()) with check (can_edit_masterdata());

create policy "products_select" on products for select using (auth.role() = 'authenticated');
create policy "products_write" on products for all
  using (can_edit_masterdata()) with check (can_edit_masterdata());

create policy "product_buildings_select" on product_buildings for select using (auth.role() = 'authenticated');
create policy "product_buildings_write" on product_buildings for all
  using (can_edit_masterdata()) with check (can_edit_masterdata());

create policy "reservations_select" on reservations for select using (auth.role() = 'authenticated');
create policy "reservations_write" on reservations for all
  using (can_edit_reservations()) with check (can_edit_reservations());

create policy "tellingen_select" on reservation_product_tellingen for select using (auth.role() = 'authenticated');
create policy "tellingen_write" on reservation_product_tellingen for all
  using (can_edit_reservations()) with check (can_edit_reservations());

create policy "leveringen_select" on leveringen for select using (auth.role() = 'authenticated');
create policy "leveringen_write" on leveringen for all
  using (can_edit_reservations()) with check (can_edit_reservations());

create policy "eigen_verbruik_select" on eigen_verbruik for select using (auth.role() = 'authenticated');
create policy "eigen_verbruik_write" on eigen_verbruik for all
  using (can_edit_reservations()) with check (can_edit_reservations());

create policy "reservation_boetes_select" on reservation_boetes for select using (auth.role() = 'authenticated');
create policy "reservation_boetes_write" on reservation_boetes for all
  using (can_edit_reservations()) with check (can_edit_reservations());

create policy "contacts_select" on contacts for select using (auth.role() = 'authenticated');
create policy "contacts_write" on contacts for all
  using (can_edit_reservations()) with check (can_edit_reservations());

-- ============================================================================
-- Voorbeelddata (mag je meteen aanpassen/verwijderen in de app zelf)
-- ============================================================================
insert into buildings (name) values
  ('GC De Bunder'), ('JC De 4link'), ('OC d''Oude Schole'),
  ('OC Den Ommeganck'), ('OC Oud Gemeentehuis'), ('OC ''t Torreke')
on conflict do nothing;

insert into products (name, prijs, categorie, verpakking, afrekenmodus) values
  ('Cola', 1.50, 'Non-alcoholisch', 24, 'standaard'),
  ('Water', 1.20, 'Non-alcoholisch', 24, 'standaard'),
  ('Pils', 2.00, 'Bier', 24, 'standaard'),
  ('Wijn (glas)', 3.00, 'Wijn & cava', 6, 'standaard'),
  ('Coca-Cola 1l', 0, 'Non-alcoholisch', 1, 'standaard'),
  ('Eigen drank meegebracht', 25, 'Boetes', 1, 'toeslag'),
  ('Extra opkuis', 40, 'Boetes', 1, 'toeslag'),
  ('Frigo / drankberging niet in orde', 15, 'Boetes', 1, 'toeslag'),
  ('Leeggoed of afval niet meegenomen', 20, 'Boetes', 1, 'toeslag'),
  ('Schenkrecht', 30, 'Boetes', 1, 'toeslag');

-- Nieuwe auth-gebruikers krijgen automatisch een profiel in het afzonderlijke
-- Beheerportaal-schema. Een eigen triggernaam voorkomt botsingen met andere apps.
create or replace function beheerportaal.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = beheerportaal, public, extensions
as $$
declare
  v_pending beheerportaal.pending_roles%rowtype;
begin
  select * into v_pending
  from beheerportaal.pending_roles
  where lower(email) = lower(new.email)
  limit 1;

  if found then
    insert into beheerportaal.profiles (id, email, full_name, role)
    values (
      new.id,
      new.email,
      coalesce(v_pending.full_name, new.raw_user_meta_data ->> 'full_name', new.email),
      v_pending.role
    );

    insert into beheerportaal.profile_buildings (profile_id, building_id)
    select new.id, building_id
    from beheerportaal.pending_role_buildings
    where pending_id = v_pending.id;

    delete from beheerportaal.pending_roles where id = v_pending.id;
  else
    insert into beheerportaal.profiles (id, email, full_name, role)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
      'administratie'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_beheerportaal on auth.users;
create trigger on_auth_user_created_beheerportaal
  after insert on auth.users
  for each row execute function beheerportaal.handle_new_user();

grant select, insert, update, delete on all tables in schema beheerportaal
  to anon, authenticated, service_role;
grant usage, select on all sequences in schema beheerportaal
  to anon, authenticated, service_role;
grant execute on all functions in schema beheerportaal
  to anon, authenticated, service_role;
