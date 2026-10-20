-- MAIL-3 — herstel-link verlaten winkelwagen: scan sluit herstelde mandjes uit + helpartikel.
-- Go van Akke 20-10-2026 08:20 op docs/voorstel-mail-cart-herstel.md (alle aanbevelingen §5).
-- Zie docs/role-audit.md MAIL-3.
--
-- 1. automation_scan_triggers: exact de live definitie (pg_get_functiondef 20-10, identiek aan
--    20261019230000 §9; md5(prosrc) 36b2440899ae727f484503be7341b706) met één regel erbij:
--    `and sc.session_id not like 'restore:%'`. Een mandje dat storefront-api `cart_restore`
--    maakte (session_id 'restore:<run_id>') krijgt dus geen tweede herinnering (beslissing 5).
--    CREATE OR REPLACE behoudt eigenaar en grants (enkel service_role, zie 20261019230000).
-- 2. doc_articles 'email-automations': uitleg over de knop naar het winkelmandje.
--
-- Idempotent: CREATE OR REPLACE en INSERT ... ON CONFLICT (doc_level, slug) DO UPDATE.
-- Geen tabel- of kolomwijziging, geen cron.
--
-- Terugdraaien (handmatig, er is geen DOWN):
--   §9 (create or replace function public.automation_scan_triggers ...) en §14 (helpartikel)
--   uit 20261019230000_mail_2a_automations.sql opnieuw draaien. Dat zet de scan en het artikel
--   terug op de versie van vóór MAIL-3. Herstelde mandjes kunnen daarna wel een herinnering krijgen.

-- ── 1. Scan: herstelde mandjes uitsluiten ────────────────────────────────────
create or replace function public.automation_scan_triggers()
returns jsonb
language plpgsql volatile security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  a record;
  c record;
  v_days integer;
  v_delay interval;
  v_winback integer := 0;
  v_carts integer := 0;
