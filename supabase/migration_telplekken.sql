-- ============================================================================
-- MIGRATIE: telplekken per gebouw + universele tellen-link
-- Plak dit APART in Supabase: Dashboard > SQL Editor > New query > Run.
-- Vereist dat migration_tellingen.sql al is uitgevoerd.
--
-- Wat dit toevoegt:
-- 1. Eén universele tellen-link (niet meer één vaste link per gebouw) —
--    werkbaar wanneer personeel tussen gebouwen wisselt.
-- 2. "Telplekken" per gebouw (Frigo, Koelcel, Drankenberging, Garage, Keuken, ...),
--    elk met een eigen productenlijst en optioneel een vaste-voorraad-referentie
--    die bevestigd kan worden in plaats van manueel geteld.
-- ============================================================================

-- 1. Eén universeel token voor de hele organisatie (enkelvoudige rij)
create table if not exists teller_instellingen (
  id boolean primary key default true,
  token text not null unique default encode(gen_random_bytes(12), 'hex'),
  constraint teller_instellingen_singleton check (id)
);
insert into teller_instellingen (id) values (true) on conflict (id) do nothing;

-- 2. Telplekken: fysieke locaties binnen een gebouw waar geteld wordt
create table if not exists telplekken (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings (id) on delete cascade,
  naam text not null,
  volgorde integer not null default 0,
  vereist_telplek_id uuid references telplekken (id) on delete set null,
  heeft_vaste_voorraad boolean not null default false,
  actief boolean not null default true,
  created_at timestamptz not null default now()
);

