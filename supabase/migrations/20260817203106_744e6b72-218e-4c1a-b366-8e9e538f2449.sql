INSERT INTO public.doc_articles (category_id, doc_level, title, slug, context_path, is_published, sort_order, tags, excerpt, content)
SELECT 'a0000001-0000-0000-0000-000000000003', 'tenant', 'PayPal koppelen', 'paypal-koppelen', '/admin/settings', true, 2,
ARRAY['paypal','betaling','stripe','checkout'],
'Zo activeer je PayPal als extra betaalmethode via je Stripe-account.',
'<h2>PayPal koppelen</h2>
<p>PayPal is beschikbaar als extra betaalmethode in je webshop. Anders dan iDEAL of Bancontact activeer je PayPal <strong>eenmalig zelf</strong> in je eigen Stripe Dashboard. Zodra dat geregeld is, verschijnt PayPal automatisch in je checkout — je hoeft in SellQo verder niets aan te zetten.</p>
<h3>Waarom een extra stap?</h3>
<p>PayPal werkt via een aparte overeenkomst tussen jouw bedrijf en PayPal. Stripe kan dit niet namens jou regelen; die toestemming geef je zelf. Daarom activeer je PayPal in je Stripe Dashboard, niet in SellQo.</p>
<h3>Zo activeer je PayPal</h3>
<ol>
<li>Ga naar <strong>Instellingen → Betalingen</strong> en klik op <strong>Stripe Dashboard openen</strong>.</li>
<li>Klik in Stripe op <strong>Instellingen</strong> (tandwiel rechtsboven) en kies <strong>Betaalmethodes</strong>.</li>
<li>Zoek <strong>PayPal</strong> onder de sectie Wallets. Er staat waarschijnlijk "Actie vereist" of "Activeren" naast.</li>
<li>Klik op PayPal en volg de stappen. Stripe vraagt je akkoord met de voorwaarden en stuurt de aanvraag door naar PayPal. Mogelijk neemt PayPal contact met je op om de activatie af te ronden.</li>
<li>Zodra PayPal je activatie goedkeurt, wordt de methode actief op je Stripe-account. Dit kan van enkele minuten tot enkele dagen duren.</li>
<li>Ga terug naar <strong>Instellingen → Betalingen</strong> in SellQo en klik op <strong>Status vernieuwen</strong>. PayPal verschijnt nu automatisch in je betaalmethodes én je checkout.</li>
</ol>
<h3>Veelgestelde vragen</h3>
<p><strong>PayPal verschijnt nog niet in mijn checkout.</strong> Klik op "Status vernieuwen". Staat PayPal in Stripe nog op "Actie vereist", dan is de activatie nog niet volledig afgerond bij PayPal.</p>
<p><strong>Kan ik PayPal tijdelijk uitzetten?</strong> Ja — schakel PayPal uit in je Stripe Dashboard. SellQo volgt automatisch en haalt het uit je checkout bij de volgende statusvernieuwing.</p>'
WHERE NOT EXISTS (
  SELECT 1 FROM public.doc_articles WHERE doc_level = 'tenant' AND slug = 'paypal-koppelen'
);