-- Herstel van de oorspronkelijke telwijze:
-- eerst losse flesjes/flessen in de frigo, daarna volle bakken en losse
-- flesjes in de koelcel/drankberging. De detailwaarden blijven apart bewaard.

set search_path = beheerportaal, public, extensions;

alter table beheerportaal.ruwe_telling_regels
  add column if not exists frigo integer,
  add column if not exists bakken integer,
  add column if not exists los integer;

alter table beheerportaal.voorraad_controletellingen
  add column if not exists frigo integer,
  add column if not exists bakken integer,
  add column if not exists los integer;

-- Bestaande drankstamdata vermeldt of een product per bak wordt geteld.
-- De oude standaardbak bevat 24 flesjes; products die al een specifiekere
-- verpakkingsgrootte hadden, behouden die waarde.
update beheerportaal.products p
set verpakking = case when d.telbaar_als_bak then greatest(p.verpakking, 24) else 1 end
from public.dranken d
where p.id = d.id;

-- Ieder gebouw krijgt de twee opeenvolgende telstappen als ze nog ontbreken.
insert into beheerportaal.telplekken (building_id, naam, volgorde, heeft_vaste_voorraad, actief)
select b.id, 'Frigo', 1, false, true
from beheerportaal.buildings b
where b.actief = true
  and not exists (
    select 1 from beheerportaal.telplekken t
    where t.building_id = b.id and lower(t.naam) like '%frigo%'
  );

insert into beheerportaal.telplekken (building_id, naam, volgorde, heeft_vaste_voorraad, actief)
select b.id, 'Koelcel/drankberging', 2, false, true
from beheerportaal.buildings b
where b.actief = true
  and not exists (
    select 1 from beheerportaal.telplekken t
    where t.building_id = b.id
      and (lower(t.naam) like '%koelcel%' or lower(t.naam) like '%berging%')
  );

update beheerportaal.telplekken set heeft_vaste_voorraad = false;

insert into beheerportaal.telplek_producten (telplek_id, product_id, standaard, volgorde)
select
  t.id,
  p.id,
  true,
  row_number() over (partition by t.id order by p.categorie, p.name)::integer
from beheerportaal.telplekken t
cross join beheerportaal.products p
where t.actief = true and p.actief = true
on conflict (telplek_id, product_id) do update set
  standaard = true,
  volgorde = excluded.volgorde;

drop function if exists beheerportaal.teller_telplek_producten(text, uuid);
create function beheerportaal.teller_telplek_producten(p_token text, p_telplek_id uuid)
returns table (id uuid, name text, categorie text, standaard boolean, verpakking integer)
language sql stable
security definer set search_path = beheerportaal, public, extensions
as $$
  select p.id, p.name, p.categorie, tpp.standaard, p.verpakking
  from telplek_producten tpp
  join products p on p.id = tpp.product_id
  join teller_instellingen ti on ti.token = p_token
  where tpp.telplek_id = p_telplek_id and p.actief = true
  order by tpp.standaard desc, tpp.volgorde, p.categorie, p.name;
$$;

grant execute on function beheerportaal.teller_telplek_producten(text, uuid) to anon, authenticated;

drop function if exists beheerportaal.submit_ruwe_telling(text, uuid, uuid, uuid, text, text, jsonb, boolean, boolean);
create function beheerportaal.submit_ruwe_telling(
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
security definer set search_path = beheerportaal, public, extensions
as $$
declare
  v_telling_id uuid;
  v_regel jsonb;
begin
  if not exists (select 1 from teller_instellingen where token = p_token) then
    raise exception 'Ongeldige of verlopen link.';
  end if;
  if p_type not in ('vooraf', 'nadien', 'controle') then
    raise exception 'Ongeldig type telling.';
  end if;
  if p_type in ('vooraf', 'nadien') and p_reservation_id is null then
    raise exception 'Kies een reservatie voor vooraf/nadien.';
  end if;

  insert into ruwe_tellingen
    (building_id, reservation_id, type, ingevoerd_door, afwijking_bevestigd, telplek_id, vaste_voorraad_bevestigd)
  values
    (p_building_id, p_reservation_id, p_type, nullif(trim(p_ingevoerd_door), ''), p_afwijking_bevestigd, p_telplek_id, p_vaste_voorraad_bevestigd)
  returning id into v_telling_id;

  for v_regel in select * from jsonb_array_elements(p_regels)
  loop
    insert into ruwe_telling_regels
      (ruwe_telling_id, product_id, aantal, frigo, bakken, los)
    values (
      v_telling_id,
      (v_regel ->> 'product_id')::uuid,
      coalesce((v_regel ->> 'aantal')::integer, 0),
      coalesce((v_regel ->> 'frigo')::integer, 0),
      coalesce((v_regel ->> 'bakken')::integer, 0),
      coalesce((v_regel ->> 'los')::integer, 0)
    );
  end loop;

  return v_telling_id;
end;
$$;

grant execute on function beheerportaal.submit_ruwe_telling(text, uuid, uuid, uuid, text, text, jsonb, boolean, boolean)
  to anon, authenticated;

notify pgrst, 'reload schema';
