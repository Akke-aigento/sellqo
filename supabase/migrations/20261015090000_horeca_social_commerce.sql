-- BLOG-FIX-1 (15 okt 2026): het Horeca-plan krijgt social_commerce.
-- Reden: de Menukaart (merk-DNA + dagmenu, MENU-1) mikt op horecazaken maar zat
-- achter social_commerce, dat enkel in Pro en Enterprise aan stond.
-- Gevolg: Horeca ziet nu ook SellQo Connect — Social Commerce en de Social-hub in
-- Instellingen. Beeld/menu blijven betaald met de 50 AI-credits van het plan.
-- Idempotent. Terugdraaien:
--   update public.pricing_plans set features = features || '{"social_commerce": false}'::jsonb where id = 'horeca';
update public.pricing_plans
set features = features || '{"social_commerce": true}'::jsonb
where id = 'horeca'
  and coalesce((features->>'social_commerce')::boolean, false) is distinct from true;
