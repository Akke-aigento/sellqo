-- MENU-1 — in-app documentatie voor het tabblad Menukaart in Sellqo AI.
--
-- Idempotent: ON CONFLICT (doc_level, slug) werkt het bestaande artikel bij.
-- Handmatig terugdraaien: DELETE FROM public.doc_articles
--   WHERE doc_level = 'tenant' AND slug = 'dagelijkse-menukaart';
--
-- Categoriekeuze: er bestaat geen Marketing-categorie in doc_categories. De
-- acht tenant-categorieën zijn Producten, Bestellingen, Betalingen, Verzending,
-- Promoties, Webshop, Communicatie en FAQ. Social content valt het dichtst bij
-- Communicatie (a0000001-0000-0000-0000-000000000007); een nieuwe categorie
-- aanmaken viel buiten de scope van deze batch.
INSERT INTO public.doc_articles (doc_level, category_id, context_path, title, slug, excerpt, content, sort_order)
VALUES (
  'tenant',
  'a0000001-0000-0000-0000-000000000007',
  '/admin/marketing/ai',
  'De Dagelijkse Menukaart: merk-DNA en ochtendmenu',
  'dagelijkse-menukaart',
  'Hoe je vastlegt wie je merk is en wat er elke ochtend op je contentmenu staat.',
  '<p>In <strong>Sellqo AI</strong> vind je het tabblad <strong>Menukaart</strong>. Daar leg je twee dingen vast: wie je merk is, en wat je elke ochtend voorgeschoteld wilt krijgen. Het tabblad hoort bij de abonnementen Pro en Enterprise.</p>
<h3>Merk-DNA</h3>
<p>Dit vul je één keer goed in. Alles wat je hier zet, wordt bij elke gegenereerde post meegelezen.</p>
<ul>
<li><strong>Missie</strong> — waar je voor staat, in één of twee zinnen. Dit stuurt de toon van al je content.</li>
<li><strong>Doelgroep</strong> — voor wie je het maakt. Hoe scherper je dit beschrijft, hoe gerichter de teksten worden.</li>
<li><strong>Tone of voice</strong> — steekwoorden zoals warm, nuchter of speels. Typ een woord en druk op Enter.</li>
<li><strong>Sterke punten</strong> — waarom iemand voor jou kiest en niet voor een ander.</li>
<li><strong>Vaste thema''s</strong> — onderwerpen waar je regelmatig op terugkomt.</li>
<li><strong>Wel doen / Niet doen</strong> — wat altijd moet terugkomen, en welke woorden, claims of onderwerpen je nooit wilt zien.</li>
<li><strong>Hashtag-sets</strong> — groepeer hashtags per thema, zodat je ze per post kunt hergebruiken.</li>
<li><strong>Vrij veld</strong> — achtergrond, anekdotes, vaktermen of gevoeligheden die nergens anders passen.</li>
</ul>
<h3>Ochtendmenu</h3>
<p>Per categorie kies je met de plus- en min-knop hoeveel posts je wilt. Bovenaan zie je het lopende totaal.</p>
<ul>
<li><strong>Productpost</strong> — één product in de schijnwerpers, met de reden om het nu te kopen.</li>
<li><strong>Educatief</strong> — leg iets uit uit je vakgebied waar je klant echt iets aan heeft.</li>
<li><strong>Lifestyle</strong> — je product in het dagelijks leven, sfeer boven specificaties.</li>
<li><strong>Achter de schermen</strong> — hoe het gemaakt wordt, wie het maakt, wat er misgaat.</li>
<li><strong>Klantverhaal</strong> — een ervaring, review of case van een echte klant.</li>
<li><strong>Tip of how-to</strong> — een concrete tip of stappenplan dat meteen toepasbaar is.</li>
<li><strong>Seizoen en actualiteit</strong> — inhaken op het seizoen, een feestdag of iets van vandaag.</li>
<li><strong>Verras me</strong> — vrije ruimte waarin de AI zelf een invalshoek kiest die bij je merk past.</li>
</ul>
<p>Daaronder kies je de <strong>nadruk op formaat</strong>. Die geldt voor het hele menu, niet per categorie: gemengd, kort, uitgebreid, beeld voorop of carrousel.</p>
<h3>Eigen categorieën</h3>
<p>Mist er iets, dan maak je onderaan een eigen categorie aan. Naast een naam geef je een <strong>instructie</strong> mee die beschrijft wat er in die categorie moet gebeuren. Die instructie is verplicht: zonder instructie weet de generator niet wat je bedoelt, en wordt de categorie niet bewaard.</p>
<p>Een eigen categorie die je even niet wilt gebruiken, kun je <em>verbergen</em> met het oog-icoon. De categorie blijft dan bewaard en je kunt hem later weer tonen. Verwijderen kan ook, maar dat is definitief en vraagt een bevestiging.</p>
<h3>Opslaan</h3>
<p>Merk-DNA en ochtendmenu hebben elk een eigen opslagknop. Zolang er wijzigingen openstaan, zie je dat naast de knop staan. Er wordt niets automatisch bewaard.</p>',
  71
)
ON CONFLICT (doc_level, slug) DO UPDATE
SET category_id = EXCLUDED.category_id,
    context_path = EXCLUDED.context_path,
    title = EXCLUDED.title,
    excerpt = EXCLUDED.excerpt,
    content = EXCLUDED.content,
    sort_order = EXCLUDED.sort_order;
