-- MEDIA-3 + SOCIAL-SEC-1 (16-10-2026) — twee helpartikels bijgewerkt (doc_level tenant):
--   * social-planning-goedkeuren: "Opnieuw maken" met kost in AI-credits, limieten en de
--     toegelaten statussen; nieuw blok "Een post laten maken vanuit je mediabibliotheek".
--   * productfotos-mediabibliotheek-fotostandaard: tab Merk, tagfilter, detailweergave.
-- Geen platforminformatie (de pijplijn heet voor de tenant "je contentteam").
--
-- Vereist: de frontend van MEDIA-3/SOCIAL-SEC-1 gepubliceerd (anders beschrijft het artikel
-- knoppen die nog niet bestaan). Het artikel vermeldt de credits en limieten uit
-- 20261016210000; draai dit dus ná die migratie.
--
-- Snapshot vóór het draaien (aparte aanroep, zie docs/prepared/MEDIA-3-SOCIAL-SEC-1-deploy.md):
--   create table if not exists snapshots.sellqo_20261016_doc_articles_m3 as
--   select * from public.doc_articles
--   where doc_level = 'tenant' and slug in ('social-planning-goedkeuren', 'productfotos-mediabibliotheek-fotostandaard');
-- Verwachte md5(content) na het draaien:
--   social-planning-goedkeuren                    42b6ea8f0f74fd744c592d9f8ed8898e
--   productfotos-mediabibliotheek-fotostandaard   8ac5138bcf896f2b7e311ef2e4a35af1
-- (vóór: 0692948d7a5820d1b83652cbd07045c0 resp. 971884dfaf295cf2232b06ecd9bed420, live 16-10)
--
-- Idempotent: ON CONFLICT (doc_level, slug) DO UPDATE.
-- Handmatig terugdraaien: content terugzetten uit de snapshot, of
-- 20261015230100_social_4c_doc_article.sql en 20261016201000_media_2_doc_article.sql opnieuw draaien.

