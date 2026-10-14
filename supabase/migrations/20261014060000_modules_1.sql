-- MODULES-1 — sectormodules per winkel (horeca, events) + een Horeca-plan (nog niet actief).
--
-- SellQo is één kern (producten, bestellingen, kassa, webshop) met sectormodules erbovenop.
-- Een winkel kiest zelf welke modules hij gebruikt (onboarding of Instellingen); wie een
-- module niet heeft, ziet er niets van. De betaalde waarde zit in webshop en kassa (plan),
-- niet in de module zelf.
-- Strikt additief: nieuwe kolom met lege default, nieuw plan staat op active = false.

alter table public.tenants
  add column if not exists business_modules text[] not null default '{}';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tenants_business_modules_valid') then
    alter table public.tenants add constraint tenants_business_modules_valid
      check (business_modules <@ array['horeca','events']::text[]);
  end if;
end $$;

comment on column public.tenants.business_modules is
  'MODULES-1: sectormodules die deze winkel gebruikt (horeca, events). Bepaalt welke schermen de admin toont.';

-- Bestaande gebruikers behouden wat ze hebben: Fonske verkoopt tickets, de demopizzeria is horeca.
update public.tenants set business_modules = array['events']
  where id = '95f6685b-3474-42fe-81ad-a5e6ca3d6806' and not ('events' = any(business_modules));
update public.tenants set business_modules = array['horeca']
  where id = '7879b472-2672-4212-8531-4c587870752d' and not ('horeca' = any(business_modules));

-- Horeca-plan: webshop + kassa + horeca, zonder marktplaatsen/Odoo/magazijnen.
-- Staat uit (active = false) tot de prijs vastligt en de Stripe-prijzen bestaan.
insert into public.pricing_plans (id, name, slug, monthly_price, yearly_price, limit_products, limit_orders,
  limit_customers, limit_users, limit_storage_gb, limit_api_calls, features, highlighted, sort_order, active,
  ai_credits_monthly, included_transactions_monthly, transaction_overage_fee)
select 'horeca', 'Horeca', 'horeca', 49, 490, 500, 10000, 10000, 5, 10, 10000,
  s.features || jsonb_build_object('pos', true, 'visual_editor', true, 'promo_giftcards', true, 'horeca', true),
  false, 3, false, 50, 100000, 0
from public.pricing_plans s where s.id = 'starter'
on conflict (id) do nothing;
