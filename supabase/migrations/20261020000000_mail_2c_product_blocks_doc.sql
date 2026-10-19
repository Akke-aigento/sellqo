-- MAIL-2c — helpartikel "Producten in je mail". De productblokken zelf vragen geen schemawijziging:
-- het blok is HTML in html_content (zie src/lib/emailProductBlock.ts), de productlink komt uit
-- supabase/functions/_shared/storefrontUrls.ts (tenants.product_url_template of de SellQo-winkel).
-- Idempotent: INSERT ... ON CONFLICT (doc_level, slug) DO UPDATE; category_id is NOT NULL (Marketing).
-- Terugdraaien: delete from public.doc_articles where doc_level = 'tenant' and slug = 'producten-in-je-mail';

insert into public.doc_articles (doc_level, category_id, context_path, title, slug, excerpt, content, sort_order)
values (
  'tenant',
  'a0000001-0000-0000-0000-00000000000b',
  '/admin/marketing',
  'Producten in je mail',
  'producten-in-je-mail',
  'Zet 1 tot 4 producten met foto, naam, prijs en knop in een campagne, template of automatisering.',
  $html$
<h2>Een productblok invoegen</h2>
<ol>
  <li>Open een campagne, template of automatisering in <strong>Marketing</strong> en kies de visuele editor.</li>
  <li>Klik in de werkbalk op het <strong>tasje</strong> (Product invoegen).</li>
  <li>Zoek je producten en kies er 1 tot 4. Enkel actieve producten die in je winkel zichtbaar zijn, staan in de lijst.</li>
  <li>Kies <strong>raster</strong> (naast elkaar) of <strong>lijst</strong> (onder elkaar), pas eventueel de tekst op de knop aan en klik op Invoegen.</li>
</ol>
<p>Elk product krijgt zijn foto, naam, prijs en een knop naar de productpagina in je winkel. Je verwijdert een blok door het aan te klikken en op Delete of Backspace te drukken.</p>

<h2>Welke prijs staat in de mail?</h2>
<p>De <strong>prijs op het moment dat je het blok invoegt</strong>. Pas je daarna de prijs van het product aan, dan verandert die niet vanzelf in de mail: verwijder het blok en voeg het opnieuw in. Een oude, doorstreepte prijs wordt nooit getoond.</p>

<h2>Waar gaat de knop naartoe?</h2>
<ul>
  <li>Heeft je winkel een eigen website met een ingestelde productlink, dan naar het product op die website.</li>
  <li>Draait je winkel op SellQo, dan naar het product op je eigen domein, of op <em>jouwwinkel</em>.sellqo.shop zodra je winkel online staat.</li>
  <li>Kent SellQo geen publieke productlink voor je winkel (bijvoorbeeld een eigen website zonder ingestelde productlink, of een winkel die nog niet online staat), dan zegt het venster dat en komt het blok er <strong>zonder knop en zonder link</strong> in. Zo krijgt een klant nooit een link die nergens naartoe gaat.</li>
</ul>

<h2>Meerdere talen</h2>
<p>Een productblok hoort bij de tekst van één taal. Verstuur je in meerdere talen, voeg het blok dan in elke taal in: de prijs en de knoptekst volgen de taal van die tab.</p>
$html$,
  55
)
on conflict (doc_level, slug) do update
  set title = excluded.title,
      excerpt = excluded.excerpt,
      content = excluded.content,
      context_path = excluded.context_path,
      category_id = excluded.category_id,
      updated_at = now();
