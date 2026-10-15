-- DISCOUNT-LIMIT-1 (15-10-2026) — backfill discount_code_usage uit bestaande orders.
-- Draai NA 20261015100000_discount_limit_1_usage_trigger.sql (die maakt de unieke index).
--
-- Vaste grens: orders aangemaakt vóór 2026-10-15 10:00 UTC. Orders daarna regelt de
-- trigger. Een order uit het gat tussen die grens en het moment dat de trigger live kwam,
-- vind je met de natrek-query onderaan.
--
-- Idempotent: ON CONFLICT (discount_code_id, order_id) DO NOTHING.
-- Past usage_count NIET aan: oude orders telden al (of juist niet) via het oude
-- increment_discount_usage. Afwijkingen staan in het rapport; de correctie-query staat
-- onderaan, uitgecommentarieerd, en draait alleen na een expliciete go.
--
-- Live op 15-10-2026: 0 rijen te verwachten (alle 4 orders met een code zijn geannuleerd).
--
-- Terugdraaien (handmatig): verwijder de rijen die deze backfill maakte, herkenbaar aan
-- created_at = de vaste stempel hieronder:
--   DELETE FROM public.discount_code_usage WHERE created_at = '2026-10-15 10:00:00+00';

INSERT INTO public.discount_code_usage (discount_code_id, order_id, customer_email, discount_amount, created_at)
SELECT DISTINCT ON (dc.id, o.id)
  dc.id,
  o.id,
  lower(btrim(COALESCE(o.customer_email, ''))),
  CASE WHEN x.ord = 1 THEN COALESCE(o.discount_amount, 0) ELSE 0 END,
  '2026-10-15 10:00:00+00'::timestamptz
FROM public.orders o
CROSS JOIN LATERAL unnest(string_to_array(o.discount_code, ',')) WITH ORDINALITY AS x(code, ord)
JOIN public.discount_codes dc
  ON dc.tenant_id = o.tenant_id AND upper(dc.code) = upper(btrim(x.code))
WHERE o.created_at < '2026-10-15 10:00:00+00'
  AND NULLIF(btrim(COALESCE(o.discount_code, '')), '') IS NOT NULL
  AND o.payment_status::text IN ('paid', 'partially_refunded')
  AND COALESCE(o.status::text, '') <> 'cancelled'
ORDER BY dc.id, o.id, x.ord
ON CONFLICT (discount_code_id, order_id) DO NOTHING;

-- ── Natrek (read-only), na de migratie ───────────────────────────────────────
-- Tellende orders met een code zonder usage-rij (hoort 0 te zijn):
--   SELECT o.id, o.order_number, o.discount_code, o.created_at
--   FROM orders o
--   CROSS JOIN LATERAL unnest(string_to_array(o.discount_code, ',')) AS c(code)
--   JOIN discount_codes dc ON dc.tenant_id = o.tenant_id AND upper(dc.code) = upper(btrim(c.code))
--   WHERE o.payment_status::text IN ('paid','partially_refunded') AND COALESCE(o.status::text,'') <> 'cancelled'
--     AND NOT EXISTS (SELECT 1 FROM discount_code_usage u WHERE u.discount_code_id = dc.id AND u.order_id = o.id);
--
-- usage_count tegenover vastgelegd gebruik:
--   SELECT dc.tenant_id, dc.code, dc.usage_count,
--          (SELECT count(*) FROM discount_code_usage u WHERE u.discount_code_id = dc.id) AS recorded
--   FROM discount_codes dc
--   WHERE dc.usage_count <> (SELECT count(*) FROM discount_code_usage u WHERE u.discount_code_id = dc.id);
--
-- ── Correctie usage_count (NIET automatisch; alleen na expliciete go) ────────
-- Zet usage_count gelijk aan het vastgelegde gebruik. Op 15-10-2026 raakt dit alleen
-- The Fonske Crawl / FONSKE-E2E-1014 (1 → 0; de enige order is geannuleerd, code inactief).
--   UPDATE public.discount_codes dc
--   SET usage_count = sub.recorded
--   FROM (SELECT d.id, (SELECT count(*) FROM public.discount_code_usage u WHERE u.discount_code_id = d.id)::int AS recorded
--         FROM public.discount_codes d) sub
--   WHERE dc.id = sub.id AND dc.usage_count <> sub.recorded;
