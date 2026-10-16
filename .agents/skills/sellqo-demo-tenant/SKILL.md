---
name: sellqo-demo-tenant
description: "Een publieke SellQo-demowinkel (voorbeeldtenant voor verkoop of testen) volledig opzetten op slug.sellqo.shop: tenant, data, thema, foto's, juridische pagina's en nachtelijke reset."
---

# SellQo demowinkel opzetten

Gebruik dit als Akke een demo- of voorbeeldwinkel wil (een branche om aan prospects te tonen, of een testtenant). Voor een demo op maat van één prospect: zie `sellqo-prospect-demo`.

Bestaande demo's (allemaal getoond op sellqo.app/voorbeelden, `src/pages/public/Examples.tsx`):
- `demo-pizzeria` (Pizzeria Fiamma, horeca)
- `demo-webshop` (Atelier Nord)
- `demo-concertzaal` (Zaal De Linde, events met zaalplan)
- `demo-festival` (Zomerfest): dagtickets, VIP, camping, combitickets (weekend, + camping, VIP-weekend), munten (10/25/50) met barlinks Hoofdbar en Foodtrucks, terugbetalen aan
- `demo-kleding` (Maison Lune)
- `demo-tech` (Voltaro)
- `demo-beauty` (Bloom & Balm)
- `demo-bar` (Café De Wissel)
- `demo-restaurant` (Bistro Mirabelle)
- `demo-wijn` (Vinotheek Lemmens)
- `demo-koffie` (Mokka)

De oude `demo-mode` ("Demo Fashion Store", januari 2026) en `demo-bakkerij` (testbed) niet aanraken.

Een nieuwe publieke demo hoort ook op /voorbeelden: voeg een rij toe aan `DEMOS` in `Examples.tsx`, met kleuren uit het thema en de herofoto, plus een `try_<naam>`-tekst in `landing.*.json` (5 talen).

Paper trail: role-audit DEMO-1, DEMO-2, DEMO-3 en FEST-1/2 (14 okt 2026).

`ops.reset_demo_shops` ruimt bestellingen ouder dan de retentie op, behalve ticketbestellingen. Muntenkaarten (`token_wallets`) van die bestellingen gaan mee; transacties volgen via cascade.

Alles loopt via `query_database` op het Lovable-project sellqo (`9932a7fe-43a1-42de-9c64-168968599600`). Geen edge-function-deploy nodig, dus het kost geen Lovable-credits. Alleen de foto's kosten nano-studio-credits (6 per beeld).

## 0. Recon (altijd eerst)
- **Slug vrij?** `select slug, name from tenants where slug like 'demo-%'`. Een bestaande slug laat de hele run falen (`tenants_slug_key`).
- **Kolommen natrekken** met `information_schema.columns` voor `tenants`, `products`, `product_variants`, `product_variant_options`, `shipping_methods`, `tenant_theme_settings`, `homepage_sections`, `legal_pages`, `fulfillment_settings` en `product_addon_groups`/`product_addon_options`. Neem het schema nooit uit het geheugen.
- **Allergenen en dieet** zijn check-constraints (14 EU-codes; vegetarian/vegan/spicy/halal/gluten_free).
- **Thema-presets** staan in `sellqo-storefront/src/theme/schema.json` (`presets[]`): standaard, kleding, bloemen, restaurant, concertzaal, festival, tech, beauty, bar, bistro, wijn, koffie. Een preset toepassen = `brand_color`, `heading_font`, `body_font` en `theme_config = {preset, settings, product_page}`, plus de homepagesecties uit `preset.sections`. Fonts moeten in `SHOP_FONTS` (`src/lib/fonts.ts`) staan.

## 1. Snelste route: de generator (DEMO-3)
`scripts/demo-seeds/` in de sellqo-repo:
- `spec.py` beschrijft de publieke demo's; `spec_prospects.py` de demo's voor prospects.
- `gen.py` (of `gen.py spec_prospects`) maakt per winkel `out/<slug>.data.sql`, `.theme.sql` en `.img.sql`. Alleen de publieke run schrijft ook `out/presets.json`. De UUID's zijn deterministisch (uuid5 op de slug).

