-- WEBSHOP-3: template-systeem
--
-- Strikt additief conform §0 van docs/webshop-masterplan.md:
--   * alleen ADD COLUMN IF NOT EXISTS op public.themes
--   * geen kolom hernoemd, verwijderd of van datatype/default gewijzigd
--   * de bestaande rijen (Modern/Classic/Bold) worden NIET aangepast; tenants
--     die daar via theme_id naar verwijzen houden exact hun huidige instellingen
--   * geen wijziging aan tenant_theme_settings, homepage_sections,
--     storefront_pages of de view tenant_theme_public

-- ---------------------------------------------------------------------------
-- 1. Additieve kolommen
-- ---------------------------------------------------------------------------

-- Branche waarop het template mikt (fashion / food / minimal / ...).
ALTER TABLE public.themes ADD COLUMN IF NOT EXISTS category TEXT;

-- preview_image_url bestaat al en dient als desktop-preview; alleen de
-- mobiele variant is nieuw.
ALTER TABLE public.themes ADD COLUMN IF NOT EXISTS preview_mobile_url TEXT;

-- Bouwplan van het template: homepage-secties, voorbeeldpagina's en
-- theme-defaults. Rijen zonder seed_definition zijn geen template en worden
-- niet in de gallery aangeboden.
ALTER TABLE public.themes ADD COLUMN IF NOT EXISTS seed_definition JSONB;

-- Volgorde in de gallery.
ALTER TABLE public.themes ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

COMMENT ON COLUMN public.themes.seed_definition IS
  'Bouwplan voor een template: { sections: [...], pages: [...], defaults: {...} }. NULL = geen template, wordt niet in de gallery getoond.';

-- ---------------------------------------------------------------------------
-- 2. Launch-templates
-- ---------------------------------------------------------------------------
-- Drie nieuwe rijen. INSERT ... ON CONFLICT (slug) DO UPDATE raakt uitsluitend
-- deze drie slugs; bestaande themes blijven buiten schot.

INSERT INTO public.themes
  (slug, name, description, category, sort_order, is_premium, is_active, default_settings, seed_definition)
