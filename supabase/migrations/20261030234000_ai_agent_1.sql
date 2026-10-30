-- AI-AGENT-1 (30-10-2026) — feature-sleutel ai_actions: de hulpassistent zet acties klaar
-- (voorraad, prijs, uitverkocht), de gebruiker bevestigt, 1 AI-credit per uitgevoerde actie.
-- Beslissing Akke: alle betaalde plannen. Free en Events Flex (geen maandprijs, geen
-- AI-credits) krijgen hem niet. Vaste lijst plan-id's, geen afgeleide voorwaarde: een re-run
-- geeft hetzelfde resultaat, ook als er later plannen bijkomen.
-- Idempotent: jsonb || zet de sleutel op true, opnieuw draaien verandert niets.
-- Handmatig terugdraaien: update public.pricing_plans set features = features - 'ai_actions';
update public.pricing_plans
   set features = coalesce(features, '{}'::jsonb) || jsonb_build_object('ai_actions', true),
       updated_at = now()
 where id in ('starter', 'pro', 'enterprise', 'horeca', 'horeca_big', 'events_vast')
   and coalesce((features ->> 'ai_actions')::boolean, false) is distinct from true;
