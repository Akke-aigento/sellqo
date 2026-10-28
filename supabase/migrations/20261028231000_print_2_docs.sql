-- PRINT-2 — helpartikel "Bonprinters en betaalbewijs" (bon-en-printers, /admin/pos).
-- PAS DRAAIEN NA de migratie 20261028230000 en de publish van de admin. Idempotent (ON CONFLICT DO NOTHING).
-- Handmatig terugdraaien:
--   delete from public.doc_articles where doc_level = 'tenant' and slug = 'bon-en-printers';

insert into public.doc_articles (doc_level, category_id, context_path, slug, title, excerpt, content, sort_order, is_published, tags)
values ('tenant', 'a0000001-0000-0000-0000-000000000006', '/admin/pos', 'bon-en-printers',
  'Bonprinters en betaalbewijs (afdrukken en mailen)',
  'Koppel een Star-bonprinter, kies per post welke printer de bonnen afdrukt, en stel in of het betaalbewijs afgedrukt of gemaild wordt.',
  $c$
<p>Alles over afdrukken en de bon staat op één plek: <strong>Kassa (POS) › Bon &amp; printers</strong>.</p>

<h2>Een printer koppelen</h2>
<p>SellQo werkt met <strong>Star-bonprinters met CloudPRNT</strong>, bijvoorbeeld de mC-Print3 of de TSP143IV. Zo'n printer haalt zelf zijn bonnen op bij SellQo. Er hoeft dus geen tablet of pc aan te staan, en een printer die even geen verbinding had, drukt daarna alles na.</p>
<ol>
  <li>Tik op <em>Printer toevoegen</em>, geef hem een naam (bv. Keuken of Bar) en kies het papier (80 mm of 58 mm) en de taal op de bon.</li>
  <li>Je krijgt een server-URL, een gebruikersnaam en een wachtwoord. Open de instellingenpagina van de printer (typ zijn IP-adres in een browser, dat staat op de zelftest-afdruk), ga naar <em>CloudPRNT</em>, zet het aan en vul die gegevens in. Kies als pollinterval 5 seconden.</li>
  <li>Sla op en herstart de printer. In SellQo staat hij daarna op <em>Verbonden</em>. Doe dan een <em>Testafdruk</em>.</li>
</ol>
<p>Het wachtwoord zie je maar één keer. Ben je het kwijt, kies dan <em>Nieuwe sleutel</em> en vul het nieuwe wachtwoord in op de printer; het oude werkt dan niet meer. Een printer die je niet meer gebruikt, zet je <em>uit</em>.</p>

<h2>Welke printer per post</h2>
<p>Kies per post (keuken, bar …) een printer. Elke nieuwe bon van die post komt er meteen uit: rondes van de kassa, QR-bestellingen en webshoporders. Webshoporders gaan naar de standaardpost. Op een keukenbon staan nooit bedragen. Eén printer mag meerdere posten bedienen. De posten zelf maak je in <strong>Bestellen › Posten</strong>.</p>

<h2>Bon na afrekenen</h2>
<p>Dit zijn vaste instellingen voor je zaak. De kassa vraagt er nooit naar bij het afrekenen.</p>
<ul>
  <li><strong>Betaalbewijs afdrukken</strong>: na elke betaling aan de kassa komt het betaalbewijs uit de printer die je kiest.</li>
  <li><strong>Betaalbewijs mailen na online betalen</strong>: betaalt een gast online via de QR-code aan tafel, dan krijgt hij het betaalbewijs op het e-mailadres dat hij bij het betalen opgaf. Daarvoor moet online betalen aan staan in <strong>Kassa (POS) › Betalen</strong>.</li>
  <li><strong>Knop "Mail bon" op het afrekenscherm</strong>: vraagt een klant zijn bon per mail, tik dan na het afrekenen op <em>Mail bon</em> en vul zijn adres in. Het adres wordt niet bewaard. Per betaling kan je de bon hoogstens 3 keer mailen.</li>
</ul>
<p>Het betaalbewijs toont de lijnen, het totaal, de fooi en hoe er betaald werd, met de vermelding <em>Dit is geen geldig btw-kasticket</em>. Werk je met een <strong>geregistreerde kassa</strong> (met een FDM), dan maakt de kassa zelf het btw-kasticket. Betaalbewijs afdrukken of mailen staat dan uit, en het kasticket druk je voorlopig af via het toestel.</p>

<h2>Geen printer?</h2>
<p>Dan werkt alles zoals voordien: de bonnen staan op het keukenscherm, en je kan een bon afdrukken via het toestel.</p>
$c$,
  37, true, array['printer', 'bonprinter', 'star', 'cloudprnt', 'bon', 'betaalbewijs', 'mail', 'horeca'])
on conflict (doc_level, slug) do nothing;
