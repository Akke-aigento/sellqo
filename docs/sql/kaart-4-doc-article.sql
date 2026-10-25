-- KAART-4 — helpartikel horeca-kaart bijwerken (idempotent: replace doet niets als de tekst al nieuw is).
-- Draaien via query_database ná de go op KAART-4. Terugdraaien: dezelfde replace in omgekeerde richting.
update public.doc_articles
set content = replace(replace(replace(content,
      '<li><strong>Foto</strong>: op je gsm of tablet opent meteen de camera.</li>',
      '<li><strong>Foto</strong>: neem er meteen een met je gsm of tablet, of kies er een uit je foto''s.</li>'),
      '<li><strong>Waar te koop</strong>: webshop, bestellen aan tafel, zichtbaar op het QR-menu, kassa.</li>',
      '<li><strong>Waar te koop</strong>: webshop, bestellen aan tafel, zichtbaar op het QR-menu, kassa. Wat aan staat is gevuld en heeft een vinkje; tik om aan of uit te zetten.</li>'),
      '<p>Onder <strong>Bestellen › Kaart</strong> staan al je producten per categorie op één scherm.',
      '<p>Onder <strong>Bestellen › Kaart</strong> staan al je producten per categorie op één scherm. Bestellen opent meteen op deze tab; het overzicht van je webshop en QR-menu staat in de tab ernaast.'),
    updated_at = now()
where doc_level = 'tenant' and slug = 'horeca-kaart'
  and position('Bestellen opent meteen op deze tab' in content) = 0;