Nieuwe demo:
1. Voeg een dict toe aan `SHOPS`. Voor een nieuwe preset ook `PRESET_THEME`, `PRESET_META` en `PRODUCT_PAGE` aanvullen.
2. Draai `python3 gen.py`, commit en push. De repo is publiek: geen secrets.
3. **Niet plakken:** laat de DB de bestanden zelf ophalen. Plak je ze toch, dan sluipen er fouten in grote SQL.
   - `insert into ops.demo_seed_fetch (file, req_id) select f, net.http_get('https://raw.githubusercontent.com/Akke-aigento/sellqo/<commit>/scripts/demo-seeds/out/'||f) …`
   - Daarna in één `DO`-blok per bestand de md5 van `net._http_response.content` vergelijken met `md5sum` lokaal, en dan `EXECUTE content`. Volgorde per winkel: data, theme, img.
4. Ruim de hulptabellen daarna op (`drop table ops.demo_seed_fetch`).

De generator doet stap 2 tot 5 hieronder automatisch, inclusief de abonnementsfix, het opruimen van de SellQo-klantrij, horeca-overrides, juridische pagina's, `ops.demo_shops` en `ops.demo_stock`.

## 2. Tenant (handmatig)
Insert in `tenants` met minstens:
- `name`, `slug`, `owner_email` (`<slug>@sellqo.app`), `owner_name 'SellQo Demo'`;
- adres `Voorbeeldstraat N, 3000 Leuven, BE`, `currency 'EUR'`, `language 'nl'`;
- `tax_percentage`: 6 voor horeca, events en koffie; 21 voor een webshop of bar;
- `primary_color` en `payment_methods_enabled`: `["bank_transfer"]` voor webshops en events, `[]` voor horeca met betalen aan de toog.

Verder:
- `is_demo = true`, `billing_exempt = true`, `platform_newsletter_opt_in = false`.
- `notification_email = 'info@sellqo.app'`. Anders bouncen meldingen naar het onbestaande `<slug>@sellqo.app` op Migadu, en dat schaadt de Resend-reputatie.
- Overschrijving: `iban 'BE00 0000 0000 0000'`, `bic 'DEMOBEBB'`, `bank_transfer_acknowledged_manual true`.

De triggers bij de insert doen drie dingen. Ruim ze meteen op:
1. Ze maken een trial-abonnement aan. Zet `tenant_subscriptions` op `plan_id 'enterprise'`, `status 'active'`, `trial_end null`, en `tenants.subscription_plan/status` op enterprise/active.
2. `register_tenant_as_sellqo_customer` maakt een klantrij aan in de SellQo-tenant `d03c63fe-48c6-4ff7-a30b-7506ea3e71ab`. Verwijder die rij (op e-mail).
3. Een adminrol wordt overgeslagen zonder `auth.uid()`. Dat is goed zo: Akke beheert de winkel als platform_admin.

Modules:
- Horeca: `tenants.business_modules = ['horeca']` en `tenant_feature_overrides.granted_features = ['horeca']`.
- Events: `business_modules = ['events']`.

## 3. Data
- **Producten:** `category_id` rechtstreeks op `products`. Webshop: echte voorraad, één product met lage voorraad, één uitverkochte variant en één doorgestreepte prijs (`compare_at_price`). Horeca: `track_inventory false` en `requires_shipping false`.
- **Varianten:** `product_variants.attribute_values = {"Maat": "M"}`, plus één rij in `product_variant_options` (`name`, `values text[]`).
- **Extra's:** groepen met `category_ids` (verplicht = `min_select 1`). Dat werkt ook buiten horeca, bijvoorbeeld maling bij koffie.
- **Verzending:** `shipping` met `countries`; horeca `pickup` en `local_delivery` met `postal_codes`, `min_order_amount` en `free_above`.
- **Horeca `fulfillment_settings`:** tijdsloten aan, uren op ELKE dag (0 = zondag), zodat een demo altijd tijdsloten toont. Verder `pay_on_pickup`, `notify_ready`, `qr_mode 'order'` en `qr_pay_counter`.
- **Claims kloppen met de instellingen:** geen "online betalen" in een usp als dat uitstaat, en openingsuren gelijk aan de tijdsloten.

## 4. Events-demo (zaalplan, DEMO-2)
- Zaal in `venues`, `venue_sections`, `venue_price_classes` en `venue_seats` (rooster x/y; een gangpad is een lege x).
- Per voorstelling een ticketproduct plus een `event_details`-rij. Een trigger maakt het standaardtype en de zone. Extra prijsklassen = verborgen ticketproducten "<voorstelling> · Categorie 2" met een `event_ticket_types`-rij.
- **Koppelen** via `link_event_venue(event, venue, {class_id: product_id})`. Die vraagt `auth.uid()` met een tenantrol:
  1. tijdelijk `insert into user_roles (user_id 'be6f2a43-…', role 'tenant_admin', tenant_id)`;
  2. in een aparte aanroep `set_config('request.jwt.claims', …)` en `set local role authenticated`, en dan de functie;
  3. daarna de rol weer verwijderen.
