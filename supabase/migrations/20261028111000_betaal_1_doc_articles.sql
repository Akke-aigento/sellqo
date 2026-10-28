-- BETAAL-1 — helpartikels.
--   1. "Afrekenen op SellQo Kassa" (kassa-afrekenen, /kassa): betaalwijzen volgens Kassa › Betalen,
--      overschrijving met QR-code, fooi via overschrijving. Volledige nieuwe tekst, md5-guard op de
--      live tekst van 28-10-2026 (96a58546754987a741fe2f042260ebab).
--   2. "Je horeca-werkplek" (horeca-werkplek): bij Kassa staat nu ook Betalen. replace() met
--      md5-guard (48032f8743cfd7094ce0e6fe427267e4).
-- PAS DRAAIEN NA de migratie 20261028110000 en de publish van de admin.
-- Idempotent: na de eerste run kloppen de md5-guards niet meer → 0 rijen.
-- Handmatig terugdraaien:
--   update public.doc_articles d set content = s.content
--     from snapshots.sellqo_20261028_doc_articles_betaal1 s where d.id = s.id;

create schema if not exists snapshots;
create table if not exists snapshots.sellqo_20261028_doc_articles_betaal1 as
  select * from public.doc_articles where doc_level = 'tenant' and slug in ('kassa-afrekenen', 'horeca-werkplek');
revoke all on snapshots.sellqo_20261028_doc_articles_betaal1 from anon, authenticated;

update public.doc_articles
   set content = $c$
<p>Open de rekening en tik op <strong>Afrekenen</strong>. Staat er nog iets dat niet verstuurd is, dan gaat dat eerst naar keuken of bar.</p>

<h2>Welke betaalwijzen je ziet</h2>
<p>De kassa toont enkel wat je zaak aanbiedt. Dat stel je in SellQo in onder <strong>Kassa › Betalen</strong>: contant, overschrijving, maaltijdcheques en bonnen, of je een betaalterminal hebt, en of je fooi aanbiedt. Zonder terminal staat er geen <strong>Kaart</strong>.</p>

<h2>Het hele bedrag</h2>
<ul>
  <li>Tik op <strong>Contant</strong>, <strong>Overschrijving</strong> of <strong>Kaart</strong> en daarna op <strong>Betaald</strong>.</li>
  <li>Bij contant rondt de kassa af op 5 cent (wettelijke regel) en toont ze het wisselgeld als je intikt hoeveel je kreeg.</li>
  <li>Een losse kaartterminal staat los van de kassa: laat de klant eerst op de terminal betalen en bevestig dan in de kassa.</li>
</ul>

<h2>Overschrijving met QR-code</h2>
<ol>
  <li>Kies <strong>Overschrijving</strong>. De kassa toont een QR-code met het bedrag, je rekeningnummer en een gestructureerde mededeling.</li>
  <li>De klant scant de QR-code met zijn bankapp en bevestigt de betaling.</li>
  <li>SellQo ziet de betaling niet zelf binnenkomen. Kijk na dat ze gelukt is (bv. het scherm van de klant), vink <strong>Overschrijving gelukt</strong> aan en tik op <strong>Betaald</strong>.</li>
</ol>
<p>Verandert het bedrag nog (bv. door een fooi), dan moet je opnieuw aanvinken. Het rekeningnummer komt uit <strong>Instellingen › Bedrijfsgegevens</strong>; staat het er niet, dan kan je geen overschrijving kiezen.</p>

<h2>Met meerdere betaalmiddelen of gelijk delen</h2>
<ul>
  <li><strong>Gelijk delen door 2…6</strong> maakt evenveel delen; kies per deel een betaalwijze.</li>
  <li>Of voeg zelf betaalmiddelen toe. De kassa toont wat er nog openstaat; pas als het exact klopt, kan je bevestigen.</li>
  <li>Alles samen is één kasticket.</li>
</ul>

<h2>Eén klant betaalt apart</h2>
<ol>
  <li>Kies in het menu <em>Meer</em> › <strong>Apart afrekenen</strong>.</li>
  <li>Tik per gerecht of drankje aan hoeveel deze klant neemt.</li>
  <li>Dat gaat naar een apart deel van de rekening ("Tafel 4 · deel 1") en je rekent het meteen af. De rest blijft op de tafel.</li>
</ol>

<h2>Fooi</h2>
<p>Staat fooi aan, dan vul je de fooi apart in en kies je hoe ze gegeven werd: contant, met de kaart of via overschrijving. Bij een overschrijving zit de fooi mee in het bedrag van de QR-code. Fooi telt niet mee in je omzet en btw.</p>

<h2>Na het afrekenen</h2>
<ul>
  <li>De verkoop staat meteen bij de verkopen van die kassa (en in het shiftrapport als er op die kassa een shift open staat) en je voorraad wordt afgeboekt.</li>
  <li>In het X- en Z-rapport staat elke betaalwijze apart, ook overschrijving.</li>
  <li>Het totaal komt altijd uit de verstuurde bestellingen in SellQo, nooit uit het toestel. Wijzigde een collega net iets aan de rekening, dan vraagt de kassa om opnieuw af te rekenen.</li>
  <li>Op een geregistreerde kassa (GKS) wordt de verkoop eerst ondertekend en verschijnt het btw-kasticket om af te drukken. Valt het internet net daarna weg, dan bewaart de kassa de betaling en stuurt ze die vanzelf door; de rekening blijft tot dan vergrendeld.</li>
</ul>
<p>Afrekenen kan niet zonder verbinding: zo kunnen twee toestellen nooit dezelfde rekening betalen.</p>
$c$
 where doc_level = 'tenant' and slug = 'kassa-afrekenen'
   and md5(content) = '96a58546754987a741fe2f042260ebab';

update public.doc_articles
   set content = replace(content,
     $a$<li><strong>Kassa</strong>: hier maak je je kassa's aan en beheer je je personeel en pincodes. Een kassa openen gaat altijd naar SellQo Kassa.</li>$a$,
     $a$<li><strong>Kassa</strong>: hier maak je je kassa's aan, beheer je je personeel en pincodes, en stel je onder <strong>Betalen</strong> in hoe klanten betalen (contant, overschrijving, terminal, fooi, en afrekenen via de QR aan tafel). Een kassa openen gaat altijd naar SellQo Kassa.</li>$a$)
 where doc_level = 'tenant' and slug = 'horeca-werkplek'
   and md5(content) = '48032f8743cfd7094ce0e6fe427267e4';
