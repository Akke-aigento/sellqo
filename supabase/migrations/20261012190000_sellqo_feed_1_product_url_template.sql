-- SELLQO-FEED-1 — productlink per winkel voor de productfeed (Google Shopping, Meta, Pinterest).
-- Additief: één nieuwe, nullable kolom op tenants (geen gedeelde storefront-tabel, stroomt niet
-- door naar storefront-api). Custom frontends hebben elk hun eigen productpad; zonder template
-- weigert generate-product-feed hun feed (422) i.p.v. verkeerde links te leveren.
-- Data: enkel de eigen custom-frontend-tenants waarvan het productpad in hun repo nagekeken is,
-- en enkel waar nog niets staat (idempotent, overschrijft niets).
-- Terugdraaien: alter table public.tenants drop column if exists product_url_template;
alter table public.tenants add column if not exists product_url_template text;

comment on column public.tenants.product_url_template is
  'Productlink voor feeds, met {slug} als plaatshouder (bv. https://loveke.be/shop/{slug}). Leeg = SellQo-theme-link; verplicht voor custom frontends.';

update public.tenants t set product_url_template = v.tpl
  from (values
    ('1671a91c-31fe-42ed-8a10-41f3117ceb50'::uuid, 'https://loveke.be/shop/{slug}'),
    ('54f6b480-280b-42e1-b843-d5beb2831acd'::uuid, 'https://vanxcel.com/shop/{slug}'),
    ('2606c5b9-caf8-4a42-94cd-80e3f3f31988'::uuid, 'https://mancinimilano.com/streetwear/products/{slug}'),
    ('6dc06df8-d871-4424-a3a4-22fc446ea64a'::uuid, 'https://bennyrich.com/product/{slug}')
  ) as v(id, tpl)
 where t.id = v.id and t.product_url_template is null;
