-- PRINTFUL-AUTO-2 — de gaten na PRINTFUL-AUTO-1 dichten.
--
-- 1. Meldingen: eigen types integrations/printful_order_failed, printful_order_canceled en
--    printful_cancel_failed. Fouten zijn 'urgent' (push én mail zonder eigen voorkeursrij,
--    zie notificationDefaults.planEmail), zodat een vastgelopen bestelling nooit stil blijft.
-- 2. Annuleren: wordt een doorgestuurde bestelling geannuleerd of volledig terugbetaald (en
--    is ze nog niet verzonden), dan annuleert SellQo ze ook bij Printful. Lukt dat niet
--    (productie al gestart), dan volgt een dringende melding.
-- 3. Niet automatisch, wel melden: gemengde bestellingen (Printful + eigen voorraad),
--    bestellingen van € 0 en demowinkels (Stripe-testmodus, zie _shared/stripe.ts).
-- 4. Vangnet: ook een annulering die na 15 minuten nog loopt, wordt gemeld.
--
-- Terugdraaien: DROP TRIGGER trg_printful_auto_cancel ON public.orders; DROP FUNCTION
-- public.printful_auto_cancel_order(uuid), public.printful_auto_cancel_tr(),
-- public.printful_notify(uuid,uuid,text,text,text,text); en de functies uit
-- 20261031100000_printful_auto_1.sql opnieuw uitvoeren.

CREATE OR REPLACE FUNCTION public.printful_notify(
  p_tenant uuid, p_order uuid, p_type text, p_priority text, p_title text, p_message text)
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
      p_tenant, 'integrations', p_type, p_priority::notification_priority,
      replace(p_title, '{n}', coalesce(v_number, left(p_order::text, 8))),
      p_message,
      '/admin/orders/' || p_order,
      jsonb_build_object('order_id', p_order, 'dedupe_key', p_type || ':' || p_order)
    );
  EXCEPTION WHEN others THEN
    -- Een falende melding mag de hold, annulering of sweep nooit terugdraaien.
    RAISE WARNING 'printful_notify failed for %: %', p_order, SQLERRM;
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
  v_mapped integer;
  v_unmapped integer;
BEGIN
  SELECT id, tenant_id, payment_status, status, total, stripe_checkout_session_id, internal_notes
    INTO o
  FROM public.orders WHERE id = p_order_id;
  IF o.id IS NULL THEN RETURN 'no_order'; END IF;

  -- Goedkoopste check eerst: bijna geen enkele winkel heeft Printful.
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

  SELECT
    count(*) FILTER (WHERE m.variant_id IS NOT NULL),
    count(*) FILTER (WHERE m.variant_id IS NULL)
    INTO v_mapped, v_unmapped
  FROM public.order_items i
  LEFT JOIN public.printful_variant_mappings m
    ON m.variant_id = i.variant_id AND m.tenant_id = o.tenant_id AND m.is_active
  WHERE i.order_id = p_order_id AND i.gift_card_id IS NULL;
  -- Nog geen regels (webhook voegt ze straks toe) of geen enkel Printful-product: niets doen.
  IF coalesce(v_mapped, 0) = 0 THEN RETURN 'no_printful_items'; END IF;

  SELECT value INTO v_url FROM public.internal_config WHERE key = 'supabase_url';
  SELECT value INTO v_secret FROM public.internal_config WHERE key = 'internal_webhook_secret';
  IF v_url IS NULL OR v_secret IS NULL THEN RETURN 'no_config'; END IF;

  -- Redenen om NIET automatisch te bevestigen, maar de winkel te laten beslissen.
  IF o.status IN ('cancelled'::order_status, 'returned'::order_status) THEN
    v_reason := 'De bestelling is geannuleerd of geretourneerd.';
  ELSIF EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = o.tenant_id AND t.is_demo) THEN
    v_reason := 'Dit is een demowinkel (Stripe-testmodus): niets wordt automatisch bij Printful besteld.';
  ELSIF coalesce(o.total, 0) <= 0 THEN
    v_reason := 'Het ordertotaal is € 0. Controleer of dit een bewuste gratis bestelling is voor je ze laat produceren.';
  ELSIF o.internal_notes ILIKE '%Stripe inde%Controleer deze bestelling%' THEN
    v_reason := 'Het betaalde bedrag bij Stripe wijkt af van het ordertotaal.';
  ELSIF o.stripe_checkout_session_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.orders d
    WHERE d.stripe_checkout_session_id = o.stripe_checkout_session_id AND d.id <> o.id
  ) THEN
    -- Geen UNIQUE op stripe_checkout_session_id. Een dubbele SellQo-order mag nooit een
    -- tweede betaalde Printful-order worden.
    v_reason := 'Er bestaat een tweede bestelling voor dezelfde Stripe-betaling (mogelijk dubbel).';
  ELSIF v_unmapped > 0 THEN
    v_reason := 'De bestelling bevat ook producten zonder Printful-koppeling. Open de bestelling: je kan enkel de Printful-producten doorsturen en de rest zelf versturen.';
  END IF;

  INSERT INTO public.printful_order_links (tenant_id, order_id, external_id, status, last_error)
  VALUES (o.tenant_id, p_order_id, replace(p_order_id::text, '-', ''),
          CASE WHEN v_reason IS NULL THEN 'queued' ELSE 'failed' END, v_reason)
  ON CONFLICT (tenant_id, order_id) DO NOTHING
  RETURNING id INTO v_claimed;
  IF v_claimed IS NULL THEN RETURN 'already_linked'; END IF;

  IF v_reason IS NOT NULL THEN
    PERFORM public.printful_notify(o.tenant_id, p_order_id, 'printful_order_failed', 'urgent',
      'Bestelling {n} niet naar Printful',
      v_reason || ' De bestelling wordt NIET geproduceerd tot jij beslist.');
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

