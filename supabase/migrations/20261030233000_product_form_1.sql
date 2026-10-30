-- PRODUCT-FORM-1 (30-10-2026) — "Voeding of drank" per product.
-- Het productformulier toont allergenen/dieetlabels enkel bij voeding, en extra's, kanalen,
-- keukenstation en btw bij meenemen enkel bij horeca + voeding. Daarvoor een vlag per product.
--
-- Additief: nieuwe kolom met default false. products zit niet in de gedeelde
-- storefront-tabellen van de eerste wet; storefront-api selecteert er vaste kolommen uit
-- (geen select('*')), dus custom frontends zien niets veranderen.
--
-- Grandfather: enkel bij het aanmaken van de kolom (idempotent: een tweede run doet niets en
-- zet dus nooit een schakelaar terug die een winkel intussen zelf uitzette). Vaste tijdsgrens,
-- nooit now(). Aan voor fysieke producten en bundels die al horecagegevens hebben (allergenen,
-- dieet, btw bij meenemen, extra's), of van een winkel met de horeca-module (add-on of plan).
--
-- Handmatig terugdraaien: alter table public.products drop column if exists is_food;
-- (de UI valt dan terug op "geen voeding": allergenen verdwijnen uit het formulier, de data blijft).
do $pf$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'products' and column_name = 'is_food'
  ) then
    raise notice 'PRODUCT-FORM-1: is_food bestaat al, overslaan';
    return;
  end if;

  alter table public.products add column is_food boolean not null default false;
  comment on column public.products.is_food is
    'PRODUCT-FORM-1: voeding of drank. Toont allergenen/dieet en (met horeca) extra''s, kanalen, keukenstation.';

  update public.products p
     set is_food = true
   where p.created_at <= timestamptz '2026-10-30 21:30:00+01'
     and p.product_type in ('physical', 'bundle')
     and (
          cardinality(coalesce(p.allergens, '{}')) > 0
       or cardinality(coalesce(p.dietary, '{}')) > 0
       or p.takeaway_vat_rate_id is not null
       or exists (select 1 from public.product_addon_groups g where p.id = any(g.product_ids))
       or exists (select 1 from public.tenants t
                   where t.id = p.tenant_id and 'horeca' = any(coalesce(t.business_modules, '{}')))
       or exists (select 1 from public.tenant_subscriptions s
                    join public.pricing_plans pp on pp.id = s.plan_id
                   where s.tenant_id = p.tenant_id and pp.track = 'horeca')
     );
end
$pf$;
