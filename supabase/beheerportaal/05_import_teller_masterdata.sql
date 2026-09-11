-- Beheerportaal: bestaande gebouwen, telzones en dranken beschikbaar maken
-- in het herstelde telformulier. Deze migratie is idempotent en verwijdert niets.

set search_path = beheerportaal, public, extensions;

insert into beheerportaal.buildings (id, name, actief, created_at)
select
  g.id,
  g.naam,
  true,
  coalesce(g.aangemaakt_op, now())
from public.gebouwen g
on conflict (id) do update set
  name = excluded.name,
  actief = true;

insert into beheerportaal.products
  (id, name, prijs, categorie, verpakking, actief, afrekenmodus, created_at)
select
  d.id,
  d.naam,
  coalesce((
    select dp.prijs_per_fles
    from public.drank_prijzen dp
    where dp.drank_id = d.id
    order by dp.geldig_vanaf desc
    limit 1
  ), 0),
  'Dranken',
  1,
  true,
  'standaard',
  now()
from public.dranken d
on conflict (id) do update set
  name = excluded.name,
  prijs = excluded.prijs,
  actief = true;

insert into beheerportaal.telplekken
  (id, building_id, naam, volgorde, heeft_vaste_voorraad, actief, created_at)
select
  z.id,
  vl.gebouw_id,
  z.naam,
  z.volgorde,
  false,
  true,
  coalesce(z.aangemaakt_op, now())
from public.telzones z
join public.voorraadlocaties vl on vl.id = z.voorraadlocatie_id
on conflict (id) do update set
  building_id = excluded.building_id,
  naam = excluded.naam,
  volgorde = excluded.volgorde,
  actief = true;

-- Toon de volledige oude productlijst op iedere telplek. Dat houdt ook de
-- categorieën en toeslagen uit het oorspronkelijke formulier beschikbaar.
insert into beheerportaal.telplek_producten
  (telplek_id, product_id, standaard, volgorde)
select
  tp.id,
  p.id,
  true,
  row_number() over (
    partition by tp.id
    order by p.categorie, p.name
  )::integer
from beheerportaal.telplekken tp
cross join beheerportaal.products p
where tp.actief = true
  and p.actief = true
on conflict (telplek_id, product_id) do update set
  standaard = excluded.standaard,
  volgorde = excluded.volgorde;

notify pgrst, 'reload schema';