-- Annuleren bij Printful na annulering of volledige terugbetaling in SellQo.
CREATE OR REPLACE FUNCTION public.printful_auto_cancel_order(p_order_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  o record;
  v_url text;
  v_secret text;
  v_claimed uuid;
BEGIN
  SELECT id, tenant_id, status, payment_status, shipped_at INTO o FROM public.orders WHERE id = p_order_id;
  IF o.id IS NULL THEN RETURN 'no_order'; END IF;
  IF NOT (o.status = 'cancelled'::order_status OR o.payment_status = 'refunded'::payment_status) THEN
    RETURN 'not_cancelled';
  END IF;
  -- Al verzonden of geretourneerd: er valt niets meer te annuleren (terugbetaling na
  -- levering). shipped_at zet de Printful-webhook altijd bij verzending.
  IF o.shipped_at IS NOT NULL
     OR o.status IN ('shipped'::order_status, 'delivered'::order_status,
                     'returned'::order_status, 'partially_returned'::order_status) THEN
    RETURN 'already_shipped';
  END IF;
  -- Terugbetaling die bij Stripe mislukte: process-order-refund zet de order toch op
  -- 'refunded' (retour met refund_status 'failed'). Dan niets annuleren: de klant heeft zijn
  -- geld niet terug en moet zijn product krijgen.
  IF o.status IS DISTINCT FROM 'cancelled'::order_status AND EXISTS (
    SELECT 1 FROM public.returns r WHERE r.order_id = p_order_id AND r.refund_status = 'failed'
      AND r.created_at = (SELECT max(r2.created_at) FROM public.returns r2 WHERE r2.order_id = p_order_id)
  ) THEN
    RETURN 'refund_failed';
  END IF;

  SELECT value INTO v_url FROM public.internal_config WHERE key = 'supabase_url';
  SELECT value INTO v_secret FROM public.internal_config WHERE key = 'internal_webhook_secret';
  IF v_url IS NULL OR v_secret IS NULL THEN RETURN 'no_config'; END IF;

  -- Enkel een order die echt bij Printful staat. queued/forwarding vangt de edge function zelf
  -- op (hercheck vóór en na het doorsturen).
  UPDATE public.printful_order_links
     SET status = 'canceling', updated_at = now()
   WHERE order_id = p_order_id AND tenant_id = o.tenant_id AND status IN ('confirmed', 'draft')
  RETURNING id INTO v_claimed;
  IF v_claimed IS NULL THEN RETURN 'nothing_to_cancel'; END IF;

  PERFORM net.http_post(
    url := v_url || '/functions/v1/forward-printful-order',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := jsonb_build_object('action', 'cancel', 'tenantId', o.tenant_id, 'orderId', p_order_id, 'auto', true),
    timeout_milliseconds := 30000
  );
  RETURN 'canceling';
END;
$$;

CREATE OR REPLACE FUNCTION public.printful_auto_cancel_tr()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.printful_order_links l WHERE l.order_id = NEW.id) THEN
    RETURN NULL;
  END IF;
  PERFORM public.printful_auto_cancel_order(NEW.id);
  RETURN NULL;
