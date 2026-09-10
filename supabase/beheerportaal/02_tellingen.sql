-- ============================================================================
-- MIGRATIE: tellingen-app voor poetspersoneel + Snelle verwerking
-- Plak dit APART in Supabase: Dashboard > SQL Editor > New query > Run.
-- Dit is een aanvulling op schema.sql, niet een vervanging — enkel dit
-- bestand uitvoeren, niet schema.sql opnieuw (dat zou de voorbeelddata
-- dupliceren).
--
-- Wat dit toevoegt:
-- 1. Een vaste, geheime teller-link per gebouw (geen account nodig).
-- 2. "Ruwe tellingen": wat het poetspersoneel via die link invoert. Dit
--    heeft GEEN invloed op voorraad/facturatie tot een beheerder het
--    controleert en goedkeurt in "Registraties · controle".
-- ============================================================================

set search_path = beheerportaal, public, extensions;

-- 1. Vaste teller-link per gebouw (token in de URL, geen naam/wachtwoord nodig)
alter table buildings add column if not exists teller_token text unique
  default encode(gen_random_bytes(12), 'hex');

update buildings set teller_token = encode(gen_random_bytes(12), 'hex')
  where teller_token is null;

-- 2. Ruwe tellingen: één per (gebouw, reservatie, vooraf/nadien)-invoer.
-- status 'open' = nog te controleren, 'verwerkt' = overgenomen door een beheerder.
create table if not exists ruwe_tellingen (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings (id) on delete cascade,
  reservation_id uuid not null references reservations (id) on delete cascade,
  type text not null check (type in ('vooraf', 'nadien')),
  ingevoerd_door text,
  status text not null default 'open' check (status in ('open', 'verwerkt')),
  created_at timestamptz not null default now()
);

