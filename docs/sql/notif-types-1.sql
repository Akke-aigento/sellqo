-- NOTIF-TYPES-1 — voorkeuren verhuizen mee met de hernoemde meldingstypes,
-- en de repo-definitie van handle_payment_notification weer gelijk aan live.
--
-- BEWUST GEEN MIGRATIE: chat-Claude voert dit uit via de connector.
-- Idempotent: een tweede run raakt 0 rijen en wijzigt geen functie.
-- Bevat geen keys of tokens (gescand op het JWT-prefix vóór commit).
--
-- Keuze Akke (19-09): de config volgt de bron. NOTIFICATION_CONFIG kreeg de namen en
-- categorieën die de triggers echt sturen. De voorkeursrijen onder de oude sleutel
-- verhuizen mee; waar al een rij onder de nieuwe sleutel bestaat, wint die en blijft de
-- oude staan (gerapporteerd in (2)). Stand 19-09: 15 tenant-rijen, 8 user-rijen,
-- 0 conflicten.
--
-- Unieke constraints (nagetrokken):
--   tenant_notification_settings  UNIQUE (tenant_id, category, notification_type)  — category = enum
--   user_notification_preferences UNIQUE (user_id, tenant_id, category, notification_type) — category = text
--
-- Terugdraaien: de snapshot uit (1) bewaren; per rij category + notification_type terugzetten
-- op id.

-- De mapping, één keer gedefinieerd en in elke stap hergebruikt.
CREATE TEMP TABLE IF NOT EXISTS notif_types_1_map (old_cat text, old_type text, new_cat text, new_type text);
TRUNCATE notif_types_1_map;
INSERT INTO notif_types_1_map VALUES
  ('quotes',       'quote_created',             'quotes',       'quote_new'),
  ('team',         'team_invitation_sent',      'team',         'team_member_invited'),
  ('team',         'team_invitation_accepted',  'team',         'team_member_joined'),
  ('customers',    'customer_vip_status',       'customers',    'customer_vip'),
  ('marketing',    'campaign_bounce_alert',     'marketing',    'campaign_high_bounce'),
  ('integrations', 'shopify_request_submitted', 'integrations', 'shopify_request_received'),
  ('marketing',    'ai_credits_low',            'system',       'ai_credits_low'),
  ('orders',       'order_payment_failed',      'payments',     'order_payment_failed');

-- ─────────────────────────────────────────────────────────────────────
-- (1) SNAPSHOT — alle rijen die geraakt kunnen worden. Bewaar de uitvoer.
-- ─────────────────────────────────────────────────────────────────────
SELECT 'tenant' AS tabel, t.id, t.tenant_id, NULL::uuid AS user_id, t.category::text, t.notification_type,
       t.in_app_enabled, t.email_enabled, t.push_enabled
FROM public.tenant_notification_settings t
JOIN notif_types_1_map m ON t.category::text = m.old_cat AND t.notification_type = m.old_type
UNION ALL
SELECT 'user', u.id, u.tenant_id, u.user_id, u.category, u.notification_type,
       NULL, NULL, u.push_enabled
FROM public.user_notification_preferences u
JOIN notif_types_1_map m ON u.category = m.old_cat AND u.notification_type = m.old_type
ORDER BY 1, 5, 6;

-- ─────────────────────────────────────────────────────────────────────
-- (2) CONFLICTEN — oude rijen waarvoor al een rij onder de nieuwe sleutel bestaat.
-- Die worden NIET overschreven en blijven staan (nieuwe rij wint). Verwacht 19-09: 0.
-- ─────────────────────────────────────────────────────────────────────
SELECT 'tenant' AS tabel, t.id AS oude_rij, t.tenant_id, NULL::uuid AS user_id,
       m.old_cat || '/' || m.old_type AS oud, m.new_cat || '/' || m.new_type AS nieuw
FROM public.tenant_notification_settings t
JOIN notif_types_1_map m ON t.category::text = m.old_cat AND t.notification_type = m.old_type
WHERE EXISTS (SELECT 1 FROM public.tenant_notification_settings x
              WHERE x.tenant_id = t.tenant_id AND x.category::text = m.new_cat AND x.notification_type = m.new_type)
UNION ALL
SELECT 'user', u.id, u.tenant_id, u.user_id, m.old_cat || '/' || m.old_type, m.new_cat || '/' || m.new_type
FROM public.user_notification_preferences u
JOIN notif_types_1_map m ON u.category = m.old_cat AND u.notification_type = m.old_type
WHERE EXISTS (SELECT 1 FROM public.user_notification_preferences x
              WHERE x.user_id = u.user_id AND x.tenant_id = u.tenant_id
                AND x.category = m.new_cat AND x.notification_type = m.new_type);