EXCEPTION WHEN others THEN
  RAISE WARNING 'printful_auto_cancel failed for %: %', NEW.id, SQLERRM;
  RETURN NULL;
END;
$$;

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
    PERFORM public.printful_notify(r.tenant_id, r.order_id, 'printful_order_failed', 'urgent',
      'Bestelling {n} niet naar Printful', r.last_error);
    n := n + 1;
  END LOOP;
  -- Vangnet voor de race forward ↔ annulering: een order die in SellQo geannuleerd of
  -- terugbetaald is maar bij Printful nog bevestigd/concept staat (en niet verzonden is).
  -- printful_auto_cancel_order doet alle controles en claimt zelf.
  FOR r IN
    SELECT l.order_id FROM public.printful_order_links l
    JOIN public.orders o ON o.id = l.order_id
    WHERE l.status IN ('confirmed', 'draft')
      AND l.updated_at > now() - interval '1 day'
      AND l.updated_at < now() - interval '2 minutes'
      AND (o.status = 'cancelled'::order_status OR o.payment_status = 'refunded'::payment_status)
      AND o.shipped_at IS NULL
  LOOP
    BEGIN
      IF public.printful_auto_cancel_order(r.order_id) = 'canceling' THEN n := n + 1; END IF;
    EXCEPTION WHEN others THEN
      -- Eén slechte rij mag de rest van het vangnet nooit tegenhouden.
      RAISE WARNING 'printful sweep cancel failed for %: %', r.order_id, SQLERRM;
    END;
  END LOOP;
  FOR r IN
    UPDATE public.printful_order_links
       SET status = 'cancel_failed',
           last_error = 'De annulering bij Printful kreeg geen antwoord. Kijk in Printful of de bestelling geannuleerd is.',
           updated_at = now()
     WHERE status = 'canceling' AND updated_at < now() - interval '15 minutes'
     RETURNING tenant_id, order_id, last_error
  LOOP
    PERFORM public.printful_notify(r.tenant_id, r.order_id, 'printful_cancel_failed', 'urgent',
      'Bestelling {n}: Printful niet geannuleerd', r.last_error);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

-- Oude meldingsfunctie (AUTO-1) is vervangen door printful_notify.
DROP FUNCTION IF EXISTS public.printful_auto_forward_notify(uuid, uuid, text);

