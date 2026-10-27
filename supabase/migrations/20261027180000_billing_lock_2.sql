-- BILLING-LOCK-2 / PAYMENT-ALERT-1 (27-10-2026)
--
-- Geen schemawijziging: "winkel zelf offline" hergebruikt tenant_theme_settings.storefront_status
-- ('offline'), die de ingebouwde winkel al volgde. storefront-api get_shop_status
-- (_shared/shopStatus.ts) leest die vlag plus de opschorting wegens betaling.
--
-- De dagelijkse statusmachine aan (stond sinds 12-10 bewust uit). 07:45 UTC, na
--    dunning (07:00) en cycle-reminders (07:30). Zelfde auth-patroon als de andere crons.
DO $$
BEGIN
  PERFORM cron.unschedule('sync-billing-state-daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-billing-state-daily');
  PERFORM cron.schedule(
    'sync-billing-state-daily',
    '45 7 * * *',
    $cmd$
      SELECT net.http_post(
        url := 'https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/sync-billing-state',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (SELECT value FROM public.internal_config WHERE key = 'internal_webhook_secret')
        ),
        body := jsonb_build_object('trigger', 'cron', 'ts', now()),
        timeout_milliseconds := 120000
      );
    $cmd$
  );
END $$;
