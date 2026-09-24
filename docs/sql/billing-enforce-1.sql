-- BILLING-ENFORCE-1 — statusmachine: planlookup losmaken van 'active' + dagelijkse cron.
--
-- BEWUST GEEN MIGRATIE: chat-Claude voert dit uit via de connector.
-- Idempotent: CREATE OR REPLACE en cron.unschedule/schedule.
-- Bevat geen keys of tokens (gescand op het JWT-prefix vóór commit). De cron leest
-- de service-key uit de vault, net als job 61 en 114.
--
-- Volgorde: (1) snapshot, (2) record_transaction, (3) cron, (4) controle.
-- Let op: `tenant_subscriptions.status` is varchar zonder CHECK — de nieuwe waarden
-- 'restricted' en 'suspended' vergen dus geen schemawijziging.

-- ─────────────────────────────────────────────────────────────────────
-- (1) SNAPSHOT — bewaar de uitvoer; dat is de terugdraai van (2).
-- Verwachte md5 vóór: 70fd35f9ca42c37bb4f8dbe37c1bb9c0. Wijkt die af, NIET
-- uitvoeren en melden.
-- ─────────────────────────────────────────────────────────────────────
SELECT md5(pg_get_functiondef('public.record_transaction'::regproc)) AS md5_voor,
       pg_get_functiondef('public.record_transaction'::regproc) AS snapshot_record_transaction;

-- ─────────────────────────────────────────────────────────────────────
-- (2) record_transaction — plan opzoeken los van de abonnementsstatus.
--
-- Waarom: deze functie zoekt het plan met `status = 'active'`. Zodra de
-- statusmachine een winkel op 'past_due' of 'restricted' zet, vond hij geen
-- abonnement meer, viel `included_transactions` terug op 0 en werd élke
-- transactie als overage geteld (€0,50 standaard) — stil verkeerd factureren
-- bij precies de klanten die al achterlopen. Alleen de WHERE verandert:
-- 'canceled' telt niet mee, de rest wel.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_transaction(p_tenant_id uuid, p_transaction_type text, p_order_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_month_year text;
  v_usage_record tenant_transaction_usage%ROWTYPE;
  v_plan pricing_plans%ROWTYPE;
  v_subscription tenant_subscriptions%ROWTYPE;
  v_total_transactions integer;
  v_included_transactions integer;
  v_overage_fee decimal(10,2);
  v_is_overage boolean;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (public.is_platform_admin(auth.uid())
      OR p_tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))) THEN
    RAISE EXCEPTION 'Geen toegang tot deze tenant' USING ERRCODE = '42501';
  END IF;

  v_month_year := to_char(now(), 'YYYY-MM');

  INSERT INTO tenant_transaction_usage (tenant_id, month_year)
  VALUES (p_tenant_id, v_month_year)
  ON CONFLICT (tenant_id, month_year) DO NOTHING;

  SELECT * INTO v_usage_record
  FROM tenant_transaction_usage
  WHERE tenant_id = p_tenant_id AND month_year = v_month_year;

  CASE p_transaction_type
    WHEN 'stripe' THEN
      UPDATE tenant_transaction_usage
      SET stripe_transactions = stripe_transactions + 1, updated_at = now()
      WHERE id = v_usage_record.id;
    WHEN 'bank_transfer' THEN
      UPDATE tenant_transaction_usage
      SET bank_transfer_transactions = bank_transfer_transactions + 1, updated_at = now()
      WHERE id = v_usage_record.id;
    WHEN 'pos_cash' THEN
      UPDATE tenant_transaction_usage
      SET pos_cash_transactions = pos_cash_transactions + 1, updated_at = now()
      WHERE id = v_usage_record.id;
    WHEN 'pos_card' THEN
      UPDATE tenant_transaction_usage
      SET pos_card_transactions = pos_card_transactions + 1, updated_at = now()
      WHERE id = v_usage_record.id;
  END CASE;

  -- BILLING-ENFORCE-1: was `status = 'active'`.
  SELECT * INTO v_subscription
  FROM tenant_subscriptions
  WHERE tenant_id = p_tenant_id AND status <> 'canceled'
  ORDER BY created_at DESC LIMIT 1;

  IF v_subscription.id IS NOT NULL THEN
    SELECT * INTO v_plan
    FROM pricing_plans
    WHERE id = v_subscription.plan_id;
  END IF;

  v_included_transactions := COALESCE(v_plan.included_transactions_monthly, 0);
  v_overage_fee := COALESCE(v_plan.transaction_overage_fee, 0.50);

  IF v_included_transactions = -1 THEN
    v_is_overage := false;
    v_overage_fee := 0;
  ELSE
    SELECT * INTO v_usage_record
    FROM tenant_transaction_usage
    WHERE tenant_id = p_tenant_id AND month_year = v_month_year;

    v_total_transactions := v_usage_record.stripe_transactions +
                           v_usage_record.bank_transfer_transactions +
                           v_usage_record.pos_cash_transactions +
                           v_usage_record.pos_card_transactions;

    v_is_overage := v_total_transactions > v_included_transactions;

    IF v_is_overage THEN
      UPDATE tenant_transaction_usage
      SET overage_fee_total = overage_fee_total + v_overage_fee, updated_at = now()
      WHERE id = v_usage_record.id;
    ELSE
      v_overage_fee := 0;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'is_overage', v_is_overage,
    'overage_fee', v_overage_fee,
    'total_transactions', v_total_transactions,
    'included_transactions', v_included_transactions
  );
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────
-- (3) CRON — sync-billing-state om 07:45, ná dunning (07:00) en de
-- cyclusherinneringen (07:30). Zelfde vorm als job 61/114.
--
-- LET OP: pas plannen NADAT de dry-run bekeken is (zie docs/role-audit.md).
-- Dry-run zonder cron:
--   SELECT net.http_post(
--     url := 'https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/sync-billing-state',
--     headers := jsonb_build_object('Content-Type','application/json','Lovable-Context','cron',
--       'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='cron_service_role_key')),
--     body := '{"dry_run":true}'::jsonb, timeout_milliseconds := 120000);
--
-- Terugdraaien: SELECT cron.unschedule('sync-billing-state-daily');
-- ─────────────────────────────────────────────────────────────────────
SELECT cron.unschedule('sync-billing-state-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-billing-state-daily');

SELECT cron.schedule(
  'sync-billing-state-daily',
  '45 7 * * *',
  $cron$
      SELECT net.http_post(
        url := 'https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/sync-billing-state',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Lovable-Context', 'cron',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_service_role_key'
          )
        ),
        body := '{"source":"cron"}'::jsonb,
        timeout_milliseconds := 120000
      ) AS request_id;
  $cron$
);

-- ─────────────────────────────────────────────────────────────────────
-- (4) CONTROLE
-- ─────────────────────────────────────────────────────────────────────
SELECT position('status <> ''canceled''' IN pg_get_functiondef('public.record_transaction'::regproc)) > 0 AS planlookup_losgemaakt;
SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'sync-billing-state-daily';
SELECT status, count(*) FROM public.tenant_subscriptions GROUP BY 1 ORDER BY 1;
