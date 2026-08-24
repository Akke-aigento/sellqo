-- CUSTAUTH-1 — twee doc-artikelen over e-mailverificatie van storefront-klanten.
--
-- Eén op tenant-niveau (wat de winkelier en zijn klanten merken) en één op
-- platform-niveau (hoe de enforcement precies werkt). Beide voeden de AI-helpchat
-- en de contextuele hulp.
--
-- Idempotent: ON CONFLICT (doc_level, slug) DO UPDATE.
--
-- Handmatig terugdraaien:
--   DELETE FROM public.doc_articles WHERE doc_level = 'tenant'   AND slug = 'klant-e-mailverificatie';
--   DELETE FROM public.doc_articles WHERE doc_level = 'platform' AND slug = 'storefront-klant-verificatie-enforcement';
--
-- CATEGORIEKEUZE — controleren vóór het draaien.
-- Tenant: Webshop (a0000001-0000-0000-0000-000000000006). Er is geen categorie
-- "Klantaccounts". In latere migraties duiken twee tenant-categorie-id's op die
-- nergens in de repo geseed zijn (…009 en …00c, die laatste in account/login-context);
-- als …00c inderdaad een account-categorie is, is dát de betere keuze. Draai eerst:
--   SELECT id, doc_level, title, slug FROM public.doc_categories ORDER BY doc_level, sort_order;
-- Platform: Storefront API Referentie (b0000001-0000-0000-0000-000000000001). Er is
-- geen platform-categorie voor security; deze staat er het dichtst bij, en conform
-- het precedent uit 20260824100000_i18n4_doc_article.sql maken we er geen nieuwe aan.