-- ─────────────────────────────────────────────────────────────────────
-- (3) VERHUIZEN — alleen zonder conflict.
-- ─────────────────────────────────────────────────────────────────────
UPDATE public.tenant_notification_settings t
SET category = m.new_cat::public.notification_category,
    notification_type = m.new_type
FROM notif_types_1_map m
WHERE t.category::text = m.old_cat AND t.notification_type = m.old_type
  AND NOT EXISTS (SELECT 1 FROM public.tenant_notification_settings x
                  WHERE x.tenant_id = t.tenant_id AND x.category::text = m.new_cat AND x.notification_type = m.new_type)
RETURNING t.id, t.tenant_id, m.old_cat || '/' || m.old_type AS oud, t.category::text || '/' || t.notification_type AS nieuw;

UPDATE public.user_notification_preferences u
SET category = m.new_cat,
    notification_type = m.new_type
FROM notif_types_1_map m
WHERE u.category = m.old_cat AND u.notification_type = m.old_type
  AND NOT EXISTS (SELECT 1 FROM public.user_notification_preferences x
                  WHERE x.user_id = u.user_id AND x.tenant_id = u.tenant_id
                    AND x.category = m.new_cat AND x.notification_type = m.new_type)
RETURNING u.id, u.user_id, u.tenant_id, m.old_cat || '/' || m.old_type AS oud, u.category || '/' || u.notification_type AS nieuw;

-- ─────────────────────────────────────────────────────────────────────
-- (4) CONTROLE — verwacht 0 rijen met oude sleutels (tenzij (2) conflicten toonde).
-- ─────────────────────────────────────────────────────────────────────
SELECT 'tenant' AS tabel, count(*) AS rijen_met_oude_sleutel
FROM public.tenant_notification_settings t
JOIN notif_types_1_map m ON t.category::text = m.old_cat AND t.notification_type = m.old_type
UNION ALL
SELECT 'user', count(*)
FROM public.user_notification_preferences u
JOIN notif_types_1_map m ON u.category = m.old_cat AND u.notification_type = m.old_type;

-- ─────────────────────────────────────────────────────────────────────
-- (5) DRIFT-SYNC handle_payment_notification — GEEN gedragswijziging.
--
-- Live is de 'paid'-tak uit deze functie gehaald (handle_order_notification dekt
-- betaalde orders al), maar geen migratie in de repo bevat die wijziging: de repo
-- toont nog de versie uit 20260120184941 met order_paid. De guard
-- check:notifications leest de repo, dus hier staat de live definitie van
-- 19-09-2026 letterlijk. Controle: md5 vóór en na moet
-- 551cf642ab1d7557e9b946b75add787a zijn; wijkt de eerste af, dan NIET uitvoeren
-- en melden.
-- ─────────────────────────────────────────────────────────────────────
SELECT md5(pg_get_functiondef('public.handle_payment_notification'::regproc)) AS md5_voor;

CREATE OR REPLACE FUNCTION public.handle_payment_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only trigger on payment_status changes
  IF TG_OP = 'UPDATE' AND OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
    CASE NEW.payment_status
      -- 'paid' case REMOVED: handle_order_notification already covers this
        
      WHEN 'failed' THEN
        PERFORM public.send_notification(
          NEW.tenant_id,
          'payments',
          'order_payment_failed',
          'Betaling mislukt: ' || NEW.order_number,
          'De betaling voor bestelling ' || NEW.order_number || ' is mislukt',
          'urgent',
          '/admin/orders/' || NEW.id,
          jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number, 'amount', NEW.total)
        );
        
      WHEN 'refunded' THEN
        PERFORM public.send_notification(
          NEW.tenant_id,
          'payments',
          'order_refunded',
          'Terugbetaling verwerkt: ' || NEW.order_number,
          'Terugbetaling van €' || ROUND(NEW.total::numeric, 2) || ' voor bestelling ' || NEW.order_number || ' is verwerkt',
          'medium',
          '/admin/orders/' || NEW.id,
          jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number, 'amount', NEW.total)
        );
      ELSE
        -- Do nothing for other statuses (including 'paid')
        NULL;
    END CASE;
  END IF;
  
  RETURN NEW;
END;
$function$;

SELECT md5(pg_get_functiondef('public.handle_payment_notification'::regproc)) AS md5_na;