INSERT INTO public.doc_articles (doc_level, category_id, context_path, title, slug, excerpt, content, sort_order)
VALUES
(
  'tenant',
  'a0000001-0000-0000-0000-00000000000b',
  '/admin/marketing/social',
  'Social planning: posts goedkeuren',
  'social-planning-goedkeuren',
  'Zo keur je je geplande posts goed, pas je ze aan of schrap je ze, en wat er gebeurt na goedkeuring.',
  $html$<h2>Social planning: posts goedkeuren</h2>
<p>Onder <strong>Marketing &rarr; Social planning</strong> staan al je geplande posts, per week. Elke post toont het beeld zoals het op Instagram verschijnt, de tekst, het uur en de status.</p>

<h3>Goedkeuren</h3>
<ul>
<li><strong>Goedkeuren</strong> op een post keurt die ene post goed.</li>
<li><strong>Week goedkeuren</strong> bovenaan een week keurt in één keer alle posts goed die in die week nog wachten.</li>
<li>Een goedgekeurde post gaat vanzelf online in de eerste minuten na het geplande uur. Je hoeft SellQo daarvoor niet open te hebben.</li>
<li>Is het geplande uur al voorbij, dan gaat de post binnen het uur na je goedkeuring online.</li>
<li><strong>Nu posten</strong> zet een post meteen online, zonder op het geplande uur te wachten, en keurt hem daarmee goed. Lukt het niet meteen (bijvoorbeeld omdat Instagram een video nog verwerkt), dan probeert SellQo het binnen het uur opnieuw. Stories met een sticker en reels met je eigen muziek post je zelf.</li>
</ul>

<h3>Aanpassen en schrappen</h3>
<p>Met <strong>Aanpassen</strong> wijzig je de tekst, de datum en het uur. Met het vuilbakje schrap je een post: hij verdwijnt uit de planning en wordt niet gepubliceerd. Een post die al online staat of op dat moment gepubliceerd wordt, kun je niet meer schrappen.</p>

<h3>Mislukt</h3>
<p>Lukt een post niet, dan staat hij op <strong>Mislukt</strong> met de reden erbij. Los de oorzaak op (bijvoorbeeld Instagram opnieuw koppelen in SellQo Connect) en kies <strong>Opnieuw inplannen</strong>: de post wordt dan opnieuw goedgekeurd voor het uur dat je kiest.</p>

<h3>Bekijken en downloaden</h3>
<p>Onder het beeld van elke post staan <strong>Bekijken</strong> en <strong>Downloaden</strong>. Met Bekijken zie je elk beeld (en bij een reel de video en de cover) groot, met per beeld een eigen knop Downloaden en Openen. Downloaden onder een post met één beeld haalt dat beeld meteen binnen.</p>

<h3>Taal veranderen</h3>
<p>Met <strong>Taal veranderen</strong> kies je een andere taal, bijvoorbeeld Engels voor je internationale volgers. De caption en de tekst in de beelden worden vertaald (dat kost 1 AI-credit); je kijkt alles na, past aan waar nodig en ziet het resultaat voor je bewaart. Bij een reel zit de tekst in de video zelf: dan wordt er een nieuwe versie in die taal gemaakt, zoals bij <strong>Opnieuw maken</strong>. Beelden zonder aanpasbare tekst blijven zoals ze zijn; dat staat erbij.</p>

<h3>Tekst in het beeld aanpassen</h3>
<p>Bij posts en stories die voor je klaargezet zijn, staat een knop <strong>Tekst in beeld</strong>. Je ziet een veld per tekstvak in het beeld (bijvoorbeeld titel, prijs of onderregel) en een voorbeeld dat meeverandert terwijl je typt. Het ontwerp zelf blijft hetzelfde; elk vak heeft een maximumlengte zodat de tekst blijft passen.</p>
<p>Klik op <strong>Volgende</strong>: SellQo maakt het nieuwe beeld en toont het precies zoals het online gaat. Klopt het, klik dan op <strong>Bewaren</strong>; anders ga je <strong>Terug</strong>. De status van de post verandert niet: een goedgekeurde post blijft goedgekeurd en gaat met het nieuwe beeld online. Voor reels kan dit niet; gebruik daar <strong>Opnieuw maken</strong>.</p>

<h3>Reels</h3>
<p>Een reel toont een videovoorbeeld en een <strong>muziekvoorstel</strong>: concrete nummers om in de muziekzoeker van Instagram te zoeken, met de sfeer en het tempo erbij. Niet elk nummer is beschikbaar voor elk account (zakelijke accounts hebben vaak een kleinere muziekbibliotheek); kies er een die je in de app vindt. Je kiest:</p>
<ul>
<li><strong>Goedkeuren (automatisch)</strong>: SellQo post de versie met muziek zelf op het geplande uur. Deze knop verschijnt enkel als er een versie met muziek is.</li>
<li><strong>Ik kies zelf muziek</strong>: de reel komt op <strong>Zelf posten</strong>. Met <strong>Downloaden</strong> haal je de video binnen en met <strong>Caption kopiëren</strong> de tekst. In de Instagram-app kies je een nummer, plak je de tekst en post je. Klik daarna op <strong>Gepost</strong>.</li>
</ul>
<p>Een video mag maximaal 10 MB zijn. Reels publiceert SellQo enkel op Instagram.</p>

<h3>Zelf posten</h3>
<p>Sommige dingen kan Instagram niet automatisch laten plaatsen, zoals een story met een link-, poll- of vraagsticker, of een reel met een nummer uit de Instagram-app. Die staan op <strong>Zelf posten</strong>. Download het beeld of de video, plaats het zelf in de Instagram-app en klik daarna op <strong>Gepost</strong>.</p>
<p>Ongeveer een uur voor het geplande moment krijg je een <strong>melding</strong> (in SellQo en als pushmelding, als die aan staat). De pushmelding zet je aan of uit bij <strong>Instellingen &rarr; Mijn meldingen</strong>, onder Marketing.</p>

<h3>Opnieuw maken</h3>
<p>Bij posts die je contentteam voor je klaarzette, staat een knop <strong>Opnieuw maken</strong>, zolang de post nog op goedkeuring wacht, een concept is, op <strong>Zelf posten</strong> staat of <strong>Mislukt</strong> is. Een goedgekeurde of ingeplande post pas je eerst aan of schrap je. Schrijf er eventueel bij wat er anders moet (bijvoorbeeld "grappiger" of "een andere foto") en kies een <strong>taal</strong> als de nieuwe versie in een andere taal moet, bijvoorbeeld Engels voor je internationale volgers. De taal van een post staat als code naast het platform (bijvoorbeeld EN).</p>
<p>In het venster zie je vooraf wat het kost: <strong>10 AI-credits</strong> voor een post of story, <strong>25 AI-credits</strong> voor een reel. Per post kun je dit hoogstens 3 keer per 24 uur vragen, en per winkel 30 keer per 24 uur. Heb je niet genoeg credits of is de limiet bereikt, dan zie je dat meteen en wordt er niets afgeboekt.</p>
<p>De post krijgt de status <strong>Wordt opnieuw gemaakt</strong> en telt niet mee bij <strong>Week goedkeuren</strong>. Zodra de nieuwe versie klaarstaat, op dezelfde dag en hetzelfde uur, krijg je een melding en keur je hem opnieuw goed.</p>

<h3>Een post laten maken vanuit je mediabibliotheek</h3>
<p>Heeft je winkel een contentteam voor social media, dan vraag je ook een nieuwe post aan met je eigen beelden. Ga naar <strong>Marketing &rarr; AI Content Hub &rarr; Assets</strong>, beweeg over een beeld en klik op het megafoontje (<strong>Maak een post met dit beeld</strong>), of selecteer meerdere beelden (maximaal 10) en kies de knop onderaan. Kies de soort (post, story of reel), eventueel een gewenste datum (tot 90 dagen vooruit), een taal en een opmerking. Je ziet vooraf de kost: 10 AI-credits voor een post of story, 25 voor een reel.</p>
<p>Je kunt tegelijk hoogstens 10 verzoeken open hebben staan, en hoogstens 20 per 24 uur versturen. Het resultaat komt in de Social planning te staan om goed te keuren; er gaat niets online zonder jouw goedkeuring. Zie je de knop niet, dan heeft je winkel geen contentteam gekoppeld.</p>

<h3>Geen koppeling?</h3>
<p>Zie je bovenaan een melding dat er geen Instagram- of Facebook-koppeling is, koppel dan eerst je account in <strong>SellQo Connect &rarr; Kanalen</strong>. Zonder koppeling kan een goedgekeurde post niet online: op het geplande uur komt hij op <strong>Mislukt</strong> te staan en krijg je een melding. Na het koppelen plan je hem opnieuw in.</p>$html$,
  5
)
ON CONFLICT (doc_level, slug) DO UPDATE SET
  title = EXCLUDED.title,
  excerpt = EXCLUDED.excerpt,
  content = EXCLUDED.content,
  context_path = EXCLUDED.context_path,
  updated_at = now();

