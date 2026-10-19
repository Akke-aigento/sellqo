-- MAIL-1a — helpartikel "E-mailcampagnes versturen" herschreven naar de nieuwe werking
-- (wachtrij, inplannen, testmail, limiet per plan, double opt-in, uitschrijven).
-- Idempotent (UPDATE op de bestaande rij; die heeft al categorie Marketing).
-- Eerste versie (INSERT ... ON CONFLICT zonder category_id) faalde op de NOT NULL van category_id.
-- Terugdraaien: de vorige inhoud staat in
-- snapshots.platform_20261019_doc_articles_emailcampagnes (gemaakt op 19-10-2026).

update public.doc_articles
   set title = 'E-mailcampagnes versturen',
       excerpt = 'Een nieuwsbrief maken, testen, inplannen en versturen naar je ingeschreven klanten.',
       content = $html$
<h2>Wie krijgt je campagne?</h2>
<p>Alleen klanten die zich <strong>zelf ingeschreven</strong> hebben op je nieuwsbrief. Wie iets bestelt, is niet vanzelf ingeschreven. Wie zich uitschrijft, een adres heeft dat niet bestaat of een klacht indient, krijgt geen marketing meer.</p>
<p>Inschrijven via je webshop gebeurt met <strong>bevestiging</strong>: de klant krijgt eerst een mail met een knop om te bevestigen. Pas daarna krijgt die persoon je campagnes en je welkomstmail.</p>

<h2>Een campagne maken</h2>
<ol>
  <li>Ga naar <strong>Marketing → E-mail</strong> en klik op <strong>Nieuwe campagne</strong>.</li>
  <li>Kies een doelgroep: al je ingeschreven klanten, een voorgestelde groep of een eigen segment.</li>
  <li>Schrijf je onderwerp en je tekst. Variabelen zoals de voornaam vul je in met de knop voor variabelen.</li>
  <li>Stuur eerst een <strong>testmail</strong> naar jezelf. Die ziet er precies uit zoals je klanten hem krijgen.</li>
</ol>

<h2>Versturen of inplannen</h2>
<p>Klik je op <strong>Nu verzenden</strong>, dan zie je eerst naar hoeveel mensen de campagne gaat en hoeveel marketingmails je deze maand nog kan versturen. Na je bevestiging wordt de campagne in de achtergrond verstuurd. De status springt op <em>Wordt verstuurd</em> en daarna op <em>Verzonden</em>.</p>
<p>Plan je een campagne in, dan vertrekt ze vanzelf op het gekozen moment.</p>

<h2>Hoeveel mails mag ik versturen?</h2>
<p>Elk plan heeft een aantal marketingmails per maand. Gaat een campagne daarover, dan zegt SellQo dat vóór het versturen. Je kan dan je doelgroep verkleinen of je plan upgraden.</p>

<h2>Afzender</h2>
<p>Je campagnes vertrekken met de naam van je winkel. Antwoorden komen in je eigen klantcontact-e-mail of in je SellQo-inbox. Heeft je winkel nog geen geldig mailadres, stel het dan in bij <strong>Instellingen → Email Inbox</strong>.</p>
$html$,
       context_path = '/admin/marketing',
       updated_at = now()
 where doc_level = 'tenant' and slug = 'emailcampagnes';
