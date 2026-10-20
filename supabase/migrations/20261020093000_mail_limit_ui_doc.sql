-- MAIL-LIMIT-UI — helpartikel 'emailcampagnes': waar je limiet en verbruik van marketingmails ziet.
-- Het artikel noemde de maandlimiet al, maar niet waar je hem en je verbruik terugvindt.
-- Vervangt enkel de alinea onder "Hoeveel mails mag ik versturen?"; de rest blijft ongemoeid.
-- Idempotent: de WHERE slaat het artikel over zodra de nieuwe tekst erin staat, en replace()
-- doet niets als de oude alinea er (door een handmatige wijziging) niet meer letterlijk staat.
-- Terugdraaien (handmatig): dezelfde replace() in omgekeerde richting, met de oude alinea:
--   <p>Elk plan heeft een aantal marketingmails per maand. Gaat een campagne daarover, dan zegt
--   SellQo dat vóór het versturen. Je kan dan je doelgroep verkleinen of je plan upgraden.</p>

update public.doc_articles
set content = replace(
      content,
      '<p>Elk plan heeft een aantal marketingmails per maand. Gaat een campagne daarover, dan zegt SellQo dat vóór het versturen. Je kan dan je doelgroep verkleinen of je plan upgraden.</p>',
      $html$<p>Elk plan heeft een aantal marketingmails per maand. Hoeveel dat is per plan, zie je in het overzicht van de plannen onder <strong>SellQo-plan</strong> en op de prijzenpagina van SellQo.</p>
<p>Bovenaan <strong>Marketing → E-mail</strong> zie je hoeveel marketingmails je deze maand al verstuurde en hoeveel je plan toelaat. Ook de mails van je automatiseringen tellen mee; mails die niet verstuurd konden worden niet. De teller begint elke maand opnieuw op de 1e (Belgische tijd). Je verbruik staat ook bij <strong>SellQo-plan</strong>, onder Verbruik.</p>
<p>Gaat een campagne over je limiet, dan zegt SellQo dat vóór het versturen. Je kan dan je doelgroep verkleinen of je plan upgraden.</p>$html$
    ),
    updated_at = now()
where doc_level = 'tenant'
  and slug = 'emailcampagnes'
  and content not like '%Bovenaan <strong>Marketing → E-mail</strong> zie je hoeveel marketingmails%';