- Homepagesectie `event_agenda` (presets concertzaal en festival).

## 5. Thema en publiceren
- `tenant_theme_settings` (insert): preset-velden, `shop_live`, `shop_ordering`, `shop_live_at now()`, `is_published`, `storefront_status 'online'`.
- Zet `show_announcement_bar` aan: "Demowinkel van SellQo: bestellen werkt, maar er wordt niets … of aangerekend."
- `homepage_sections` uit de preset, met teksten op maat, plus een FAQ-vraag "Is dit een echte winkel?".
- `legal_pages`: contact, terms en privacy, en voor een webshop ook shipping en refund. Korte, eerlijke demoteksten met contact naar info@sellqo.app.
- **Nieuwe preset?** Zet hem in `schema.json` met `preview.image` (de hero van de demo) en `example: {url, label}`. Push de storefront-repo (die deployt bij elke push), en vertaal de naam en beschrijving in de admin via `admin.storefront.schemaText.<key>` (key = NL-tekst genormaliseerd, zie `schemaText.ts`).

## 6. Foto's (nano-studio)
- Leg prompts vast in `ops.demo_img (slug, tenant_id, prompt, ar, req_id, job_id, result_url)`. Gebruik één vaste stijlzin per winkel plus het onderwerp, en zet er altijd "No text, no logos, no people" in.
- **Vuur af in batches van ±30** (`timeout_milliseconds` 60000): `net.http_post` naar `/functions/v1/nano-studio` met Bearer `vault.decrypted_secrets` `email_queue_service_role_key` (het `sb_`-sleuteltje `cron_service_role_key` geeft 403). Body: `{action:'generate', tenant_id, prompt, mode:'text', model:'nano-banana-pro', aspect_ratio, resolution:'1K', source_product_id}`.
- **pg_net kan stilvallen:** komen er geen antwoorden, kijk dan naar `select count(*) from net.http_request_queue` en wek hem met `select net.wake()`. Daar staan ook crons in.
- `job_id` uit `net._http_response`. Na ±2 à 3 minuten de status opvragen (`{action:'status', job_id}`, met de req_id's in een hulptabel) en `result_url` eruit halen met `substring(content from '"result_url":"([^"]+)"')`. Geen `::jsonb`-cast op alle rijen: een HTML-foutantwoord laat die cast ontploffen.
- **Koppelen:** `products.images = array[url]`, `featured_image = url`. De hero gaat naar `homepage_sections.content.image_url` (`<slug>-hero`), het sfeerbeeld naar `text_image` (`<slug>-story`).
- De sandbox kan Supabase-opslag niet openen, dus Claude kan de beelden niet zelf bekijken. Vraag Akke om ze na te kijken.

## 7. Nachtelijke reset
`ops.reset_demo_shops()` (cron `reset-demo-shops-daily`) ziet alleen tenants in `ops.demo_shops`. Bij een nieuwe demo (de generator doet dit):
```sql
insert into ops.demo_shops (tenant_id, note) values ('<id>', '<naam>');
insert into ops.demo_stock (tenant_id, product_id, variant_id, stock)
select tenant_id, id, null, stock from products where tenant_id = '<id>' and track_inventory
union all select tenant_id, product_id, id, stock from product_variants where tenant_id = '<id>';
```
De reset zet de voorraad terug, rondt keukenbonnen ouder dan 12 uur af en wist orders, kassaverkopen en klanten ouder dan 14 dagen.

## 8. Verificatie (niet overslaan)
- `net.http_get` (`timeout_milliseconds` 25000) op `https://<slug>.sellqo.shop/`, een productpagina en, bij horeca, `/menu?tafel=4`. Controleer status 200, de `<title>`, geen "binnenkort", foto's uit `ai-images`, en de optienamen (Maat, Gewicht, Maling). De tafelbadge staat in de HTML als `Tafel <!-- -->4`.
- **E2E via `ops.sf`:**
  - een verplichte extra overslaan geeft `ADDON_MIN`;
  - `get_fulfillment_slots` met `params.type` (niet `service_type`);
  - prijs met extra en variant klopt;
  - een order: horeca met `checkout_table` en `pay_on_pickup`, webshop met customer, address, shipping en `bank_transfer`. De voorraad van de variant moet zakken.
- Role-audit-entry, commit, en `gh run list` tot de CI groen staat (beide repo's).
