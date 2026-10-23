-- LIVE-1 — startzaalplan voor de eerste horecaklant, nagetekend uit de Lightspeed-foto
-- (ontwerp §4 "Snelstart": Blauw 1–5, Salon, Club, Rond, B1–B9, Ter-1–3, Barman, Afhalen).
-- NIET live gedraaid. Draaien na de go, als de zaak als tenant bestaat:
--   psql … -v tenant=<tenant-uuid> -f docs/sql/live-1-zaalplan-eerste-horecaklant.sql
-- of in query_database met de uuid ingevuld op de plaats van :'tenant'.
--
-- Idempotent: een ruimte met dezelfde naam wordt overgeslagen (niets overschreven); de klant
-- schuift daarna zelf alles op zijn plaats in Bestellen › Zaalplan.
-- "Barman" en "Afhalen" zijn in Lightspeed vaste tabbladen; in SellQo zijn dat rekeningen
-- op naam ("+ Op naam"), geen tafels: niets aan te maken.
-- Posities in rastereenheden (40 × 24 per ruimte), maten zoals de sjablonen van ZAAL-H1.

\set ON_ERROR_STOP 1
begin;

with a as (
  insert into public.dining_areas (tenant_id, name, sort, grid_w, grid_h)
  select :'tenant'::uuid, v.name, v.sort, 40, 24
  from (values ('Binnen', 1), ('Bar', 2), ('Terras', 3)) v(name, sort)
  where not exists (select 1 from public.dining_areas x where x.tenant_id = :'tenant'::uuid and x.name = v.name and x.is_active)
  returning id, name
)
insert into public.dining_tables (tenant_id, area_id, label, kind, shape, seats, x, y, w, h)
select :'tenant'::uuid, a.id, t.label, t.kind, t.shape, t.seats, t.x, t.y, t.w, t.h
from a join (values
  -- Binnen: blauwe zone (5 vierkante tafels op een rij), salon, club, ronde tafel
  ('Binnen', 'Blauw 1', 'table', 'square', 4,  2,  2, 3, 3),
  ('Binnen', 'Blauw 2', 'table', 'square', 4,  7,  2, 3, 3),
  ('Binnen', 'Blauw 3', 'table', 'square', 4, 12,  2, 3, 3),
  ('Binnen', 'Blauw 4', 'table', 'square', 4, 17,  2, 3, 3),
  ('Binnen', 'Blauw 5', 'table', 'square', 4, 22,  2, 3, 3),
  ('Binnen', 'Salon',   'table', 'rect',   6,  2, 10, 6, 4),
  ('Binnen', 'Club',    'table', 'rect',   6, 11, 10, 6, 4),
  ('Binnen', 'Rond',    'table', 'round',  6, 21, 10, 4, 4),
  -- Bar: rij van 9 krukken (sjabloon "rij barkrukken")
  ('Bar', 'B1', 'bar_seat', 'round', 1,  2, 6, 2, 2),
  ('Bar', 'B2', 'bar_seat', 'round', 1,  5, 6, 2, 2),
  ('Bar', 'B3', 'bar_seat', 'round', 1,  8, 6, 2, 2),
  ('Bar', 'B4', 'bar_seat', 'round', 1, 11, 6, 2, 2),
  ('Bar', 'B5', 'bar_seat', 'round', 1, 14, 6, 2, 2),
  ('Bar', 'B6', 'bar_seat', 'round', 1, 17, 6, 2, 2),
  ('Bar', 'B7', 'bar_seat', 'round', 1, 20, 6, 2, 2),
  ('Bar', 'B8', 'bar_seat', 'round', 1, 23, 6, 2, 2),
  ('Bar', 'B9', 'bar_seat', 'round', 1, 26, 6, 2, 2),
  -- Terras
  ('Terras', 'Ter-1', 'table', 'square', 4,  2, 2, 3, 3),
  ('Terras', 'Ter-2', 'table', 'square', 4,  7, 2, 3, 3),
  ('Terras', 'Ter-3', 'table', 'square', 4, 12, 2, 3, 3)
) t(area, label, kind, shape, seats, x, y, w, h) on t.area = a.name;

-- De toog als decor in de ruimte Bar (enkel als die ruimte net aangemaakt werd: zonder tafels nog geen decor).
insert into public.floor_markers (tenant_id, area_id, kind, label, x, y, w, h)
select :'tenant'::uuid, a.id, 'bar', 'Toog', 1, 3, 29, 2
from public.dining_areas a
where a.tenant_id = :'tenant'::uuid and a.name = 'Bar' and a.is_active
  and not exists (select 1 from public.floor_markers m where m.area_id = a.id);

-- Natrek: 3 ruimtes, 20 tafels.
select a.name, count(t.id) as tafels from public.dining_areas a left join public.dining_tables t on t.area_id = a.id and t.is_active
where a.tenant_id = :'tenant'::uuid and a.is_active group by a.name, a.sort order by a.sort;

commit;
