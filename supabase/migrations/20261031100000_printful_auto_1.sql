-- PRINTFUL-AUTO-1 — betaalde bestellingen automatisch naar Printful sturen.
--
-- Tot nu toe deed niets iets met tenant_printful_settings.auto_forward_orders (BLOG-FIX-1
-- haalde de schakelaar weg): doorsturen kon enkel met de knop op de order. Loveke's eerste
-- echte order (31-10) bleef daardoor liggen.
--
-- Met auto_confirm aan is een forward een bevestigde Printful-order die Printful meteen
-- produceert en aanrekent. Daarom is alles hieronder gericht op: nooit dubbel, nooit
-- onbetaald, nooit stil blijven hangen.
--
-- Twee triggers: de Stripe-webhook maakt de order meteen als 'paid' aan en voegt de
-- orderregels pas in een aparte request toe. Bij de INSERT van de order zijn er nog geen
-- regels; dan doet de functie niets en vuurt ze opnieuw bij de INSERT van de regels (één
-- statement, dus pg_net — dat pas na de commit vertrekt — ziet ze allemaal). Bij het
-- legacy-pad (order bestaat al, wordt later 'paid') vuurt de order-UPDATE.
--
-- Dubbele aanroepen: eerst een printful_order_links-claim met status 'queued'
-- (UNIQUE tenant_id, order_id). De edge function zet 'queued' atomair op 'forwarding' en
-- werkt enkel als dat lukt. Een mislukte poging wordt 'failed' en wordt nooit automatisch
-- herhaald (opnieuw = de knop op de order). printful_auto_forward_sweep vangt claims die
-- blijven hangen (pg_net stil, functie gecrasht) en meldt ze.

-- Melding voor de winkel (category = enum, 'integrations' is geldig).
CREATE OR REPLACE FUNCTION public.printful_auto_forward_notify(p_tenant uuid, p_order uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_number text;
BEGIN
  SELECT order_number INTO v_number FROM public.orders WHERE id = p_order;
  BEGIN
  INSERT INTO public.notifications (tenant_id, category, type, priority, title, message, action_url, data)
  VALUES (
    p_tenant, 'integrations', 'integration_error', 'high',
    'Bestelling ' || coalesce(v_number, left(p_order::text, 8)) || ' niet doorgestuurd naar Printful',
    p_reason || ' Kijk de bestelling na en klik daar op "Opnieuw proberen" als ze naar Printful moet.',
    '/admin/orders/' || p_order,
    jsonb_build_object('order_id', p_order, 'dedupe_key', 'printful_forward:' || p_order)
  );
  EXCEPTION WHEN others THEN
    -- Een falende melding mag de hold/sweep nooit terugdraaien.
    RAISE WARNING 'printful_auto_forward_notify failed for %: %', p_order, SQLERRM;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.printful_auto_forward_order(p_order_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  o record;
  v_url text;
  v_secret text;
  v_claimed uuid;
  v_reason text;
BEGIN
  SELECT id, tenant_id, payment_status, status, stripe_checkout_session_id, internal_notes
    INTO o
  FROM public.orders WHERE id = p_order_id;
  IF o.id IS NULL THEN RETURN 'no_order'; END IF;

  -- Goedkoopste check eerst: 99% van de winkels heeft geen Printful.
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_printful_settings s
    WHERE s.tenant_id = o.tenant_id
      AND s.printful_sync_enabled
      AND s.auto_forward_orders
      AND s.forward_on_payment_status = 'paid'
  ) THEN
    RETURN 'disabled';
  END IF;

  IF o.payment_status IS DISTINCT FROM 'paid'::payment_status THEN RETURN 'not_paid'; END IF;
  IF EXISTS (SELECT 1 FROM public.printful_order_links WHERE order_id = p_order_id) THEN RETURN 'already_linked'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tenant_printful_credentials c WHERE c.tenant_id = o.tenant_id) THEN
    RETURN 'no_credentials';
  END IF;

  -- Enkel als ÉLKE fysieke regel een actieve Printful-mapping heeft (en er minstens één is).
  -- Gemengde bestellingen (eigen voorraad + Printful) gaan niet automatisch: die stuurt de
  -- winkel zelf door, anders faalt de forward en krijgt ze een verwarrende melding.
  IF NOT EXISTS (SELECT 1 FROM public.order_items i WHERE i.order_id = p_order_id AND i.gift_card_id IS NULL) THEN
    RETURN 'no_items';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.order_items i
    WHERE i.order_id = p_order_id AND i.gift_card_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.printful_variant_mappings m
        WHERE m.variant_id = i.variant_id AND m.tenant_id = o.tenant_id AND m.is_active
      )
  ) THEN
    RETURN 'not_all_printful';
  END IF;

  SELECT value INTO v_url FROM public.internal_config WHERE key = 'supabase_url';
  SELECT value INTO v_secret FROM public.internal_config WHERE key = 'internal_webhook_secret';
  IF v_url IS NULL OR v_secret IS NULL THEN RETURN 'no_config'; END IF;

  -- Redenen om NIET automatisch te bevestigen, maar de winkel te laten kijken.
  IF o.status IN ('cancelled'::order_status, 'returned'::order_status) THEN
    v_reason := 'De bestelling is geannuleerd of geretourneerd.';
  ELSIF o.internal_notes ILIKE '%Stripe inde%Controleer deze bestelling%' THEN
    v_reason := 'Het betaalde bedrag bij Stripe wijkt af van het ordertotaal.';
  ELSIF o.stripe_checkout_session_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.orders d
    WHERE d.stripe_checkout_session_id = o.stripe_checkout_session_id AND d.id <> o.id
  ) THEN
    -- Geen UNIQUE op stripe_checkout_session_id (31-10: 0 dubbels live). Een dubbele
    -- SellQo-order mag nooit een tweede betaalde Printful-order worden.
    v_reason := 'Er bestaat een tweede bestelling voor dezelfde Stripe-betaling (mogelijk dubbel).';
  END IF;

  INSERT INTO public.printful_order_links (tenant_id, order_id, external_id, status, last_error)
  VALUES (o.tenant_id, p_order_id, replace(p_order_id::text, '-', ''),
          CASE WHEN v_reason IS NULL THEN 'queued' ELSE 'failed' END, v_reason)
  ON CONFLICT (tenant_id, order_id) DO NOTHING
  RETURNING id INTO v_claimed;
  IF v_claimed IS NULL THEN RETURN 'already_linked'; END IF;

  IF v_reason IS NOT NULL THEN
    PERFORM public.printful_auto_forward_notify(o.tenant_id, p_order_id, v_reason);
    RETURN 'held';
  END IF;

  PERFORM net.http_post(
    url := v_url || '/functions/v1/forward-printful-order',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := jsonb_build_object('tenantId', o.tenant_id, 'orderId', p_order_id, 'auto', true),
    timeout_milliseconds := 30000
  );
  RETURN 'queued';