insert into public.doc_articles (category_id, doc_level, title, slug, excerpt, content, tags, context_path, sort_order, is_published)
values (
  'a0000001-0000-0000-0000-000000000001',
  'tenant',
  'Productfoto''s: mediabibliotheek, fotostandaard en bewerken',
  'productfotos-mediabibliotheek-fotostandaard',
  'Al je foto''s op één plek, elke productfoto automatisch in dezelfde vorm, en gratis bijsnijden, draaien en de achtergrond aanpassen.',
  $doc$<h2>Al je foto's in één mediabibliotheek</h2>
<p>Elke foto die je oplaadt komt automatisch in je mediabibliotheek: in een product, een variant, een categorie of rechtstreeks in de bibliotheek. Ook beelden die je met AI maakt of bewerkt, en de beelden van je social posts, komen erin. Je vindt de volledige bibliotheek onder <strong>Marketing → AI Content Hub → Assets</strong>, met tabs voor producten, categorieën, AI-beelden, social en favorieten.</p>
<p>Bij elke foto zie je op welk product ze staat. Een foto die op een product staat, kun je niet uit de bibliotheek verwijderen: haal ze eerst van het product.</p>
<p>In de tab <strong>Merk</strong> staan je merkmateriaal en sfeerbeelden, zoals je logo of reisfoto's. Hebben je beelden tags, dan verschijnen die als knopjes boven de beelden: klik op een tag om alleen die beelden te zien, of op meerdere tags om beelden te zien die ze allemaal hebben. Met het <strong>i</strong>-icoontje op een beeld zie je de titel, de omschrijving en de tags.</p>
<p>Heeft je winkel een contentteam voor social media, dan zie je op elk beeld ook <strong>Maak een post met dit beeld</strong>. Meer daarover in het artikel over de Social planning.</p>
<p>Onder <strong>Producten → Foto's</strong> zie je bovenaan je <strong>losse foto's</strong>: foto's die op geen enkel product staan, zoals een losse upload of het origineel na het standaardiseren. Daaronder staat het <strong>fotobeheer</strong> met alle foto's die op een product staan. Zo zie je geen foto dubbel.</p>

<h2>Foto's op een externe server</h2>
<p>Heb je producten geïmporteerd uit Shopify, dan worden sommige foto's nog geladen vanaf de server van Shopify. Zeg je dat oude abonnement op, dan verdwijnen ze uit je webshop. In de mediabibliotheek (Assets) zie je dan een gele melding met het aantal. Klik op <strong>Naar eigen opslag halen</strong>: SellQo haalt elke foto één keer op en vervangt het adres in je producten, varianten en categorieën. Het beeld zelf verandert niet. Laat het venster open tot het klaar is; een foto die niet opgehaald kan worden, blijft gewoon staan zoals ze was en staat in de lijst onder de melding.</p>

<h2>Fotostandaard: alle productfoto's in dezelfde vorm</h2>
<p>Elke plek in je webshop heeft een vaste vorm. Een foto in een andere vorm wordt bijgesneden of krijgt lege randen, waardoor producten ongelijk groot ogen. Met de fotostandaard leg je één vorm vast, bijvoorbeeld staand 3:4 op 1200 × 1600 pixels. Je stelt ze in onder <strong>Producten → Foto's → Fotostandaard</strong>:</p>
<ul>
<li><strong>Verhouding en formaat</strong>: de vorm van het resultaat.</li>
<li><strong>Achtergrond</strong>: automatisch (de randkleur van de foto), wit, zwart, transparant of een eigen kleur.</li>
<li><strong>Ruimte rond het product</strong>: hoeveel lege ruimte er rond het product blijft.</li>
<li><strong>Lege rand wegknippen</strong>: werkt alleen bij een effen achtergrond. Het product zelf wordt nooit bijgesneden.</li>
<li><strong>Voorstellen bij uploaden</strong>: voeg je een foto toe aan een product, dan zie je eerst het resultaat naast het origineel en kies je per foto welke versie je gebruikt.</li>
</ul>
<p>Het voorbeeld rechts toont meteen hoe een van je eigen productfoto's eruit zal zien. Staat de fotostandaard uit, dan verandert er niets aan je foto's.</p>
<p>Bestaande foto's zet je in bulk om: kies onder <strong>Fotobeheer</strong> de filter <strong>Afwijkend formaat</strong>, selecteer de foto's en klik op <strong>Standaardiseren</strong>. Het origineel blijft in je mediabibliotheek staan.</p>
<p><strong>Tip:</strong> zet één product per foto. Voor- en achterkant naast elkaar op één beeld passen niet in een staand vak; maak daar twee aparte foto's van.</p>

<h2>Een foto bewerken</h2>
<p>Klik op een productfoto op <strong>Bewerken</strong>. In het tabblad <strong>Formaat &amp; uitsnede</strong> (gratis) kies je de verhouding en de achtergrond, zoom je in of uit, verschuif je het product en draai je de foto. In het tabblad <strong>AI-achtergrond</strong> laat je AI de achtergrond vervangen; dat kost AI-credits. Elke bewerking wordt een nieuwe foto: het origineel blijft in je mediabibliotheek.</p>$doc$,
  array['foto''s','mediabibliotheek','fotostandaard','afbeeldingen','producten','shopify','merk','tags'],
  '/admin/products',
  2,
  true
)
on conflict (doc_level, slug) do update
  set title = excluded.title,
      excerpt = excluded.excerpt,
      content = excluded.content,
      tags = excluded.tags,
      context_path = excluded.context_path,
      category_id = excluded.category_id;
