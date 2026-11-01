-- ALLERGEEN-VERKLAARD-1 — "niet ingevuld" onderscheiden van "bevat geen van de 14 allergenen".
--
-- products.allergens is text[] not null default '{}': een lege lijst betekent vandaag zowel "de zaak
-- vulde niets in" als "dit gerecht bevat niets". Voor EU 1169/2011 (verkoop op afstand) is dat
-- verschil wezenlijk. Nieuw:
--   * products.allergens_declared boolean not null default false — de zaak heeft de allergenen van
--     dit product bewust vastgelegd (ook als dat "geen" is).
--   * backfill: true voor producten die nu al minstens één allergeen hebben (wie iets aanvinkte, vulde
--     het in). Vaste tijdsgrens zodat een herhaling reproduceerbaar is en geen latere rijen raakt.
--   * trigger products_allergens_declared (BEFORE INSERT/UPDATE OF allergens): zodra er minstens één
--     allergeen staat, is het product verklaard — ongeacht welk pad schrijft (productformulier, Kaart,
--     kaart-RPC's, import, AI-assistent). Een lege lijst laat de waarde die de schrijver meegeeft staan
--     (het vinkje "Bevat geen van de 14 allergenen" in de admin zet expliciet true, uitvinken false).
--
-- Strikt additief. Gevolgen:
--   * storefront-api leest de kolom en geeft enkel `allergens_declared: true` mee als hij true is.
--     DEPLOY storefront-api PAS NA deze migratie (get_products selecteert de kolom expliciet in een
--     aparte, foutbestendige query; get_product gebruikt select('*')).
--   * de backfill zet updated_at van ±67 producten (live 01-11-2026) op het moment van de migratie
--     (trigger products_updated_at); enkel de sitemap-lastmod gebruikt dat veld.
--   * geen andere triggers op products reageren op deze kolommen (live nagetrokken 01-11-2026).
--
-- Handmatig terugdraaien:
--   drop trigger if exists products_allergens_declared on public.products;
--   drop function if exists public.products_allergens_declared_tr();
--   alter table public.products drop column if exists allergens_declared;

alter table public.products add column if not exists allergens_declared boolean not null default false;
comment on column public.products.allergens_declared is
  'ALLERGEEN-VERKLAARD-1: de zaak legde de allergenen bewust vast (ook "geen"). Lege allergens + false = niet ingevuld.';

update public.products p
   set allergens_declared = true
 where p.allergens_declared = false
   and cardinality(coalesce(p.allergens, '{}')) > 0
   and p.created_at <= timestamptz '2026-11-02 00:00:00+01';

create or replace function public.products_allergens_declared_tr()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if cardinality(coalesce(new.allergens, '{}')) > 0 then
    new.allergens_declared := true;
  end if;
  return new;
end;
$$;
revoke all on function public.products_allergens_declared_tr() from public, anon, authenticated;

drop trigger if exists products_allergens_declared on public.products;
create trigger products_allergens_declared before insert or update of allergens, allergens_declared on public.products
  for each row execute function public.products_allergens_declared_tr();
