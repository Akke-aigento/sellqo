-- MELDING-1 — helpartikel "Meldingen per toestel" (meldingen-per-toestel, /admin/pos).
-- PAS DRAAIEN NA de migratie 20261028180000 en de publish van de admin. Idempotent (ON CONFLICT DO NOTHING).
-- Handmatig terugdraaien:
--   delete from public.doc_articles where doc_level = 'tenant' and slug = 'meldingen-per-toestel';

insert into public.doc_articles (doc_level, category_id, context_path, slug, title, excerpt, content, sort_order, is_published)
values ('tenant', 'a0000001-0000-0000-0000-000000000006', '/admin/pos', 'meldingen-per-toestel',
  'Meldingen per toestel: kassa, keuken en bar',
  'Elk toestel in de zaak krijgt enkel wat het nodig heeft: QR-bestellingen, nieuwe en klare bonnen, online betalingen. Ook als het scherm dicht is.',
  $c$
<p>In een horecazaak staan meerdere toestellen: een kassa, een keukenscherm, misschien een barscherm en je eigen gsm. Elk toestel krijgt enkel de meldingen die het nodig heeft. Die meldingen komen <strong>niet in je belletje</strong>: op een drukke avond zouden het er honderden zijn.</p>

<h2>Welke meldingen</h2>
<ul>
  <li><strong>QR-bestelling wacht op bevestiging</strong>: een gast bestelde via de QR-code op tafel.</li>
  <li><strong>Nieuwe bon</strong>: voor alle posten of enkel voor de posten die je kiest (bv. enkel de bar). Nieuwe bonnen van dezelfde post komen samen in één melding (<em>Keuken: 3 nieuwe bonnen</em>).</li>
  <li><strong>Bon is klaar</strong>: de keuken of bar zette een bon op <em>klaar</em>.</li>
  <li><strong>Gast betaalde online</strong>: een gast betaalde de rekening (of een deel) via de QR-code.</li>
</ul>

<h2>Een toestel toevoegen</h2>
<p>Dat doe je op het toestel zelf, want het toestel moet toestemming geven:</p>
<ul>
  <li><strong>Kassa</strong>: tik in de kopbalk op het belletje en kies <em>Meldingen aanzetten</em>. Standaard krijgt de kassa QR-bestellingen, klare bonnen en online betalingen.</li>
  <li><strong>Keuken- of barscherm</strong>: kies eerst de post bovenaan, tik dan op het belletje met de golfjes en kies <em>Meldingen aanzetten</em>. Het scherm krijgt dan elke nieuwe bon voor die post.</li>
  <li><strong>Je gsm</strong>: open SellQo, ga naar <strong>Kassa (POS) › Kassa's</strong> en kies <em>Dit toestel toevoegen</em>.</li>
</ul>
<p><strong>iPhone en iPad</strong>: meldingen werken daar enkel vanuit de app op het beginscherm. Open de kassa (of het keukenscherm) in Safari, tik op <em>Deel</em> en dan op <em>Zet op beginscherm</em>. Je krijgt dan een app <em>SellQo Kassa</em> of <em>SellQo Keuken</em>. Open die, meld je aan en zet daar de meldingen aan. Met de SellQo-app uit de App Store of Play Store hoeft dat niet.</p>

<h2>Aanpassen wat een toestel krijgt</h2>
<p>Alle toestellen staan op één plek: <strong>Kassa (POS) › Kassa's</strong>, onder <em>Meldingen per toestel</em>. Per toestel kies je de naam, het soort toestel, welke meldingen het krijgt en voor welke posten. Je ziet er ook of het toestel nog bereikbaar is.</p>
<p><strong>Persoonlijke meldingen</strong>: dat zijn de meldingen van wie op het toestel aangemeld is (facturen, webshopbestellingen …). Op een gedeelde kassa of een keukenscherm staan ze standaard uit, zodat je personeel jouw facturen niet ziet. Op je eigen gsm staan ze aan. Welke persoonlijke meldingen je krijgt, kies je zoals altijd onder <strong>Instellingen › Mijn meldingen</strong>.</p>

<h2>Op het open scherm</h2>
<ul>
  <li><strong>Geluid</strong>: de kassa en het keukenscherm geven een belletje (en trillen, als het toestel dat kan) bij iets nieuws. Een browser speelt pas geluid na een eerste tik op het scherm; tik dus één keer op het scherm na het openen.</li>
  <li><strong>Scherm wakker houden</strong>: staat standaard aan, zodat de kassa en het keukenscherm niet in slaap vallen. Hou het toestel aan de lader. Kan het toestel het niet, zet dan de automatische vergrendeling uit in de instellingen van het toestel.</li>
</ul>

<h2>Werkt het niet?</h2>
<ul>
  <li>Staat bij het toestel <em>Geen actieve push-inschrijving</em>? Open SellQo op dat toestel en zet de meldingen opnieuw aan.</li>
  <li>Blokkeerde je ooit de meldingen voor SellQo? Zet ze terug aan in de instellingen van de browser of het toestel.</li>
  <li>Wie uit je team verwijderd wordt, krijgt op zijn toestellen geen meldingen van de zaak meer.</li>
</ul>
$c$, 36, true)
on conflict (doc_level, slug) do nothing;