-- Vaste-voorraad-referentie per telplek (bv. "9 bakken cola" in de frigo van
-- GC De Bunder). Door beheerder in te vullen/aan te passen — hier bewust leeg.
create table if not exists telplek_vaste_voorraad (
  telplek_id uuid not null references telplekken (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  aantal integer not null default 0,
  primary key (telplek_id, product_id)
);

-- Welke producten hoort bij welke telplek, en of dat standaard zichtbaar is
-- of een optionele toevoeging (bv. grote flessen, enkel bij een evenement).
create table if not exists telplek_producten (
  telplek_id uuid not null references telplekken (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  standaard boolean not null default true,
  primary key (telplek_id, product_id)
);

alter table telplekken enable row level security;
alter table telplek_vaste_voorraad enable row level security;
alter table telplek_producten enable row level security;
alter table teller_instellingen enable row level security;

drop policy if exists "telplekken_select" on telplekken;
create policy "telplekken_select" on telplekken for select using (auth.role() = 'authenticated');
drop policy if exists "telplekken_write" on telplekken;
create policy "telplekken_write" on telplekken for all
  using (can_edit_masterdata()) with check (can_edit_masterdata());

drop policy if exists "telplek_vaste_voorraad_select" on telplek_vaste_voorraad;
create policy "telplek_vaste_voorraad_select" on telplek_vaste_voorraad for select using (auth.role() = 'authenticated');
drop policy if exists "telplek_vaste_voorraad_write" on telplek_vaste_voorraad;
create policy "telplek_vaste_voorraad_write" on telplek_vaste_voorraad for all
  using (can_edit_masterdata()) with check (can_edit_masterdata());

drop policy if exists "telplek_producten_select" on telplek_producten;
create policy "telplek_producten_select" on telplek_producten for select using (auth.role() = 'authenticated');
drop policy if exists "telplek_producten_write" on telplek_producten;
create policy "telplek_producten_write" on telplek_producten for all
  using (can_edit_masterdata()) with check (can_edit_masterdata());

drop policy if exists "teller_instellingen_select" on teller_instellingen;
create policy "teller_instellingen_select" on teller_instellingen for select using (auth.role() = 'authenticated');
drop policy if exists "teller_instellingen_write" on teller_instellingen;
create policy "teller_instellingen_write" on teller_instellingen for all
  using (is_systeembeheerder()) with check (is_systeembeheerder());

-- 3. ruwe_tellingen: koppelen aan de gekozen telplek + of vaste voorraad
-- bevestigd werd i.p.v. manueel geteld.
alter table ruwe_tellingen add column if not exists telplek_id uuid references telplekken (id) on delete set null;
alter table ruwe_tellingen add column if not exists vaste_voorraad_bevestigd boolean not null default false;

-- ============================================================================
-- Functies voor de anonieme, universele tellen-app
-- ============================================================================

create or replace function teller_gebouwen(p_token text)
returns table (id uuid, name text)
language sql stable
security definer set search_path = public
as $$
  select b.id, b.name
  from buildings b, teller_instellingen ti
  where ti.token = p_token and b.actief = true
  order by b.name;
$$;

create or replace function teller_telplekken(p_token text, p_building_id uuid)
returns table (id uuid, naam text, volgorde integer, heeft_vaste_voorraad boolean, vereist_naam text)
language sql stable
security definer set search_path = public
as $$
  select tp.id, tp.naam, tp.volgorde, tp.heeft_vaste_voorraad, vereist.naam as vereist_naam
  from telplekken tp
  join teller_instellingen ti on ti.token = p_token
  left join telplekken vereist on vereist.id = tp.vereist_telplek_id
  where tp.building_id = p_building_id and tp.actief = true
  order by tp.volgorde, tp.naam;
$$;

create or replace function teller_telplek_producten(p_token text, p_telplek_id uuid)
returns table (id uuid, name text, categorie text, standaard boolean)
language sql stable
security definer set search_path = public
as $$
  select p.id, p.name, p.categorie, tpp.standaard
  from telplek_producten tpp
  join products p on p.id = tpp.product_id
  join teller_instellingen ti on ti.token = p_token
  where tpp.telplek_id = p_telplek_id and p.actief = true
  order by tpp.standaard desc, p.categorie, p.name;
$$;

create or replace function teller_vaste_voorraad(p_token text, p_telplek_id uuid)
returns table (product_id uuid, name text, aantal integer)
language sql stable
security definer set search_path = public
as $$
  select p.id, p.name, tvv.aantal
  from telplek_vaste_voorraad tvv
  join products p on p.id = tvv.product_id
  join teller_instellingen ti on ti.token = p_token
  where tvv.telplek_id = p_telplek_id
  order by p.categorie, p.name;
$$;

-- Reservaties opzoeken op basis van het gekozen gebouw (i.p.v. via het token
-- afgeleid gebouw, zoals voorheen — er is nu geen 1-op-1 meer).
drop function if exists teller_reservaties(text);
create or replace function teller_reservaties(p_token text, p_building_id uuid)
returns table (id uuid, huurder text, activiteit text, ruimte text, begin_datum date, eind_datum date)
language sql stable
security definer set search_path = public
as $$
  select r.id, r.huurder, r.activiteit, r.ruimte, r.begin_datum, r.eind_datum
  from reservations r
  join teller_instellingen ti on ti.token = p_token
  where r.building_id = p_building_id
  order by r.begin_datum desc
  limit 50;
$$;

-- submit_ruwe_telling: uitgebreid met telplek + vaste-voorraad-bevestiging.
drop function if exists submit_ruwe_telling(text, uuid, text, text, jsonb, boolean);
create or replace function submit_ruwe_telling(
  p_token text,
  p_building_id uuid,
  p_telplek_id uuid,
  p_reservation_id uuid,
  p_type text,
  p_ingevoerd_door text,
  p_regels jsonb,
  p_afwijking_bevestigd boolean default false,
  p_vaste_voorraad_bevestigd boolean default false
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_telling_id uuid;
  v_regel jsonb;
begin
  if not exists (select 1 from teller_instellingen where token = p_token) then
    raise exception 'Ongeldige of verlopen link.';
  end if;

  if p_type not in ('vooraf', 'nadien') then
    raise exception 'Ongeldig type telling.';
  end if;

  insert into ruwe_tellingen
    (building_id, reservation_id, type, ingevoerd_door, afwijking_bevestigd, telplek_id, vaste_voorraad_bevestigd)
  values
    (p_building_id, p_reservation_id, p_type, nullif(trim(p_ingevoerd_door), ''), p_afwijking_bevestigd, p_telplek_id, p_vaste_voorraad_bevestigd)
  returning id into v_telling_id;

  for v_regel in select * from jsonb_array_elements(p_regels)
  loop
    insert into ruwe_telling_regels (ruwe_telling_id, product_id, aantal)
    values (v_telling_id, (v_regel ->> 'product_id')::uuid, coalesce((v_regel ->> 'aantal')::int, 0));
  end loop;

  return v_telling_id;
end;
$$;

-- teller_vooraf_referentie blijft ongewijzigd bruikbaar (werkt op reservation_id,
-- dat volstaat) — enkel opnieuw toekennen aan anon voor de duidelijkheid.
grant execute on function teller_gebouwen(text) to anon;
grant execute on function teller_telplekken(text, uuid) to anon;
grant execute on function teller_telplek_producten(text, uuid) to anon;
grant execute on function teller_vaste_voorraad(text, uuid) to anon;
grant execute on function teller_reservaties(text, uuid) to anon;
grant execute on function teller_vooraf_referentie(text, uuid) to anon;
grant execute on function submit_ruwe_telling(text, uuid, uuid, uuid, text, text, jsonb, boolean, boolean) to anon;

-- Dezelfde functies ook bruikbaar voor ingelogde medewerkers (afdelingshoofd,
-- gebouwbeheerder, administratie, systeembeheerder, of gelegenheidstellers als
-- een theatertechnieker) die af en toe zelf een telling invoeren via de app
-- zelf, zonder de aparte publieke link te moeten opzoeken.
grant execute on function teller_gebouwen(text) to authenticated;
grant execute on function teller_telplekken(text, uuid) to authenticated;
grant execute on function teller_telplek_producten(text, uuid) to authenticated;
grant execute on function teller_vaste_voorraad(text, uuid) to authenticated;
grant execute on function teller_reservaties(text, uuid) to authenticated;
grant execute on function teller_vooraf_referentie(text, uuid) to authenticated;
grant execute on function submit_ruwe_telling(text, uuid, uuid, uuid, text, text, jsonb, boolean, boolean) to authenticated;

-- teller_producten (oude, per-token-gebouw functie) en teller_gebouw zijn niet
-- meer nodig nu elk gebouw expliciet gekozen wordt; laten we ongemoeid staan
-- (ze doen geen kwaad) zodat oude links niet plots crashen, maar gebruiken ze
-- niet meer in de nieuwe app.

-- ============================================================================
-- Telplekken aanmaken voor de bestaande gebouwen, op basis van je beschrijving.
-- Vaste voorraad en productkeuzes vul je zelf in via het nieuwe beheerscherm
-- (Gebouwen > Telplekken) — hier enkel de locaties zelf, met lege inhoud.
-- ============================================================================
do $$
declare
  v_bunder uuid;
  v_4link uuid;
  v_schole uuid;
  v_ommeganck uuid;
  v_gemeentehuis uuid;
  v_torreke uuid;
  v_frigo_id uuid;
begin
  select id into v_bunder from buildings where name = 'GC De Bunder';
  select id into v_4link from buildings where name = 'JC De 4link';
  select id into v_schole from buildings where name = 'OC d''Oude Schole';
  select id into v_ommeganck from buildings where name = 'OC Den Ommeganck';
  select id into v_gemeentehuis from buildings where name = 'OC Oud Gemeentehuis';
  select id into v_torreke from buildings where name = 'OC ''t Torreke';

  if v_bunder is not null and not exists (select 1 from telplekken where building_id = v_bunder) then
    insert into telplekken (building_id, naam, volgorde, heeft_vaste_voorraad)
    values (v_bunder, 'Frigo', 1, true)
    returning id into v_frigo_id;
    insert into telplekken (building_id, naam, volgorde, vereist_telplek_id, heeft_vaste_voorraad)
    values (v_bunder, 'Koelcel', 2, v_frigo_id, false);
  end if;

  if v_4link is not null and not exists (select 1 from telplekken where building_id = v_4link) then
    insert into telplekken (building_id, naam, volgorde) values
      (v_4link, 'Frigo', 1),
      (v_4link, 'Drankenberging', 2);
  end if;

  if v_schole is not null and not exists (select 1 from telplekken where building_id = v_schole) then
    insert into telplekken (building_id, naam, volgorde) values
      (v_schole, 'Zaal Casteleyn (koelcel)', 1),
      (v_schole, 'Zaal Dessein (frigo)', 2);
  end if;

  if v_ommeganck is not null and not exists (select 1 from telplekken where building_id = v_ommeganck) then
    insert into telplekken (building_id, naam, volgorde) values
      (v_ommeganck, 'Koelcel', 1);
  end if;

  if v_gemeentehuis is not null and not exists (select 1 from telplekken where building_id = v_gemeentehuis) then
    insert into telplekken (building_id, naam, volgorde) values
      (v_gemeentehuis, 'Keuken', 1);
  end if;

  if v_torreke is not null and not exists (select 1 from telplekken where building_id = v_torreke) then
    insert into telplekken (building_id, naam, volgorde) values
      (v_torreke, 'Garage', 1),
      (v_torreke, 'De Boekerij', 2);
  end if;
end $$;

-- ============================================================================
-- AANVULLING: verplaatsingen tussen gebouwen + volgorde van producten per
-- gebouw (voor het tellen, zodat de lijst de indeling van frigo/koelcel/
-- drankenberging volgt).
-- ============================================================================

create table if not exists voorraadverplaatsingen (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  van_building_id uuid not null references buildings (id) on delete cascade,
  naar_building_id uuid not null references buildings (id) on delete cascade,
  aantal integer not null check (aantal > 0),
  datum date not null default current_date,
  reden text,
  wie text,
  created_at timestamptz not null default now()
);

alter table voorraadverplaatsingen enable row level security;
drop policy if exists "voorraadverplaatsingen_select" on voorraadverplaatsingen;
create policy "voorraadverplaatsingen_select" on voorraadverplaatsingen for select using (auth.role() = 'authenticated');
drop policy if exists "voorraadverplaatsingen_write" on voorraadverplaatsingen;
create policy "voorraadverplaatsingen_write" on voorraadverplaatsingen for all
  using (can_edit_reservations()) with check (can_edit_reservations());

-- Volgorde van een product binnen een gebouw (voor het tellen, aansluitend
-- bij de fysieke indeling van frigo/koelcel/drankenberging). Lagere waarde
-- verschijnt eerst.
alter table product_buildings add column if not exists volgorde integer not null default 0;

-- teller_telplek_producten: sorteer voortaan op de ingestelde volgorde i.p.v.
-- op categorie/naam.
create or replace function teller_telplek_producten(p_token text, p_telplek_id uuid)
returns table (id uuid, name text, categorie text, standaard boolean)
language sql stable
security definer set search_path = public
as $$
  select p.id, p.name, p.categorie, tpp.standaard
  from telplek_producten tpp
  join products p on p.id = tpp.product_id
  join telplekken tp on tp.id = tpp.telplek_id
  left join product_buildings pb on pb.product_id = p.id and pb.building_id = tp.building_id
  join teller_instellingen ti on ti.token = p_token
  where tpp.telplek_id = p_telplek_id and p.actief = true
  order by tpp.standaard desc, coalesce(pb.volgorde, 999999), p.categorie, p.name;
$$;
grant execute on function teller_telplek_producten(text, uuid) to anon;
grant execute on function teller_telplek_producten(text, uuid) to authenticated;
-- Voor medewerkers die occasioneel zelf drankverbruik registreren (eigen
-- gebruik, artiesten), zonder toegang tot reservaties, contacten of beheer.
-- ============================================================================
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('systeembeheerder', 'afdelingshoofd', 'gebouwbeheerder', 'administratie', 'theatertechnieker'));

alter table pending_roles drop constraint if exists pending_roles_role_check;
alter table pending_roles add constraint pending_roles_role_check
  check (role in ('systeembeheerder', 'afdelingshoofd', 'gebouwbeheerder', 'administratie', 'theatertechnieker'));

-- can_edit_reservations() bepaalt o.a. wie mag tellen/verwerken; theatertechniekers
-- horen daar nu ook bij (enkel eigen verbruik, verder afgedwongen in de app zelf).
create or replace function can_edit_reservations()
returns boolean
language sql stable
security definer set search_path = public
as $$
  select current_role_name() in ('systeembeheerder', 'administratie', 'gebouwbeheerder', 'theatertechnieker');
$$;
insert into telplek_producten (telplek_id, product_id, standaard)
select tp.id, pb.product_id, true
from telplekken tp
join product_buildings pb on pb.building_id = tp.building_id
join products p on p.id = pb.product_id and p.afrekenmodus = 'standaard' and p.actief = true
on conflict (telplek_id, product_id) do nothing;

-- ============================================================================
-- AANVULLING: telvolgorde per telplek (niet per gebouw). Een gebouw kan
-- meerdere telplekken hebben (Frigo, Koelcel, Drankenberging) met elk hun
-- eigen fysieke indeling — één volgorde per gebouw volstond niet.
-- ============================================================================
alter table telplek_producten add column if not exists volgorde integer not null default 0;

create or replace function teller_telplek_producten(p_token text, p_telplek_id uuid)
returns table (id uuid, name text, categorie text, standaard boolean)
language sql stable
security definer set search_path = public
as $$
  select p.id, p.name, p.categorie, tpp.standaard
  from telplek_producten tpp
  join products p on p.id = tpp.product_id
  join teller_instellingen ti on ti.token = p_token
  where tpp.telplek_id = p_telplek_id and p.actief = true
  order by tpp.standaard desc, tpp.volgorde, p.categorie, p.name;
$$;
grant execute on function teller_telplek_producten(text, uuid) to anon;
grant execute on function teller_telplek_producten(text, uuid) to authenticated;

-- ============================================================================
-- AANVULLING: uitzonderlijk aanbod per reservatie (bv. grote flessen die
-- normaal niet tot het standaardassortiment van dit gebouw behoren, maar wel
-- nodig zijn voor deze ene activiteit). Aanvinken laat het product verschijnen
-- in de telling/verbruik-tabel van enkel díe reservatie.
-- ============================================================================
create table if not exists reservation_extra_producten (
  reservation_id uuid not null references reservations (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  primary key (reservation_id, product_id)
);

alter table reservation_extra_producten enable row level security;
drop policy if exists "reservation_extra_producten_select" on reservation_extra_producten;
create policy "reservation_extra_producten_select" on reservation_extra_producten for select using (auth.role() = 'authenticated');
drop policy if exists "reservation_extra_producten_write" on reservation_extra_producten;
create policy "reservation_extra_producten_write" on reservation_extra_producten for all
  using (can_edit_reservations()) with check (can_edit_reservations());

-- ============================================================================
-- AANVULLING: bestellingen met opvolging, leveranciers, en minimum/streef-
-- voorraad per gebouw met automatisch bestelvoorstel.
-- ============================================================================

-- Minimum/streefvoorraad per product per gebouw (voor het alarm op de
-- Voorraad-pagina). Per gebouw instelbaar — vul hetzelfde getal in bij
-- meerdere gebouwen als je daar gelijke voorraad wil.
alter table product_buildings add column if not exists minimum_voorraad integer;
alter table product_buildings add column if not exists streef_voorraad integer;

create table if not exists leveranciers (
  id uuid primary key default gen_random_uuid(),
  naam text not null,
  email text,
  telefoon text,
  actief boolean not null default true
);
alter table leveranciers enable row level security;
drop policy if exists "leveranciers_select" on leveranciers;
create policy "leveranciers_select" on leveranciers for select using (auth.role() = 'authenticated');
drop policy if exists "leveranciers_write" on leveranciers;
create policy "leveranciers_write" on leveranciers for all
  using (can_edit_masterdata()) with check (can_edit_masterdata());

create table if not exists bestellingen (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings (id) on delete cascade,
  leverancier_id uuid references leveranciers (id) on delete set null,
  status text not null default 'concept' check (status in ('concept', 'verstuurd', 'deels_geleverd', 'geleverd', 'geannuleerd')),
  notitie text,
  aangemaakt_door text,
  created_at timestamptz not null default now(),
  verstuurd_op timestamptz
);
alter table bestellingen enable row level security;
drop policy if exists "bestellingen_select" on bestellingen;
create policy "bestellingen_select" on bestellingen for select using (auth.role() = 'authenticated');
drop policy if exists "bestellingen_write" on bestellingen;
create policy "bestellingen_write" on bestellingen for all
  using (can_edit_reservations()) with check (can_edit_reservations());

-- geleverd_aantal is cumulatief: bij een deellevering wordt dit opgehoogd,
-- niet overschreven, zodat nageleverde bakken later gewoon verder aangevuld
-- kunnen worden tot het bestelde aantal bereikt is.
create table if not exists bestelling_regels (
  bestelling_id uuid not null references bestellingen (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  besteld_aantal integer not null default 0,
  geleverd_aantal integer not null default 0,
  primary key (bestelling_id, product_id)
);
alter table bestelling_regels enable row level security;
drop policy if exists "bestelling_regels_select" on bestelling_regels;
create policy "bestelling_regels_select" on bestelling_regels for select using (auth.role() = 'authenticated');
drop policy if exists "bestelling_regels_write" on bestelling_regels;
create policy "bestelling_regels_write" on bestelling_regels for all
  using (can_edit_reservations()) with check (can_edit_reservations());

-- ============================================================================
-- AANVULLING: tijdelijke externe toegangscode per reservatie. Een gast (bv.
-- de verantwoordelijke van een activiteit in eigen beheer) kan hiermee, zonder
-- account, het verbruik van hun eigen activiteit registreren. Hergebruikt de
-- bestaande ruwe_tellingen-wachtrij: telt pas mee na goedkeuring, exact zoals
-- bij het poetspersoneel.
-- ============================================================================
create table if not exists reservation_toegangscodes (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations (id) on delete cascade,
  code text not null unique,
  geldig_vanaf timestamptz not null default now(),
  geldig_tot timestamptz not null,
  verstuur_email text,
  verstuur_op timestamptz,
  verstuurd boolean not null default false,
  created_at timestamptz not null default now()
);
alter table reservation_toegangscodes enable row level security;
drop policy if exists "reservation_toegangscodes_select" on reservation_toegangscodes;
create policy "reservation_toegangscodes_select" on reservation_toegangscodes for select using (auth.role() = 'authenticated');
drop policy if exists "reservation_toegangscodes_write" on reservation_toegangscodes;
create policy "reservation_toegangscodes_write" on reservation_toegangscodes for all
  using (can_edit_reservations()) with check (can_edit_reservations());

create or replace function gast_context(p_code text)
returns table (reservation_id uuid, building_id uuid, huurder text, activiteit text, gebouw_naam text)
language sql stable
security definer set search_path = public
as $$
  select r.id, r.building_id, r.huurder, r.activiteit, b.name
  from reservation_toegangscodes t
  join reservations r on r.id = t.reservation_id
  join buildings b on b.id = r.building_id
  where t.code = p_code and now() between t.geldig_vanaf and t.geldig_tot;
$$;
grant execute on function gast_context(text) to anon;

create or replace function gast_producten(p_code text)
returns table (id uuid, name text, categorie text)
language sql stable
security definer set search_path = public
as $$
  select p.id, p.name, p.categorie
  from reservation_toegangscodes t
  join reservations r on r.id = t.reservation_id
  join product_buildings pb on pb.building_id = r.building_id
  join products p on p.id = pb.product_id
  where t.code = p_code
    and now() between t.geldig_vanaf and t.geldig_tot
    and p.actief = true and p.afrekenmodus = 'standaard'
  order by p.categorie, p.name;
$$;
grant execute on function gast_producten(text) to anon;

create or replace function submit_gast_telling(p_code text, p_naam text, p_regels jsonb)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_reservation_id uuid;
  v_building_id uuid;
  v_telling_id uuid;
  v_regel jsonb;
begin
  select r.id, r.building_id into v_reservation_id, v_building_id
  from reservation_toegangscodes t
  join reservations r on r.id = t.reservation_id
  where t.code = p_code and now() between t.geldig_vanaf and t.geldig_tot;

  if v_reservation_id is null then
    raise exception 'Ongeldige of verlopen code.';
  end if;

  insert into ruwe_tellingen (building_id, reservation_id, type, ingevoerd_door)
  values (v_building_id, v_reservation_id, 'nadien', nullif(trim(p_naam), ''))
  returning id into v_telling_id;

  for v_regel in select * from jsonb_array_elements(p_regels)
  loop
    insert into ruwe_telling_regels (ruwe_telling_id, product_id, aantal)
    values (v_telling_id, (v_regel ->> 'product_id')::uuid, coalesce((v_regel ->> 'aantal')::int, 0));
  end loop;

  return v_telling_id;
end;
$$;
grant execute on function submit_gast_telling(text, text, jsonb) to anon;

-- ============================================================================
-- AANVULLING: pincode ter bevestiging van gevoelige acties (niet als login,
-- enkel als extra check vlak vóór iets onomkeerbaars — verwijderen, goedkeuren).
-- Hergebruikt de bestaande policy "profiles_update_own_name" (elke gebruiker
-- mag al zijn eigen rij aanpassen), dus geen nieuwe RLS-regel nodig.
-- ============================================================================
alter table profiles add column if not exists pincode_hash text;
alter table profiles add column if not exists pincode_salt text;