INSERT INTO public.doc_articles (doc_level, category_id, context_path, title, slug, excerpt, content, sort_order)
VALUES
(
  'tenant',
  'a0000001-0000-0000-0000-000000000006',
  '/admin/customers',
  'Klanten bevestigen hun e-mailadres',
  'klant-e-mailverificatie',
  'Wat er verandert voor klanten met een account in je webshop, en wat je doet als iemand de bevestigingsmail niet ontvangt.',
  '<p>Klanten die een account aanmaken in je webshop krijgen voortaan een <strong>bevestigingsmail</strong>. Pas als ze daarin op de knop klikken, kunnen ze hun bestelgeschiedenis inzien.</p>
<h3>Wat de klant merkt</h3>
<ul>
<li>Registreren gaat zoals altijd: het account wordt aangemaakt en de klant is meteen ingelogd.</li>
<li>Winkelen, bestellen en afrekenen werken direct — daar verandert niets.</li>
<li>Alleen het overzicht <em>Mijn bestellingen</em> blijft afgeschermd tot het e-mailadres bevestigd is.</li>
<li>De bevestigingslink is 48 uur geldig.</li>
</ul>
<h3>Waarom deze stap er is</h3>
<p>Bestellingen worden aan een klant gekoppeld op e-mailadres. Ook bestellingen die iemand als gast plaatste, dus zónder account. Zonder bevestiging zou iemand een account kunnen aanmaken op andermans e-mailadres en daarmee diens eerdere bestellingen zien — inclusief adres en artikelen. De bevestiging sluit dat af.</p>
<h3>Bestaande klanten</h3>
<p>Klanten die vóór deze wijziging al een account hadden, hoeven niets te doen. Zij zijn eenmalig als bevestigd gemarkeerd en houden gewoon toegang tot hun bestellingen.</p>
<h3>De klant kreeg de mail niet</h3>
<p>Laat de klant in zijn spammap kijken. Helpt dat niet, dan kan hij de mail opnieuw laten sturen vanuit zijn account. Is de link verlopen, dan levert opnieuw versturen een verse link op. Blijft het misgaan, neem dan contact op via de helpfunctie — vermeld het e-mailadres en het tijdstip, dan is het in de verzendlogboeken terug te vinden.</p>
<h3>Wat je zelf kunt zien</h3>
<p>In het klantenoverzicht in je admin zie je welke klanten uit je webshop komen. Of een adres bevestigd is, wordt daar op dit moment nog niet getoond; dat is een verbeterpunt.</p>',
  10
),
(
  'platform',
  'b0000001-0000-0000-0000-000000000001',
  '/admin/help',
  'Storefront-klantverificatie: enforcement en URL-resolutie',
  'storefront-klant-verificatie-enforcement',
  'Hoe storefront-customer-api e-mailverificatie afdwingt op de order-endpoints, en hoe de basis-URL voor klantmails wordt bepaald.',
  '<p>Deze notitie beschrijft het gedrag van de edge function <code>storefront-customer-api</code> na CUSTAUTH-1. Bedoeld voor wie een custom frontend bouwt of een supportvraag moet narekenen.</p>
<h3>Verificatie afdwingen</h3>
<p>De acties <code>get_orders</code> en <code>get_order</code> weigeren zodra de klant <code>email_verified = false</code> heeft. De response is <strong>HTTP 403</strong> met <code>{ "success": false, "error": "EMAIL_NOT_VERIFIED" }</code>. Er wordt in dat geval géén order-query uitgevoerd. Alle andere acties — inloggen, profiel, adressen, verlanglijst, wachtwoord — blijven onveranderd bereikbaar.</p>
<p>Een frontend hoort op die code te controleren en de klant naar een "bevestig je e-mailadres"-scherm te sturen, met een knop die <code>resend_verification</code> aanroept.</p>
<h3>De grens voor bestaande accounts</h3>
<p>Accounts van vóór de invoering zijn in één migratie op <code>email_verified = true</code> gezet. De grens is een vaste timestamp, geen <code>now()</code>: met <code>now()</code> zou een tweede uitvoering ook accounts van ná de invoering vrijstellen en daarmee de hele controle uithollen.</p>
<h3>Tokens</h3>
<p>Het verificatietoken is een HMAC-token met <code>purpose: "email_verification"</code> en 48 uur geldigheid, opgeslagen in <code>email_verification_token</code> met een aparte vervaldatum in de database. Bij <code>verify_email</code> worden vier dingen gecontroleerd: de handtekening, het doel, of het e-mailadres in het token overeenkomt, en of het token gelijk is aan wat er in de database staat en nog niet verlopen is. Daarna worden token en vervaldatum leeggemaakt, zodat een link maar één keer werkt.</p>
<p>Tokens met een <code>purpose</code> gelden niet als sessietoken. Een herstel- of verificatielink kan dus niet als inlogtoken worden gebruikt.</p>
<h3>Basis-URL voor links in klantmails</h3>
<p>Voor zowel de verificatie- als de herstelmail wordt de basis-URL in deze volgorde bepaald:</p>
<ol>
<li><code>url_base</code> uit de request — maar alleen als de host bij deze winkel hoort: bevestigd in de domeinenlijst van de winkel, gelijk aan het ingestelde eigen domein, of een <code>lovable.app</code>-preview. Alleen <code>https</code>.</li>
<li>Het eigen domein van de winkel, als dat is ingesteld.</li>
<li>Het oude <code>sellqo.lovable.app/shop/{slug}</code>-pad, met een waarschuwing in de logs.</li>
</ol>
<p>Die controle in stap 1 is er niet voor de vorm. De functie draait zonder JWT-verificatie, dus iedereen kan haar aanroepen met een willekeurig e-mailadres. Zou <code>url_base</code> ongefilterd worden overgenomen, dan kan een aanvaller SellQo een mail met eigen huisstijl én eigen link laten versturen. Een geweigerde <code>url_base</code> wordt gelogd en genegeerd; de mail vertrekt dan met de terugvallende URL.</p>
<h3>Routes die de storefront zelf moet aanbieden</h3>
<p><code>/account/verify?token=…&amp;email=…</code> en <code>/account/reset?token=…&amp;email=…</code>. Beide roepen de bijbehorende actie aan met dezelfde parameters uit de querystring.</p>',
  10
)
ON CONFLICT (doc_level, slug) DO UPDATE
SET category_id  = EXCLUDED.category_id,
    context_path = EXCLUDED.context_path,
    title        = EXCLUDED.title,
    excerpt      = EXCLUDED.excerpt,
    content      = EXCLUDED.content,
    sort_order   = EXCLUDED.sort_order;
