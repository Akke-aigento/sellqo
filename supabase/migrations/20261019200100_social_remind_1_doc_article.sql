-- SOCIAL-REMIND-1 — de herinnering "zelf posten" komt op het geplande moment, niet meer ±1 uur
-- vooraf (Akke 19-10). Helpartikel bijgewerkt. Idempotent: zoekt de oude zin.
-- Terugdraaien: dezelfde replace omgekeerd.
update public.doc_articles
set content = replace(content,
      '<p>Ongeveer een uur voor het geplande moment krijg je een <strong>melding</strong> (in SellQo en als pushmelding, als die aan staat).',
      '<p>Op het geplande moment krijg je een <strong>melding</strong> (in SellQo en als pushmelding, als die aan staat). Bij een story met een link-sticker staat de link in de melding, klaar om te kopiëren.'),
    updated_at = now()
where doc_level = 'tenant' and slug = 'social-planning-goedkeuren'
  and content like '%<p>Ongeveer een uur voor het geplande moment krijg je een <strong>melding</strong>%';
