-- ALLERGEN-1 — allergenen en dieetlabels per product.
--
-- EU-verordening 1169/2011: wie voeding op afstand verkoopt, moet de allergeneninformatie
-- vóór de aankoop beschikbaar stellen. Codes in plaats van vrije tekst, zodat de webshop,
-- de menukaart en de kassa ze in elke taal kunnen tonen.
-- Strikt additief: lege arrays als default, bestaande queries en custom frontends merken niets.

alter table public.products
  add column if not exists allergens text[] not null default '{}',
  add column if not exists dietary text[] not null default '{}';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'products_allergens_valid') then
    alter table public.products add constraint products_allergens_valid check (
      allergens <@ array['gluten','crustaceans','eggs','fish','peanuts','soy','milk','nuts','celery','mustard','sesame','sulphites','lupin','molluscs']::text[]
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_dietary_valid') then
    alter table public.products add constraint products_dietary_valid check (
      dietary <@ array['vegetarian','vegan','spicy','halal','gluten_free']::text[]
    );
  end if;
end $$;

comment on column public.products.allergens is 'ALLERGEN-1: de 14 EU-allergenen (codes) die dit product bevat.';
comment on column public.products.dietary is 'ALLERGEN-1: dieetlabels (vegetarian, vegan, spicy, halal, gluten_free).';
