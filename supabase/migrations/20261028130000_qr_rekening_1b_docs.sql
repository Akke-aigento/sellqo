-- QR-REKENING-1b — helpartikel "Bestellingen via de QR op de tafelrekening" (qr-tafelrekening):
-- alinea over een QR-menu dat nog niet zichtbaar is (zaak offline) en over kortingscodes aan tafel.
-- md5-guard op de tekst van QR-REKENING-1 (4c6905b0425ed71efe2acf43df3dec2a), dus idempotent.
-- Handmatig terugdraaien: update public.doc_articles set content = replace(content, <nieuwe alinea's>, '')
--   where doc_level = 'tenant' and slug = 'qr-tafelrekening';

update public.doc_articles
   set content = replace(content,
     $o$<p>Producten die op zijn of die je niet aan tafel verkoopt, kan hij niet doorgeven; hij krijgt meteen een melding.</p>$o$,
     $n$<p>Producten die op zijn of die je niet aan tafel verkoopt, kan hij niet doorgeven; hij krijgt meteen een melding. Een kortingscode kan hij aan tafel niet invullen: op de tafelrekening geldt de prijs van de kaart. Een korting geef je op de kassa.</p>

<h2>Gasten zien het menu niet?</h2>
<p>Het QR-menu is pas zichtbaar als je zaak online staat. Staat ze nog offline, dan zie je dat bovenaan bij <strong>Bestellen › QR-menu</strong>, met een link naar <strong>Webshop › Winkel openen</strong>. Daar zet je <em>Winkel online</em> aan. <em>Online bestellen</em> (thuis afhalen of laten leveren) mag uit blijven: bestellen aan tafel werkt ook zonder.</p>$n$),
       updated_at = now()
 where doc_level = 'tenant' and slug = 'qr-tafelrekening'
   and md5(content) = '4c6905b0425ed71efe2acf43df3dec2a';
