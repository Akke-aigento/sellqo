-- SOCIAL-GATE-1 — Social (planning, resultaten, kanalen, "Post met AI") enkel voor winkels die
-- een platformadmin ontgrendelt: granted_features bevat 'social_planner' (geen plan bevat die key;
-- frontend: useSocialAccess + featureKey in de sidebar). Reden (Akke, 19-10): koppelen met
-- Instagram vraagt Meta-testerrollen zolang de Meta-app in Development mode staat; nog niet op de
-- markt. Deze migratie ontgrendelt het voor de vijf eigen merken.
--
-- Additief en idempotent: een ontbrekende overrides-rij wordt aangemaakt (alle module_*-kolommen
-- blijven NULL = plan bepaalt), een bestaande rij krijgt de key er enkel bij als hij er nog niet staat.
-- Terugdraaien: update public.tenant_feature_overrides
--   set granted_features = array_remove(granted_features, 'social_planner')
--   where tenant_id in (<de vijf hieronder>);

insert into public.tenant_feature_overrides (tenant_id, granted_features)
select v.id, array['social_planner']
from (values
  ('1671a91c-31fe-42ed-8a10-41f3117ceb50'::uuid), -- Loveke
  ('54f6b480-280b-42e1-b843-d5beb2831acd'::uuid), -- VanXcel
  ('95f6685b-3474-42fe-81ad-a5e6ca3d6806'::uuid), -- The Fonske Crawl
  ('c96fb1b2-ddac-44d1-a638-72dd54efd31e'::uuid), -- Studio Akke
  ('d03c63fe-48c6-4ff7-a30b-7506ea3e71ab'::uuid)  -- SellQo
) v(id)
where exists (select 1 from public.tenants t where t.id = v.id)
on conflict (tenant_id) do update
  set granted_features = case
        when 'social_planner' = any(coalesce(tenant_feature_overrides.granted_features, '{}'))
          then tenant_feature_overrides.granted_features
        else array_append(coalesce(tenant_feature_overrides.granted_features, '{}'), 'social_planner')
      end,
      updated_at = now();