begin
  for a in
    update public.email_automations ea set last_scanned_at = now()
     where ea.is_active is true and ea.preset_key = 'win_back'
       and (ea.last_scanned_at is null or ea.last_scanned_at < now() - interval '20 hours')
    returning ea.id, ea.tenant_id, ea.trigger_config, ea.cooldown_hours
  loop
    v_days := least(365, greatest(30, coalesce(nullif(a.trigger_config->>'days', '')::integer, 90)));
    for c in
      select cu.id, cu.email from public.customers cu
       where cu.tenant_id = a.tenant_id and cu.email_subscribed is true
         and coalesce(cu.total_orders, 0) >= 1 and coalesce(trim(cu.email), '') <> ''
         and exists (select 1 from public.orders o
                      where o.customer_id = cu.id and coalesce(o.status::text, '') <> 'cancelled')
         and not exists (select 1 from public.orders o
                          where o.customer_id = cu.id and coalesce(o.status::text, '') <> 'cancelled'
                            and o.created_at >= now() - make_interval(days => v_days))
         -- Review-fix: wie binnen de cooldown al een run had, valt hier al weg, zodat de scan
         -- niet elke keer op dezelfde eerste 500 blijft hangen.
         and not exists (select 1 from public.automation_runs r
                          where r.automation_id = a.id and r.recipient_email = lower(trim(cu.email))
                            and r.status not in ('skipped', 'cancelled')
                            and r.created_at > now() - make_interval(hours => greatest(720, coalesce(a.cooldown_hours, 0))))
       order by cu.id
       limit 500
    loop
      if public.schedule_automation_run_v2(a.tenant_id, 'customer_inactive', null, 'customer', c.email, c.id,
                                           jsonb_build_object('days', v_days)) is not null then
        v_winback := v_winback + 1;
      end if;
    end loop;
  end loop;

  for a in
    update public.email_automations ea set last_scanned_at = now()
     where ea.is_active is true and ea.preset_key = 'abandoned_cart'
       and (ea.last_scanned_at is null or ea.last_scanned_at < now() - interval '5 minutes')
    returning ea.id, ea.tenant_id
  loop
    select make_interval(hours => coalesce(s.delay_hours, 0), mins => coalesce(s.delay_minutes, 0)) into v_delay
      from public.automation_steps s
     where s.automation_id = a.id and s.is_active is not false order by s.step_order limit 1;
    if v_delay is null then continue; end if;
    if v_delay < interval '30 minutes' then v_delay := interval '30 minutes'; end if;

    for c in
      select sc.id, sc.customer_email, sc.created_at, sc.updated_at, sc.locale
        from public.storefront_carts sc
       where sc.tenant_id = a.tenant_id and sc.checkout_status = 'checkout'
         -- MAIL-3: een mandje uit de herstel-link krijgt geen eigen herinnering (beslissing 5).
         and sc.session_id not like 'restore:%'
         and coalesce(trim(sc.customer_email), '') <> ''
         and sc.updated_at <= now() - v_delay
         and sc.updated_at > now() - v_delay - interval '48 hours'
         and sc.expires_at > now()
         and not exists (
           select 1 from public.orders o
            where o.tenant_id = sc.tenant_id
              and lower(trim(o.customer_email)) = lower(trim(sc.customer_email))
              and o.created_at >= sc.created_at
              and coalesce(o.status::text, '') <> 'cancelled')
         and not exists (
           select 1 from public.automation_runs r
            where r.automation_id = a.id and r.trigger_entity_id = sc.id)
       order by sc.updated_at
       limit 200
    loop
      if public.schedule_automation_run_v2(a.tenant_id, 'cart_abandoned', c.id, 'cart', c.customer_email, null,
                                           jsonb_build_object('locale', c.locale), c.updated_at) is not null then
        v_carts := v_carts + 1;
      elsif public.automation_consent(a.tenant_id, c.customer_email, 'cart_abandoned') not in ('subscribed', 'soft_optin') then
        -- Review-fix: geen toestemming → een 'skipped'-run, zodat dit mandje niet bij elke scan
        -- opnieuw beoordeeld wordt (de NOT EXISTS hierboven telt elke status).
        insert into public.automation_runs (automation_id, tenant_id, trigger_entity_id, trigger_entity_type,
                                            status, current_step, recipient_email, completed_at, error_message)
        values (a.id, a.tenant_id, c.id, 'cart', 'skipped', 0, lower(trim(c.customer_email)), now(),
                'Geen toestemming voor marketingmail.')
        on conflict (automation_id, trigger_entity_id) where trigger_entity_id is not null do nothing;
      end if;
    end loop;
  end loop;

  return jsonb_build_object('win_back', v_winback, 'abandoned_cart', v_carts);
end $$;

