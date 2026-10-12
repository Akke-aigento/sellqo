-- VOORSTEL BOL-SYNC-1 (NIET UITGEVOERD) — bol-orders correct op 'shipped' + geen eigen trackingmail naar marketplaceklanten.
--
-- Probleem (gemeten 13-10-2026):
--   orders.marketplace_sync_error bestaat niet. confirm-bol-shipment en update-bol-tracking
--   schrijven die kolom in dezelfde update als sync_status='shipped' / tracking, dus die
--   updates falen volledig: 17 van 18 bol-orders bleven 'accepted'/'shipped_awaiting_tracking'
--   en bol-foutmeldingen worden nergens bewaard.
--
-- Waarom niet gewoon de kolom toevoegen: dan gaan die updates slagen en zetten ze soms
-- tracking_number van NULL naar een waarde → trigger auto_send_tracking_email mailt de
-- klant. Voor bol-orders is dat nieuw (live 0 berichten naar bol-klanten) en bol mailt
-- zelf al; contact buiten bol om valt onder bol's partnervoorwaarden.
--
-- Volgorde: STAP 1 eerst (uitsluiting), dan STAP 2 (kolom). Beide in één aanroep is ok.
-- Geen deploy nodig: de bestaande functiecode werkt daarna zoals bedoeld.

-- STAP 1 — marketplace-orders uitsluiten van de eigen trackingmail.
-- Enige wijziging t.o.v. de live definitie: het blok "Marketplace-orders" bovenaan.
CREATE OR REPLACE FUNCTION public.auto_send_tracking_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_supabase_url TEXT;
  v_anon_key TEXT;
  v_carrier_name TEXT;
  v_tracking_url TEXT;
  v_shipping_enabled BOOLEAN;
BEGIN
  -- Marketplace-orders (bol, amazon, ebay): de marketplace informeert de klant zelf.
  IF NEW.marketplace_source IN ('bol_com', 'amazon', 'ebay') THEN
    RETURN NEW;
  END IF;

  -- Only when tracking_number changes from NULL to a value AND customer_email exists
  IF OLD.tracking_number IS NOT NULL OR NEW.tracking_number IS NULL OR NEW.customer_email IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT email_enabled INTO v_shipping_enabled
  FROM public.customer_communication_settings
  WHERE tenant_id = NEW.tenant_id AND trigger_type = 'shipping_update'
  LIMIT 1;

  IF v_shipping_enabled IS NULL THEN
    v_shipping_enabled := true;
  END IF;

  IF NOT v_shipping_enabled THEN
    RETURN NEW;
  END IF;

  SELECT value INTO v_supabase_url FROM public.internal_config WHERE key = 'supabase_url';
  SELECT value INTO v_anon_key FROM public.internal_config WHERE key = 'supabase_anon_key';

  IF v_supabase_url IS NULL OR v_anon_key IS NULL THEN
    RETURN NEW;
  END IF;

  v_carrier_name := COALESCE(NEW.carrier, 'Vervoerder');
  v_carrier_name := REPLACE(REPLACE(LOWER(v_carrier_name), '_', ' '), 'be', '');
  v_carrier_name := INITCAP(TRIM(v_carrier_name));

  v_tracking_url := COALESCE(NEW.tracking_url, '');

  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/send-customer-message',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key
    ),
    body := jsonb_build_object(
      'tenant_id', NEW.tenant_id,
      'customer_email', NEW.customer_email,
      'customer_name', COALESCE(NEW.customer_name, 'klant'),
      'subject', 'Je bestelling ' || COALESCE(NEW.order_number, '') || ' is onderweg! 📦',
      'body_html', '<p>Goed nieuws! Je bestelling <strong>' || COALESCE(NEW.order_number, '') || '</strong> is verzonden.</p>'
        || '<table style="margin: 24px 0; border-collapse: collapse;">'
        || '<tr><td style="padding: 8px 16px 8px 0; color: #6b7280;">Vervoerder:</td><td style="padding: 8px 0; font-weight: 500;">' || v_carrier_name || '</td></tr>'
        || '<tr><td style="padding: 8px 16px 8px 0; color: #6b7280;">Tracknummer:</td><td style="padding: 8px 0; font-weight: 500;">' || NEW.tracking_number || '</td></tr>'
        || '</table>'
        || CASE WHEN v_tracking_url != '' THEN
          '<p><a href="' || v_tracking_url || '" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">📦 Volg je pakket</a></p>'
          ELSE '' END
        || '<p style="margin-top: 24px; color: #6b7280; font-size: 14px;">Je ontvangt automatisch updates over de status van je zending.</p>',
      'body_text', 'Goed nieuws! Je bestelling ' || COALESCE(NEW.order_number, '') || ' is verzonden via ' || v_carrier_name || '. Tracknummer: ' || NEW.tracking_number || '. ' || CASE WHEN v_tracking_url != '' THEN 'Volg je pakket: ' || v_tracking_url ELSE '' END,
      'context_type', 'order',
      'order_id', NEW.id,
      'context_data', jsonb_build_object(
        'order_number', NEW.order_number,
        'carrier', v_carrier_name,
        'tracking_number', NEW.tracking_number,
        'tracking_url', v_tracking_url
      )
    )
  );

  RETURN NEW;
END;
$function$;

-- STAP 2 — de ontbrekende kolom.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS marketplace_sync_error text;
COMMENT ON COLUMN public.orders.marketplace_sync_error IS 'Laatste foutmelding van de marketplace-sync (bol); null na een geslaagde bevestiging.';

-- Controle (aparte aanroep): select column_name from information_schema.columns
--   where table_name='orders' and column_name='marketplace_sync_error';
-- en: select pg_get_functiondef('public.auto_send_tracking_email'::regproc) ilike '%bol_com%';