VALUES
(
  'tpl-mode',
  'Mode & lifestyle',
  'Ruime beelden, rustige typografie en veel wit. Geschikt voor kleding, accessoires en alles wat het van sfeer moet hebben.',
  'fashion',
  1,
  false,
  true,
  '{
    "header_style": "centered",
    "product_card_style": "minimal",
    "products_per_row": 3,
    "show_breadcrumbs": false,
    "show_wishlist": true,
    "primary_color": "#1c1917",
    "secondary_color": "#e7e5e4",
    "accent_color": "#b45309",
    "background_color": "#ffffff",
    "text_color": "#1c1917",
    "heading_font": "Playfair Display",
    "body_font": "Lato",
    "brand_color": "#1c1917",
    "theme_mode": "light",
    "theme_style": "elegant"
  }'::jsonb,
  '{
    "sections": [
      {
        "section_type": "hero",
        "title": "Nieuw seizoen",
        "subtitle": "De najaarscollectie is binnen",
        "content": {"button_text": "Bekijk de collectie", "button_link": "{{shop}}/products", "text_alignment": "center", "overlay_opacity": 0.35},
        "settings": {"full_width": true},
        "sort_order": 0,
        "is_visible": true
      },
      {
        "section_type": "featured_products",
        "title": "Favorieten van deze maand",
        "subtitle": null,
        "content": {"show_prices": true, "max_products": 6},
        "settings": {},
        "sort_order": 1,
        "is_visible": true
      },
      {
        "section_type": "text_image",
        "title": "Gemaakt om lang mee te gaan",
        "subtitle": null,
        "content": {"text": "We werken met kleine ateliers en natuurlijke materialen. Minder collecties per jaar, maar wel stuk voor stuk kleding waar je jaren plezier van hebt.", "image_position": "right", "button_text": "Ons verhaal", "button_link": "{{shop}}/page/about"},
        "settings": {},
        "sort_order": 2,
        "is_visible": true
      },
      {
        "section_type": "testimonials",
        "title": "Wat klanten zeggen",
        "subtitle": null,
        "content": {"reviews": [
          {"name": "Sanne", "text": "Prachtige kwaliteit en supersnel geleverd. De pasvorm klopt precies zoals beschreven.", "rating": 5},
          {"name": "Joris", "text": "Eindelijk een winkel waar ze de moeite nemen om materialen goed uit te leggen.", "rating": 5},
          {"name": "Fatima", "text": "Ik draag mijn jas nu twee winters en hij ziet er nog als nieuw uit.", "rating": 5}
        ]},
        "settings": {},
        "sort_order": 3,
        "is_visible": true
      },
      {
        "section_type": "newsletter",
        "title": null,
        "subtitle": null,
        "content": {"heading": "Blijf op de hoogte", "description": "Nieuwe collecties en af en toe iets exclusiefs. Geen spam.", "button_text": "Aanmelden", "placeholder": "je@email.nl"},
        "settings": {},
        "sort_order": 4,
        "is_visible": true
      }
    ],
    "pages": [
      {"slug": "about", "title": "Over ons", "content": "<h2>Ons verhaal</h2><p>We begonnen met één idee: kleding maken die je jaren draagt in plaats van één seizoen. Sindsdien werken we samen met kleine ateliers die hun vak verstaan.</p><h2>Waar we op letten</h2><p>Natuurlijke materialen, eerlijke arbeidsomstandigheden en een pasvorm die klopt. Liever twee goede collecties per jaar dan twaalf middelmatige.</p>", "show_in_nav": true, "nav_order": 0},
      {"slug": "contact", "title": "Contact", "content": "<p>Vragen over een bestelling, maat of materiaal? We reageren doorgaans binnen één werkdag.</p><ul><li>E-mail: info@example.nl</li><li>Telefoon: 000 - 000 00 00</li></ul>", "show_in_nav": true, "nav_order": 1},
      {"slug": "shipping", "title": "Verzending &amp; retour", "content": "<h2>Verzending</h2><p>Bestellingen voor 22:00 uur besteld worden de volgende werkdag verzonden.</p><h2>Retourneren</h2><p>Past het niet? Je hebt 30 dagen bedenktijd. Retourneren is gratis.</p>", "show_in_nav": true, "nav_order": 2}
    ]
  }'::jsonb
),
(
  'tpl-food',
  'Food & ambacht',
  'Warme kleuren en veel ruimte voor het verhaal achter het product. Voor bakkers, slagers, streekproducten en speciaalzaken.',
  'food',
  2,
  false,
  true,
  '{
    "header_style": "standard",
    "product_card_style": "detailed",
    "products_per_row": 3,
    "show_breadcrumbs": true,
    "show_wishlist": false,
    "primary_color": "#7c2d12",
    "secondary_color": "#fef3c7",
    "accent_color": "#ca8a04",
    "background_color": "#fffbeb",
    "text_color": "#292524",
    "heading_font": "Montserrat",
    "body_font": "Open Sans",
    "brand_color": "#7c2d12",
    "theme_mode": "light",
    "theme_style": "bold"
  }'::jsonb,
  '{
    "sections": [
      {
        "section_type": "announcement",
        "title": null,
        "subtitle": null,
        "content": {"text": "Vandaag voor 12:00 besteld, morgen vers in huis"},
        "settings": {},
        "sort_order": 0,
        "is_visible": true
      },
      {
        "section_type": "hero",
        "title": "Elke dag vers uit eigen keuken",
        "subtitle": "Ambachtelijk gemaakt, zonder toevoegingen",
        "content": {"button_text": "Bekijk het assortiment", "button_link": "{{shop}}/products", "text_alignment": "left", "overlay_opacity": 0.4},
        "settings": {"full_width": true},
        "sort_order": 1,
        "is_visible": true
      },
      {
        "section_type": "collection",
        "title": "Deze week aanbevolen",
        "subtitle": null,
        "content": {"max_products": 6, "show_view_all": true},
        "settings": {},
        "sort_order": 2,
        "is_visible": true
      },
      {
        "section_type": "text_image",
        "title": "Van het vak, al drie generaties",
        "subtitle": null,
        "content": {"text": "Wat begon als een kleine zaak op de hoek is uitgegroeid tot een bedrijf dat nog steeds elke ochtend om vier uur begint. Hetzelfde recept, dezelfde zorg.", "image_position": "left", "button_text": "Ons verhaal", "button_link": "{{shop}}/page/about"},
        "settings": {},
        "sort_order": 3,
        "is_visible": true
      },
      {
        "section_type": "testimonials",
        "title": "Wat klanten zeggen",
        "subtitle": null,
        "content": {"reviews": [
          {"name": "Marieke", "text": "Het brood is elke keer weer fantastisch. Je proeft dat het vers is.", "rating": 5},
          {"name": "Ahmed", "text": "Vriendelijke bediening en altijd bereid iets uit te leggen over de producten.", "rating": 5},
          {"name": "Ellen", "text": "Bestel hier wekelijks. Nog nooit iets op aan te merken gehad.", "rating": 5}
        ]},
        "settings": {},
        "sort_order": 4,
        "is_visible": true
      },
      {
        "section_type": "newsletter",
        "title": null,
        "subtitle": null,
        "content": {"heading": "Weekmenu in je inbox", "description": "Elke maandag het aanbod van die week. Opzeggen kan altijd.", "button_text": "Aanmelden", "placeholder": "je@email.nl"},
        "settings": {},
        "sort_order": 5,
        "is_visible": true
      }
    ],
    "pages": [
      {"slug": "about", "title": "Over ons", "content": "<h2>Drie generaties vakmanschap</h2><p>Wat begon als een kleine zaak op de hoek is uitgegroeid tot een bedrijf dat nog steeds elke ochtend om vier uur begint. Hetzelfde recept, dezelfde zorg.</p><h2>Onze werkwijze</h2><p>We werken met streekproducten waar het kan en maken alles vers op de dag zelf. Wat over is, gaat naar de voedselbank.</p>", "show_in_nav": true, "nav_order": 0},
      {"slug": "contact", "title": "Contact", "content": "<p>Kom gerust langs in de winkel of neem contact op.</p><ul><li>Adres: Voorbeeldstraat 1, 1234 AB Voorbeeldstad</li><li>Telefoon: 000 - 000 00 00</li><li>E-mail: info@example.nl</li></ul><h2>Openingstijden</h2><p>Dinsdag t/m zaterdag van 08:00 tot 17:00 uur.</p>", "show_in_nav": true, "nav_order": 1},
      {"slug": "faq", "title": "Veelgestelde vragen", "content": "<h2>Hoe lang blijft het houdbaar?</h2><p>Onze producten bevatten geen conserveermiddelen. Bewaar ze koel en verbruik ze binnen enkele dagen.</p><h2>Kan ik een bestelling vooraf plaatsen?</h2><p>Ja. Bestel je voor 12:00 uur, dan ligt het de volgende dag klaar.</p>", "show_in_nav": true, "nav_order": 2}
    ]
  }'::jsonb
),
(
  'tpl-minimal',
  'Minimal one-pager',
  'Eén pagina, één boodschap. Voor wie een klein assortiment of een enkele dienst verkoopt en snel live wil.',
  'minimal',
  3,
  false,
  true,
  '{
    "header_style": "minimal",
    "product_card_style": "minimal",
    "products_per_row": 4,
    "show_breadcrumbs": false,
    "show_wishlist": false,
    "primary_color": "#0f172a",
    "secondary_color": "#f1f5f9",
    "accent_color": "#0d9488",
    "background_color": "#ffffff",
    "text_color": "#0f172a",
    "heading_font": "Inter",
    "body_font": "Inter",
    "brand_color": "#0f172a",
    "theme_mode": "light",
    "theme_style": "modern"
  }'::jsonb,
  '{
    "sections": [
      {
        "section_type": "hero",
        "title": "Kort gezegd: wat je hier vindt",
        "subtitle": "Eén zin die uitlegt waarom iemand hier moet zijn",
        "content": {"button_text": "Bekijk het aanbod", "button_link": "{{shop}}/products", "text_alignment": "center", "overlay_opacity": 0.25},
        "settings": {"full_width": true},
        "sort_order": 0,
        "is_visible": true
      },
      {
        "section_type": "featured_products",
        "title": "Het aanbod",
        "subtitle": null,
        "content": {"show_prices": true, "max_products": 4},
        "settings": {},
        "sort_order": 1,
        "is_visible": true
      },
      {
        "section_type": "text_image",
        "title": "Waarom bij ons",
        "subtitle": null,
        "content": {"text": "Vertel in een paar zinnen wat je anders doet dan de rest. Wees concreet: wat krijgt iemand dat hij elders niet krijgt?", "image_position": "right", "button_text": "Neem contact op", "button_link": "{{shop}}/page/contact"},
        "settings": {},
        "sort_order": 2,
        "is_visible": true
      },
      {
        "section_type": "newsletter",
        "title": null,
        "subtitle": null,
        "content": {"heading": "Op de hoogte blijven", "description": "Af en toe een update. Niet vaker dan nodig.", "button_text": "Aanmelden", "placeholder": "je@email.nl"},
        "settings": {},
        "sort_order": 3,
        "is_visible": true
      }
    ],
    "pages": [
      {"slug": "contact", "title": "Contact", "content": "<p>Neem gerust contact op. We reageren meestal binnen één werkdag.</p><ul><li>E-mail: info@example.nl</li><li>Telefoon: 000 - 000 00 00</li></ul>", "show_in_nav": true, "nav_order": 0}
    ]
  }'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name             = EXCLUDED.name,
  description      = EXCLUDED.description,
  category         = EXCLUDED.category,
  sort_order       = EXCLUDED.sort_order,
  default_settings = EXCLUDED.default_settings,
  seed_definition  = EXCLUDED.seed_definition;