REVOKE ALL ON FUNCTION public.printful_notify(uuid, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.printful_auto_forward_order(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.printful_auto_cancel_order(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.printful_auto_cancel_tr() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.printful_auto_forward_sweep() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.printful_auto_forward_order(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.printful_auto_cancel_order(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.printful_auto_forward_sweep() TO service_role;

DROP TRIGGER IF EXISTS trg_printful_auto_cancel ON public.orders;
CREATE TRIGGER trg_printful_auto_cancel AFTER UPDATE OF status, payment_status ON public.orders
  FOR EACH ROW
  WHEN (
    (NEW.status = 'cancelled'::order_status AND OLD.status IS DISTINCT FROM NEW.status)
    OR (NEW.payment_status = 'refunded'::payment_status AND OLD.payment_status IS DISTINCT FROM NEW.payment_status)
  )
  EXECUTE FUNCTION public.printful_auto_cancel_tr();

-- Slottaak (DOCS-1): het bestaande helpartikel bijwerken (één plek per onderwerp). De oude
-- tekst zei nog "er is geen automatische doorstuur-schakelaar".
INSERT INTO public.doc_articles (category_id, doc_level, title, slug, excerpt, content, tags, context_path, sort_order, is_published)
VALUES (
  'a0000001-0000-0000-0000-00000000000a', 'tenant',
  'Printful print-on-demand koppelen',
  'printful-print-on-demand-koppelen',
  'Verbind je Printful-winkel via SellQo Connect: betaalde bestellingen gaan automatisch naar Printful, annuleringen ook, en bij elk probleem krijg je een dringende melding.',
  $doc$<h2>Wat is de Printful-koppeling?</h2><p>Printful is een print-on-demand partner: je uploadt een ontwerp, en Printful drukt en verzendt het product pas wanneer er een bestelling is. Je hebt dus geen voorraad en hoeft niets in te pakken. In SellQo vind je deze koppeling bij <strong>SellQo Connect &rarr; Fulfilment</strong>.</p><p>De koppeling is beschikbaar vanaf het <strong>Starter</strong>-abonnement (ook in Pro, Enterprise en Horeca) en staat nog in bèta. Je verbindt je Printful-winkel, importeert je producten, laat betaalde bestellingen automatisch doorsturen en krijgt de verzendupdates automatisch terug.</p><h2>Wat heb je nodig?</h2><ul><li>Een Printful-account met een winkel, met een geldige betaalmethode in Printful (Printful rekent elke bestelling aan jou aan)</li><li>Een <strong>private token</strong> uit het Printful Developer Portal, met de rechten (scopes) <strong>orders</strong>, <strong>sync_products</strong> en <strong>webhooks</strong></li></ul><h2>Verbinden in 4 stappen</h2><ol><li>Ga naar <strong>SellQo Connect &rarr; Fulfilment</strong> en klik op <strong>Verbind Printful</strong>.</li><li>Plak je private token in het veld <strong>Private token</strong>. Heb je een token op accountniveau (meerdere winkels), vul dan ook het <strong>Store-ID</strong> in.</li><li>Klik op <strong>Test verbinding</strong>. Je ziet direct of het token werkt en welke winkel gevonden is.</li><li>Klik op <strong>Opslaan</strong>. Je token wordt versleuteld opgeslagen en daarna nooit meer teruggetoond. Wil je het vervangen, vul dan een nieuw token in en sla opnieuw op.</li></ol><h2>Wat doen de schakelaars?</h2><ul><li><strong>Printful-koppeling actief</strong> &mdash; zet de koppeling aan of uit zonder je token te verwijderen.</li><li><strong>Betaalde bestellingen automatisch doorsturen</strong> &mdash; staat hij aan, dan stuurt SellQo een betaalde bestelling met enkel Printful-producten zelf door, binnen enkele seconden na de betaling.</li><li><strong>Bestellingen direct bevestigen bij Printful</strong> &mdash; staat hij aan, dan gaat een doorgestuurde bestelling meteen in productie en rekent Printful ze aan. Staat hij uit, dan komt ze als concept bij Printful en bevestig je ze daar zelf.</li></ul><h2>Wanneer stuurt SellQo níet automatisch door?</h2><p>In deze gevallen wacht SellQo op jou en krijg je een dringende melding:</p><ul><li>De bestelling bevat ook producten zonder Printful-koppeling (eigen voorraad). Open de bestelling en kies <strong>Enkel Printful-producten doorsturen</strong>; de rest verstuur je zelf.</li><li>Het ordertotaal is € 0 (bijvoorbeeld een kortingscode van 100%).</li><li>Het bedrag dat de klant betaalde wijkt af van het ordertotaal, of er bestaat een tweede bestelling voor dezelfde betaling.</li><li>De bestelling is al geannuleerd, of het is een demowinkel.</li></ul><h2>Varianten koppelen</h2><p>Voordat een bestelling doorgestuurd kan worden, moet elke variant die je via Printful laat maken gekoppeld zijn aan een Printful-variant. Producten die je importeert, zijn meteen gekoppeld. Voor producten die je zelf aanmaakte: open de Printful-instellingen en gebruik de kaart <strong>Variant-koppeling</strong>. Nieuwe producten in Printful aangemaakt? Klik op <strong>Printful verversen</strong>.</p><h2>Producten importeren uit Printful</h2><ol><li>Klik op <strong>Producten importeren uit Printful</strong>. Je ziet eerst een <strong>voorbeeld</strong> met alle producten, varianten, SKU's en afbeeldingen. Er wordt nog niets aangemaakt.</li><li>Vink aan welke producten je wil overnemen. Eerder geïmporteerde producten krijgen het label <strong>Al geïmporteerd</strong> en staan standaard uit.</li><li>De <strong>prijs per variant is een suggestie</strong> uit Printful. Pas die aan naar jouw verkoopprijs.</li><li>Klik op <strong>Importeren</strong>.</li></ol><p>Geïmporteerde producten komen op <strong>niet-actief en verborgen</strong> te staan. Controleer bij <strong>Producten</strong> teksten, prijzen en beelden en zet ze daarna zelf live. De maatgids uit Printful wordt automatisch meegenomen als die bestaat; je vindt hem in het product onder de tab <strong>Maattabel</strong>.</p><h2>Een bestelling zelf doorsturen</h2><p>Op de orderpagina staat een Printful-blok zodra de koppeling verbonden en actief is. Staat automatisch doorsturen uit, of hield SellQo de bestelling tegen, klik dan op <strong>Doorsturen naar Printful</strong> (of <strong>Opnieuw proberen</strong>). SellQo stuurt de gekoppelde regels, het verzendadres en de betaalde prijzen mee. Dezelfde bestelling wordt bij Printful nooit dubbel aangemaakt. Is een bestelling bevestigd, dan verdwijnt de doorstuurknop. Ontbreekt er iets (een variant-koppeling of een onvolledig adres), dan wordt er niets verstuurd en zie je wat er mist.</p><p>Cadeaukaarten worden nooit doorgestuurd: die worden digitaal geleverd.</p><h2>Annuleren en terugbetalen</h2><p>Annuleer je een doorgestuurde bestelling in SellQo, of betaal je ze volledig terug voor ze verzonden is, dan annuleert SellQo ze automatisch ook bij Printful. Je kan ook zelf op <strong>Annuleren bij Printful</strong> klikken. Printful kan enkel annuleren zolang de productie niet gestart is; dan wordt er niets gemaakt en betaalt Printful de kost terug. Is de productie al gestart, dan krijg je een dringende melding en blijft de Printful-kost. Een gedeeltelijke terugbetaling, een terugbetaling die bij Stripe mislukte en een terugbetaling na verzending annuleren niets bij Printful. Dit geldt voor elke bestelling die bij Printful staat, ook als je ze zelf doorstuurde.</p><h3>Wat de statussen betekenen</h3><ul><li><strong>Nog niet doorgestuurd</strong> &mdash; de bestelling staat enkel in SellQo.</li><li><strong>Wordt doorgestuurd…</strong> &mdash; SellQo stuurt ze op dit moment automatisch door.</li><li><strong>Concept bij Printful</strong> &mdash; klaar in je Printful-account, productie nog niet gestart.</li><li><strong>Bevestigd</strong> &mdash; bij Printful in productie.</li><li><strong>Wordt geannuleerd…</strong> / <strong>Geannuleerd</strong> &mdash; bij Printful (in) geannuleerd, of geannuleerd vóór het doorsturen; je SellQo-bestelling blijft ongewijzigd. Een geannuleerde bestelling kan je niet opnieuw doorsturen: moet ze toch gemaakt worden, maak ze dan zelf aan in Printful.</li><li><strong>Annuleren mislukt</strong> &mdash; Printful kon niet meer annuleren; kijk in Printful.</li><li><strong>Mislukt</strong> &mdash; doorsturen lukte niet of SellQo hield de bestelling tegen. De reden staat erbij; met <strong>Opnieuw proberen</strong> stuur je ze na een correctie door.</li></ul><h2>Meldingen: je hoort het meteen als er iets scheelt</h2><p>Bij elk probleem krijg je een <strong>dringende melding</strong> in SellQo, als pushbericht op je toestel en per mail: een bestelling die niet doorgestuurd is of die SellQo tegenhoudt, een bestelling die Printful laat mislukken, on hold zet (vaak een betaalprobleem in je Printful-account) of zelf annuleert, en een annulering die niet meer lukte. Kreeg een automatische doorsturing na 15 minuten nog geen antwoord, dan krijg je ook een melding. Je stelt deze meldingen in bij <strong>Instellingen &rarr; Winkel Notificaties &rarr; SellQo Connect</strong>.</p><h2>Automatische verzendupdates</h2><p>Zodra Printful je bestelling verzendt, komen trackingnummer, trackinglink en vervoerder automatisch in SellQo binnen. De bestelling gaat naar <strong>Verzonden</strong> en je klant krijgt de gewone verzendmail, tenzij je die melding zelf uitzette.</p><h2>Verbinding verbreken</h2><p>Klik op <strong>Verbinding verbreken</strong> in het instellingenvenster. Je token wordt verwijderd en de koppeling gaat uit. Je variant-koppelingen blijven bewaard.</p><h2>Wie mag dit instellen?</h2><p>Alleen een winkelbeheerder kan de Printful-verbinding maken, wijzigen of verbreken, en een bestelling bij Printful annuleren. Een medewerker kan bestellingen doorsturen.</p>$doc$,
  ARRAY['printful','print on demand','fulfilment','pod','connect','automatisch doorsturen','annuleren'],
  '/admin/connect', 0, true
)
ON CONFLICT (doc_level, slug) DO UPDATE
  SET title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, content = EXCLUDED.content,
      tags = EXCLUDED.tags, updated_at = now();