create table if not exists ruwe_telling_regels (
  ruwe_telling_id uuid not null references ruwe_tellingen (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  aantal integer not null default 0,
  primary key (ruwe_telling_id, product_id)
);

alter table ruwe_tellingen enable row level security;
alter table ruwe_telling_regels enable row level security;

-- Enkel ingelogde beheerders/gebouwbeheerders/administratie mogen de wachtrij
-- zien en bijwerken (bv. status op 'verwerkt' zetten na goedkeuring).
drop policy if exists "ruwe_tellingen_select" on ruwe_tellingen;
create policy "ruwe_tellingen_select" on ruwe_tellingen for select using (auth.role() = 'authenticated');
drop policy if exists "ruwe_tellingen_write" on ruwe_tellingen;
create policy "ruwe_tellingen_write" on ruwe_tellingen for all
  using (can_edit_reservations()) with check (can_edit_reservations());

drop policy if exists "ruwe_telling_regels_select" on ruwe_telling_regels;
create policy "ruwe_telling_regels_select" on ruwe_telling_regels for select using (auth.role() = 'authenticated');
drop policy if exists "ruwe_telling_regels_write" on ruwe_telling_regels;
create policy "ruwe_telling_regels_write" on ruwe_telling_regels for all
  using (can_edit_reservations()) with check (can_edit_reservations());

-- ============================================================================
-- Functies voor de anonieme teller-app (poetspersoneel, geen account/rol).
-- Deze zijn SECURITY DEFINER: ze draaien met verhoogde rechten, maar geven
-- enkel het strikt noodzakelijke terug, en enkel als het token klopt.
-- ============================================================================

-- Gebouwnaam opzoeken via token (voor de titel van de teller-app)
create or replace function teller_gebouw(p_token text)
returns table (id uuid, name text)
language sql stable
security definer set search_path = beheerportaal, public, extensions
as $$
  select id, name from buildings where teller_token = p_token and actief = true;
$$;

-- Openstaande reservaties van dat gebouw (om te kiezen welke telling het is)
create or replace function teller_reservaties(p_token text)
returns table (id uuid, huurder text, activiteit text, ruimte text, begin_datum date, eind_datum date)
language sql stable
security definer set search_path = beheerportaal, public, extensions
as $$
  select r.id, r.huurder, r.activiteit, r.ruimte, r.begin_datum, r.eind_datum
  from reservations r
  join buildings b on b.id = r.building_id
  where b.teller_token = p_token
  order by r.begin_datum desc
  limit 50;
$$;

-- Standaardassortiment van dat gebouw (enkel 'standaard'-producten, geen boetes)
create or replace function teller_producten(p_token text)
returns table (id uuid, name text, categorie text)
language sql stable
security definer set search_path = beheerportaal, public, extensions
as $$
  select p.id, p.name, p.categorie
  from products p
  join product_buildings pb on pb.product_id = p.id
  join buildings b on b.id = pb.building_id
  where b.teller_token = p_token and p.actief = true and p.afrekenmodus = 'standaard'
  order by p.categorie, p.name;
$$;

-- Telling indienen: valideert het token, maakt de ruwe_tellingen-rij + regels aan.
-- p_regels is een JSON-array zoals [{"product_id": "...", "aantal": 12}, ...]
create or replace function submit_ruwe_telling(
  p_token text,
  p_reservation_id uuid,
  p_type text,
  p_ingevoerd_door text,
  p_regels jsonb
)
returns uuid
language plpgsql
security definer set search_path = beheerportaal, public, extensions
as $$
declare
  v_building_id uuid;
  v_telling_id uuid;
  v_regel jsonb;
begin
  select id into v_building_id from buildings where teller_token = p_token and actief = true;
  if v_building_id is null then
    raise exception 'Ongeldige of verlopen link.';
  end if;

  if p_type not in ('vooraf', 'nadien') then
    raise exception 'Ongeldig type telling.';
  end if;

  insert into ruwe_tellingen (building_id, reservation_id, type, ingevoerd_door)
  values (v_building_id, p_reservation_id, p_type, nullif(trim(p_ingevoerd_door), ''))
  returning id into v_telling_id;

  for v_regel in select * from jsonb_array_elements(p_regels)
  loop
    insert into ruwe_telling_regels (ruwe_telling_id, product_id, aantal)
    values (v_telling_id, (v_regel ->> 'product_id')::uuid, coalesce((v_regel ->> 'aantal')::int, 0));
  end loop;

  return v_telling_id;
end;
$$;

-- Enkel de anonieme rol mag deze functies uitvoeren (het token zelf is de "sleutel").
grant execute on function teller_gebouw(text) to anon;
grant execute on function teller_reservaties(text) to anon;
grant execute on function teller_producten(text) to anon;
grant execute on function submit_ruwe_telling(text, uuid, text, text, jsonb) to anon;

-- ============================================================================
-- AANVULLING: live-controle op onmogelijke tellingen (nadien > vooraf)
-- Doel: het poetspersoneel ziet dit ONMIDDELLIJK in de teller-app zelf, niet
-- pas achteraf bij de beheerder — want tegen dan zijn ze vaak al vertrokken.
-- ============================================================================

alter table ruwe_tellingen add column if not exists afwijking_bevestigd boolean not null default false;

-- Beste gekende "vooraf"-referentie per product voor een reservatie: bij
-- voorkeur de al goedgekeurde telling; anders de meest recente ruwe (nog niet
-- goedgekeurde) "vooraf"-invoer. Geeft enkel producten terug waarvoor
-- effectief al een vooraf-waarde gekend is (anders is er niets om tegen af te
-- toetsen).
create or replace function teller_vooraf_referentie(p_token text, p_reservation_id uuid)
returns table (product_id uuid, vooraf_aantal integer)
language plpgsql
security definer set search_path = beheerportaal, public, extensions
as $$
declare
  v_building_id uuid;
begin
  select id into v_building_id from buildings where teller_token = p_token and actief = true;
  if v_building_id is null then
    raise exception 'Ongeldige of verlopen link.';
  end if;

  return query
  with laatste_ruwe as (
    select rtr.product_id, rtr.aantal,
           row_number() over (partition by rtr.product_id order by rt.created_at desc) as rn
    from ruwe_tellingen rt
    join ruwe_telling_regels rtr on rtr.ruwe_telling_id = rt.id
    where rt.reservation_id = p_reservation_id and rt.type = 'vooraf'
  )
  select p.id as product_id,
         coalesce(approved.vooraf, lr.aantal) as vooraf_aantal
  from products p
  join product_buildings pb on pb.product_id = p.id and pb.building_id = v_building_id
  left join reservation_product_tellingen approved
    on approved.reservation_id = p_reservation_id and approved.product_id = p.id
  left join laatste_ruwe lr on lr.product_id = p.id and lr.rn = 1
  where p.actief = true and p.afrekenmodus = 'standaard'
    and coalesce(approved.vooraf, lr.aantal) is not null;
end;
$$;

grant execute on function teller_vooraf_referentie(text, uuid) to anon;

-- submit_ruwe_telling: uitgebreid met een vlag die aangeeft dat het
-- poetspersoneel de (onmogelijke) afwijking zag en toch bevestigde dat de
-- telling klopt. Zo'n telling wordt in "Registraties · controle" extra
-- opvallend getoond.
-- (De oude versie met 5 argumenten wordt eerst verwijderd, anders blijven
-- beide versies naast elkaar bestaan als aparte functies.)
drop function if exists submit_ruwe_telling(text, uuid, text, text, jsonb);

create or replace function submit_ruwe_telling(
  p_token text,
  p_reservation_id uuid,
  p_type text,
  p_ingevoerd_door text,
  p_regels jsonb,
  p_afwijking_bevestigd boolean default false
)
returns uuid
language plpgsql
security definer set search_path = beheerportaal, public, extensions
as $$
declare
  v_building_id uuid;
  v_telling_id uuid;
  v_regel jsonb;
begin
  select id into v_building_id from buildings where teller_token = p_token and actief = true;
  if v_building_id is null then
    raise exception 'Ongeldige of verlopen link.';
  end if;

  if p_type not in ('vooraf', 'nadien') then
    raise exception 'Ongeldig type telling.';
  end if;

  insert into ruwe_tellingen (building_id, reservation_id, type, ingevoerd_door, afwijking_bevestigd)
  values (v_building_id, p_reservation_id, p_type, nullif(trim(p_ingevoerd_door), ''), p_afwijking_bevestigd)
  returning id into v_telling_id;

  for v_regel in select * from jsonb_array_elements(p_regels)
  loop
    insert into ruwe_telling_regels (ruwe_telling_id, product_id, aantal)
    values (v_telling_id, (v_regel ->> 'product_id')::uuid, coalesce((v_regel ->> 'aantal')::int, 0));
  end loop;

  return v_telling_id;
end;
$$;

grant execute on function submit_ruwe_telling(text, uuid, text, text, jsonb, boolean) to anon;