-- ── 2. Helpartikel email-automations bijwerken ──────────────────────────────
insert into public.doc_articles (doc_level, category_id, context_path, title, slug, excerpt, content, sort_order)
values (
  'tenant',
  'a0000001-0000-0000-0000-00000000000b',
  '/admin/marketing/automations',
  'Automatische e-mails (automatiseringen)',
  'email-automations',
  'Welkomstreeks, bedankmail en reviewvraag na een aankoop, win-back en verlaten winkelwagen: zo zet je ze aan en pas je ze aan.',
  $html$
<h2>Wat zijn automatiseringen?</h2>
<p>Automatiseringen zijn marketingmails die vanzelf vertrekken na iets wat een klant doet. Je vindt ze in <strong>Marketing → Automatiseringen</strong>. Er zijn vier automatiseringen, en ze staan standaard <strong>uit</strong>:</p>
<ul>
  <li><strong>Welkomstreeks</strong>: twee mails nadat een nieuwe abonnee zijn inschrijving op je nieuwsbrief bevestigde via de bevestigingsmail (dubbele opt-in, standaard in elke winkel), meteen en na 3 dagen.</li>
  <li><strong>Na aankoop</strong>: een bedankmail 1 dag na een betaalde bestelling en een reviewvraag na 14 dagen.</li>
  <li><strong>Win-back</strong>: één mail naar klanten die al een tijd (standaard 90 dagen) niets meer bestelden. Dezelfde klant krijgt die mail hooguit eens per 180 dagen.</li>
  <li><strong>Verlaten winkelwagen</strong>: één herinnering als iemand zijn gegevens invulde bij het afrekenen maar niet bestelde (standaard na 1 uur). In een SellQo-webshop opent de knop in die mail het winkelmandje opnieuw (zie hieronder).</li>
</ul>

<h2>Wie krijgt ze?</h2>
<p>De welkomstreeks, de mails na aankoop en de win-back gaan enkel naar klanten die ingeschreven zijn op je nieuwsbrief. De herinnering voor een verlaten winkelwagen gaat naar ingeschreven klanten en naar klanten die eerder al iets bij je kochten in je webshop. Wie zich uitschreef of in zijn mailvoorkeuren alles uitzette, krijgt nooit een automatische mail. Elke mail heeft een afmeldlink.</p>
<p>Voor de herinnering bij een verlaten winkelwagen ben jij als winkel verantwoordelijk dat dit in je privacyverklaring staat.</p>

<h2>Teksten aanpassen</h2>
<p>Klik bij een automatisering op een stap om het onderwerp en de tekst aan te passen, per taal. Het voorbeeld toont de mail in je huisstijl. Naast de gewone variabelen kan je onder meer <code>{{order_number}}</code> (bestelnummer), <code>{{shop_url}}</code> (link naar je winkel), <code>{{cart_items}}</code> (producten in het winkelmandje), <code>{{cart_url}}</code> (link naar het winkelmandje) en <code>{{review_url}}</code> (link naar je reviewpagina) gebruiken.</p>
<p>Had je al een eigen welkomstmail ingeschakeld? Die staat als eerste mail in de welkomstreeks. Zolang de welkomstreeks uit staat, blijft je oude welkomstmail vertrekken. Zet je de reeks aan, dan krijgt een nieuwe abonnee enkel de reeks.</p>

<h2>De knop naar het winkelmandje</h2>
<p>Draait je winkel op de SellQo-webshop (op <code>jouwwinkel.sellqo.shop</code> of op je eigen domein), dan opent de knop in de herinnering een nieuw winkelmandje met dezelfde producten. De link werkt 7 dagen. Je klant ziet de prijs en de voorraad van dat moment en vult zijn gegevens, kortingscode en verzendkeuze opnieuw in. Zo komen de gegevens van je klant nooit terecht bij iemand die de mail doorgestuurd kreeg.</p>
<p>Niet alles komt mee: tickets met een vaste plaats in de zaal (je klant kiest zijn plaatsen opnieuw), producten met extra's, cadeaubonnen en producten die intussen uitverkocht of niet meer online zijn. Je klant ziet welke producten niet meekwamen en waarom.</p>
<p>Had je klant intussen al een ander winkelmandje met producten, dan kiest hij zelf welk mandje hij houdt. Bestelde hij intussen al, dan meldt de pagina dat de bestelling binnen is. Een winkelmandje dat via deze link terugkwam, krijgt geen tweede herinnering.</p>
<p>Heb je een eigen webshop buiten het SellQo-thema, dan gaat de knop zoals voorheen naar je winkel.</p>

<h2>De reviewvraag</h2>
<p>De reviewmail linkt naar je Google- of Trustpilot-profiel. Koppel dat eerst in <strong>Instellingen → Reviews</strong> en vul de profiel-URL in. Zonder gekoppeld profiel wordt de reviewmail overgeslagen.</p>

<h2>Limiet en opvolging</h2>
<p>Automatische mails tellen mee voor je maandelijkse limiet aan marketingmails. Is je limiet bereikt, dan wordt de mail niet verstuurd en krijg je een melding. In het logboek onder elke automatisering zie je de laatste 50 verzendingen met hun status.</p>
$html$,
  60
)
on conflict (doc_level, slug) do update
  set category_id = excluded.category_id, context_path = excluded.context_path, title = excluded.title,
      excerpt = excluded.excerpt, content = excluded.content, sort_order = excluded.sort_order, updated_at = now();