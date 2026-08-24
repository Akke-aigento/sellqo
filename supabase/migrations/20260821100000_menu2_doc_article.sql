-- MENU-2 — het in-app doc-artikel over de Menukaart bijwerken met de generator.
--
-- Werkt het artikel bij dat MENU-1 aanmaakte (slug 'dagelijkse-menukaart');
-- er komt bewust geen tweede artikel bij, want het gaat over hetzelfde scherm.
-- Idempotent: ON CONFLICT (doc_level, slug) DO UPDATE.
--
-- Handmatig terugdraaien: draai 20260820100100_menu1_doc_article.sql opnieuw,
-- die zet de MENU-1-versie van de tekst terug.
--
-- Categoriekeuze ongewijzigd t.o.v. MENU-1: Communicatie
-- (a0000001-0000-0000-0000-000000000007). Er is nog steeds geen
-- Marketing-categorie in doc_categories.
INSERT INTO public.doc_articles (doc_level, category_id, context_path, title, slug, excerpt, content, sort_order)
VALUES (
  'tenant',
  'a0000001-0000-0000-0000-000000000007',
  '/admin/marketing/ai',
  'De Dagelijkse Menukaart: merk-DNA, ochtendmenu en het menu van vandaag',
  'dagelijkse-menukaart',
  'Hoe je vastlegt wie je merk is, wat er elke ochtend op je contentmenu staat, en hoe je daar kant-en-klare posts uit haalt.',
  '<p>In <strong>Sellqo AI</strong> vind je het tabblad <strong>Menukaart</strong>. Dat bestaat uit drie delen: bovenaan het <em>menu van vandaag</em>, daaronder je <em>merk-DNA</em> en je <em>ochtendmenu</em>. Het tabblad hoort bij de abonnementen Pro en Enterprise.</p>
<p>De volgorde waarin je ermee werkt is omgekeerd aan de volgorde op het scherm: eerst vul je onderaan je merk-DNA en je ochtendmenu in, daarna laat je bovenaan het menu genereren.</p>
<h3>Merk-DNA</h3>
<p>Dit vul je één keer goed in. Alles wat je hier zet, wordt bij elke gegenereerde post meegelezen.</p>
<ul>
<li><strong>Missie</strong> — waar je voor staat, in één of twee zinnen. Dit stuurt de toon van al je content.</li>
<li><strong>Doelgroep</strong> — voor wie je het maakt. Hoe scherper je dit beschrijft, hoe gerichter de teksten worden.</li>
<li><strong>Tone of voice</strong> — steekwoorden zoals warm, nuchter of speels. Typ een woord en druk op Enter. Plak je een heel lijstje ineens, dan wordt dat automatisch in losse woorden gesplitst.</li>
<li><strong>Sterke punten</strong> — waarom iemand voor jou kiest en niet voor een ander.</li>
<li><strong>Vaste thema''s</strong> — onderwerpen waar je regelmatig op terugkomt.</li>
<li><strong>Wel doen / Niet doen</strong> — wat altijd moet terugkomen, en welke woorden, claims of onderwerpen je nooit wilt zien. De generator houdt zich strikt aan je niet-doen-lijst.</li>
<li><strong>Hashtag-sets</strong> — groepeer hashtags per thema. De AI hergebruikt hieruit waar het past.</li>
<li><strong>Vrij veld</strong> — achtergrond, anekdotes, vaktermen of gevoeligheden die nergens anders passen.</li>
</ul>
<h3>Ochtendmenu</h3>
<p>Per categorie kies je met de plus- en min-knop hoeveel posts je wilt. Alle tellers beginnen op nul: je stelt je menu dus bewust zelf samen. Bovenaan zie je het lopende totaal.</p>
<ul>
<li><strong>Productpost</strong> — één product in de schijnwerpers, met de reden om het nu te kopen.</li>
<li><strong>Educatief</strong> — leg iets uit uit je vakgebied waar je klant echt iets aan heeft.</li>
<li><strong>Lifestyle</strong> — je product in het dagelijks leven, sfeer boven specificaties.</li>
<li><strong>Achter de schermen</strong> — hoe het gemaakt wordt, wie het maakt, wat er misgaat.</li>
<li><strong>Klantverhaal</strong> — een ervaring, review of case van een klant.</li>
<li><strong>Tip of how-to</strong> — een concrete tip of stappenplan dat meteen toepasbaar is.</li>
<li><strong>Seizoen en actualiteit</strong> — inhaken op het seizoen, een feestdag of iets van vandaag.</li>
<li><strong>Verras me</strong> — vrije ruimte waarin de AI zelf een invalshoek kiest die bij je merk past.</li>
</ul>
<p>Daaronder kies je de <strong>nadruk op formaat</strong>. Die geldt voor het hele menu, niet per categorie: gemengd, kort, uitgebreid, beeld voorop of carrousel. Het is een zwaartepunt, geen dwang — per kaart mag de AI afwijken als een ander formaat duidelijk beter past.</p>
<h3>Eigen categorieën</h3>
<p>Mist er iets, dan maak je onderaan een eigen categorie aan. Naast een naam geef je een <strong>instructie</strong> mee die beschrijft wat er in die categorie moet gebeuren. Die instructie is verplicht: zonder instructie weet de generator niet wat je bedoelt, en wordt de categorie niet bewaard.</p>
<p>Een eigen categorie die je even niet wilt gebruiken, kun je <em>verbergen</em> met het oog-icoon. De categorie blijft dan bewaard en je kunt hem later weer tonen. Verwijderen kan ook, maar dat is definitief en vraagt een bevestiging.</p>
<h3>Menu van vandaag</h3>
<p>Staat je merk-DNA er en heeft je ochtendmenu een totaal boven nul, dan klik je bovenaan op <strong>Genereer menu</strong>. De AI maakt in één keer alle kaarten: per categorie een tekst met hashtags, in het formaat dat er het beste bij past.</p>
<ul>
<li><strong>Post</strong> — vierkant beeld met de tekst eronder.</li>
<li><strong>Reel</strong> — staand, bedoeld als korte video.</li>
<li><strong>Verhaal</strong> — staand, met de tekst over het beeld.</li>
<li><strong>Carrousel</strong> — meerdere kaartjes achter elkaar.</li>
</ul>
<p>Elke kaart zie je als preview zoals hij op het kanaal zou landen. Zo merk je meteen of een tekst te lang is voor het formaat dat gekozen is. Bij <em>verras me</em> staat erbij welke invalshoek de AI koos en waarom.</p>
<h3>Wat je met een kaart kunt</h3>
<ul>
<li><strong>Kiezen</strong> — de kaart wordt als concept klaargezet bij je social posts. Publiceren doe je daarna zelf via je gekoppelde kanaal.</li>
<li><strong>Bijstellen</strong> — werktitel, tekst en hashtags aanpassen. De kaart blijft bewaard met jouw versie.</li>
<li><strong>Weggooien</strong> — de kaart verdwijnt uit je menu. Hij wordt verborgen, niet gewist, dus je historie blijft kloppen.</li>
<li><strong>Beeld erbij</strong> — genereert een passende afbeelding in het juiste formaat voor deze kaart.</li>
</ul>
<h3>Wat het kost</h3>
<p>Een <strong>heel menu kost 5 credits</strong>, ongeacht hoeveel kaarten erin zitten. Beeld wordt niet automatisch gemaakt: dat vraag je per kaart aan voor <strong>5 credits</strong>, zodat je alleen betaalt voor de kaarten die je echt gebruikt. Je huidige saldo zie je rechtsboven op de pagina.</p>
<h3>Als er niets gebeurt</h3>
<ul>
<li><strong>"Vul eerst je merk-DNA in"</strong> — de generator heeft minstens je merk-DNA nodig. Scroll naar beneden en vul het formulier in.</li>
<li><strong>"Je ochtendmenu staat nog op nul"</strong> — zet minstens één teller hoger dan nul.</li>
<li><strong>Onvoldoende credits</strong> — je saldo is op. Credits bijkopen kan via de knop rechtsboven.</li>
</ul>',
  71
)
ON CONFLICT (doc_level, slug) DO UPDATE
SET category_id = EXCLUDED.category_id,
    context_path = EXCLUDED.context_path,
    title = EXCLUDED.title,
    excerpt = EXCLUDED.excerpt,
    content = EXCLUDED.content,
    sort_order = EXCLUDED.sort_order;