END;
$$;

-- Vangnet: claims die na 15 minuten nog op queued/forwarding staan (pg_net stilgevallen,
-- functie gecrasht of 401) worden 'failed' + melding. Puur SQL, geen HTTP: kost niets
-- zolang er niets hangt. Niet opnieuw proberen: misschien staat de order al bij Printful.
CREATE OR REPLACE FUNCTION public.printful_auto_forward_sweep()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  r record;
  n integer := 0;
BEGIN
  FOR r IN
    UPDATE public.printful_order_links
       SET status = 'failed',
           last_error = 'Automatisch doorsturen kreeg geen antwoord. Kijk in Printful of de bestelling er al staat voor je opnieuw probeert.',
           updated_at = now()
     WHERE status IN ('queued', 'forwarding') AND updated_at < now() - interval '15 minutes'
     RETURNING tenant_id, order_id, last_error
  LOOP
    PERFORM public.printful_auto_forward_notify(r.tenant_id, r.order_id, r.last_error);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.printful_auto_forward_notify(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.printful_auto_forward_order(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.printful_auto_forward_sweep() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.printful_auto_forward_order(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.printful_auto_forward_sweep() TO service_role;

-- Triggers: nooit de order of de regels laten falen door de Printful-koppeling.
CREATE OR REPLACE FUNCTION public.printful_auto_forward_orders_tr()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tenant_printful_settings s
                 WHERE s.tenant_id = NEW.tenant_id AND s.auto_forward_orders) THEN
    RETURN NULL;
  END IF;
  PERFORM public.printful_auto_forward_order(NEW.id);
  RETURN NULL;
EXCEPTION WHEN others THEN
  RAISE WARNING 'printful_auto_forward (orders) failed for %: %', NEW.id, SQLERRM;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.printful_auto_forward_items_tr()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  -- Let op: een toekomstige "regels toevoegen aan een oude betaalde order"-flow zou hier
  -- ook een forward starten als die order nog geen Printful-link heeft.
  PERFORM public.printful_auto_forward_order(NEW.order_id);
  RETURN NULL;
EXCEPTION WHEN others THEN
  RAISE WARNING 'printful_auto_forward (order_items) failed for %: %', NEW.order_id, SQLERRM;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.printful_auto_forward_orders_tr() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.printful_auto_forward_items_tr() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_printful_auto_forward ON public.orders;
CREATE TRIGGER trg_printful_auto_forward AFTER INSERT OR UPDATE OF payment_status ON public.orders
  FOR EACH ROW
  WHEN (NEW.payment_status = 'paid'::payment_status)
  EXECUTE FUNCTION public.printful_auto_forward_orders_tr();

DROP TRIGGER IF EXISTS trg_printful_auto_forward_items ON public.order_items;
CREATE TRIGGER trg_printful_auto_forward_items AFTER INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.printful_auto_forward_items_tr();

-- Vangnet elke 15 minuten (puur SQL, geen pg_net).
SELECT cron.unschedule('printful-auto-forward-sweep')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'printful-auto-forward-sweep');
SELECT cron.schedule('printful-auto-forward-sweep', '*/15 * * * *', $c$SELECT public.printful_auto_forward_sweep();$c$);
