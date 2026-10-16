-- SEC-NIGHT-3 — 16 oktober 2026
-- tenant_ai_credits had een UPDATE-policy "Users can update their tenant AI credits"
-- (roles public, qual tenant_id IN get_user_tenant_ids(auth.uid()), geen with_check) plus
-- volledige tabelgrants voor anon/authenticated. Elke gebruiker van een winkel kon via de
-- REST-API zijn eigen credits_total/credits_purchased ophogen (rollbacktest: 1 rij geraakt).
-- AI-credits worden verkocht.
--
-- Alle legitieme schrijvers zijn SECURITY DEFINER-functies (use_ai_credits, add_ai_credits,
-- admin_adjust_ai_credits, reset_monthly_ai_credits, use_ai_help_credit,
-- initialize_tenant_ai_credits) of edge functions met service_role. De app leest alleen
-- (useAICredits, usePlatformAdmin: .select()).
--
-- Fix: policy weg, schrijfrechten weg voor anon/authenticated. SELECT blijft.
-- Idempotent. Terugdraaien:
--   create policy "Users can update their tenant AI credits" on public.tenant_ai_credits
--     for update using (tenant_id in (select get_user_tenant_ids(auth.uid())));
--   grant insert, update, delete, truncate on public.tenant_ai_credits to anon, authenticated;

drop policy if exists "Users can update their tenant AI credits" on public.tenant_ai_credits;
revoke insert, update, delete, truncate on public.tenant_ai_credits from anon, authenticated;
