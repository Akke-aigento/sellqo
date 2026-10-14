-- ALLERGEN-2 — allergenen per extra (bv. ansjovis = vis, burrata = melk).
-- Zelfde 14 EU-codes als products.allergens. Additief, lege default.
alter table public.product_addon_options
  add column if not exists allergens text[] not null default '{}';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'product_addon_options_allergens_valid') then
    alter table public.product_addon_options add constraint product_addon_options_allergens_valid check (
      allergens <@ array['gluten','crustaceans','eggs','fish','peanuts','soy','milk','nuts','celery','mustard','sesame','sulphites','lupin','molluscs']::text[]
    );
  end if;
end $$;
