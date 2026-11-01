-- KASSA-ODOO-1 — cron voor sync-odoo-pos-z (Z-rapporten van SellQo Kassa naar Odoo).
--
-- Keuze (motivering): de cron mag actief zijn, omdat de functie zelf standaard niets doet. Ze
-- verwerkt enkel winkels met tenant_odoo_settings.pos_z_sync_enabled = true (standaard false)
-- én odoo_sync_enabled én een startdatum pos_z_sync_from. Zolang niemand de schakelaar
-- aanzet, is elke run één SELECT zonder resultaat. Zo hoeft er na het aanzetten in de admin geen
-- tweede handeling te gebeuren (een vergeten cron = stille achterstand in de boekhouding).
--
-- PAS DRAAIEN NA: de migratie 20261101230500_kassa_odoo_1.sql én de deploy van sync-odoo-pos-z
-- (vingerafdruk: GET → {"version":"KASSA-ODOO-1"}). Zonder deploy geeft elke run een 404, zonder
-- schade. Wie de cron toch nog niet wil: dit bestand pas later draaien.
--
-- Elk uur om :47 (de factuursync draait om :17). Z's worden doorgaans 's avonds of de ochtend
-- erna gemaakt; elk uur geeft een snelle melding bij een probleem.
-- Zelfde auth-patroon als sync-odoo-invoices-hourly en link-stripe-payouts-daily.
-- Idempotent (unschedule + schedule).
--
-- Handmatig terugdraaien: select cron.unschedule('sync-odoo-pos-z-hourly');
DO $$
BEGIN
  PERFORM cron.unschedule('sync-odoo-pos-z-hourly')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-odoo-pos-z-hourly');
  PERFORM cron.schedule(
    'sync-odoo-pos-z-hourly',
    '47 * * * *',
    $cmd$
      SELECT net.http_post(
        url := 'https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/sync-odoo-pos-z',
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
