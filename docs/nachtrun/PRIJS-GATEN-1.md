# PRIJS-GATEN-1 — drie gaten rond prijswijzigingen dicht — 2 november 2026

Security-batch. Bron: `kassa-account-1-plan.md` §1.3 en `docs/nachtrun/PRIJS-REST-RECON.md`. Live feiten
read-only nagetrokken op project 9932a7fe (2-11-2026). Niets naar de DB geschreven; migratie enkel als bestand.

## Root cause

1. **`bulk_adjust_prices`** (SECURITY DEFINER) controleerde enkel "producten van de eigen winkel"
   (`get_user_tenant_ids`), geen rol. Elk lid kon prijzen in bulk aanpassen; enkel de products-guard ving
   marketing/warehouse, en elke rol buiten die twee (viewer, accountant) liep erdoor.
2. **`product_variants`**: UPDATE-policy "Tenant staff can update product_variants" laat `tenant_admin`, `staff`
   én `warehouse` schrijven, en er stond geen guard-trigger (enkel `trg_product_variants_media_register` en
   `update_product_variants_updated_at`). Een magazijnaccount kon `price`, `compare_at_price`, `cost_price`
   van een variant wijzigen; `add_line` rekent die prijs.
3. **`guard_product_commercial_fields`** was default-allow: `IF NOT v_beperkt THEN RETURN NEW` liet elke rol
   die niet admin/staff én niet marketing/warehouse was (viewer, accountant, elke toekomstige rol) alles doen.
   Vandaag houdt RLS viewer/accountant tegen, maar de guard zelf was fout bij elke nieuwe rol of policy.

`product_addon_options`: **geen gat** — policy `product_addon_options_write` = `tenant_admin` of platformadmin.
Geen trigger toegevoegd.

## Uitgevoerd

- `supabase/migrations/20261102090000_prijs_gaten_1.sql`
  - Drift-controle: stopt als de live body van `guard_product_commercial_fields` of `bulk_adjust_prices`
    afwijkt van de versie van 2-11-2026 (prosrc-md5 `1b7c7fee…` / `9244c5fe…`) en de marker nog niet draagt.
  - Snapshot `snapshots.sellqo_20261102_fn_prijs_gaten_1` (naam, def, src_md5), geen rechten voor anon/authenticated.
  - `bulk_adjust_prices`: live definitie + rolcheck `has_tenant_role(p.tenant_id, {tenant_admin, staff})` voor
    elk product in de selectie (binnen de bestaande `auth.uid() is not null and not platform_admin`-tak).
    Service role / postgres en platformadmin ongewijzigd.
  - `guard_product_commercial_fields`: default-deny op `price`, `compare_at_price`, `cost_price`,
    `vat_rate_id`, `takeaway_vat_rate_id`. Enkel tenant_admin/staff, platformadmin en de server mogen ze
    wijzigen; elke andere rol 42501. Een anon-JWT (geen `auth.uid()`, claim-rol `anon`) valt niet meer onder
    "server". sku/barcode/voorraad-regels ongewijzigd (enkel marketing/warehouse beperkt) — bewust, zie hieronder.
  - Nieuw: `guard_product_variant_price_fields()` + trigger `trg_guard_product_variant_price_fields`
    (`BEFORE UPDATE OF price, compare_at_price, cost_price ON product_variants`). Zelfde regel; winkel via het
    product (zoals de RLS-policies), zowel de oude als de nieuwe `product_id`. Execute ingetrokken voor
    public/anon/authenticated.
- `scripts/gks/sql/06_prijs_prelude.sql` — live `bulk_adjust_prices` verbatim + variantkolommen voor de lokale test.
- `scripts/gks/sql/test_prijs_gaten.sql` — rol-impersonatie (52 controles).
- `scripts/gks/sql/run.sh` — prelude, migratie 2× en test toegevoegd na KASSA-RECHTEN-1.

## Security-keuzes

- **`auth.uid()`, niet `current_user`.** De guard is zelf SECURITY DEFINER, dus `current_user` is daarin altijd
  `postgres`. `auth.uid()` blijft binnen een definer-RPC de beller. Gevolg: een definer-RPC passeert de guard
  enkel als de beller zelf admin/staff is — precies de bedoeling, want élke RPC die prijzen wijzigt eist dat
  al (zie de lijst hieronder). Server-paden (service role, cron, imports, migraties) hebben geen `auth.uid()`.
- **Anon-JWT** zat vroeger onder "geen auth.uid() = server". RLS houdt anon live al tegen (geen anon-UPDATE-policy
  op products/product_variants, terwijl de tabelgrants wel `UPDATE` aan anon geven); nu ook de guard.
  De claim wordt rechtstreeks gelezen (`request.jwt.claim.role` / `request.jwt.claims`), identiek aan live `auth.role()`.
- **Default-deny enkel op prijs/btw.** Voor sku/barcode/voorraad bleef de bestaande regel (enkel marketing/warehouse
  beperkt). Reden: voorraad wordt ook gewijzigd door definer-paden met een willekeurige beller
  (`handle_pos_refund_stock`, `record_stock_movement`, `bulk_adjust_stock`); daar default-deny invoeren hoort in
  een eigen batch met eigen blast-radius.
- **Variant-guard enkel op UPDATE**, zoals de products-guard. INSERT op `product_variants` is via RLS enkel
  tenant_admin/staff (`Tenant staff can insert product_variants`); een upsert door warehouse faalt daar al.
- **SECURITY DEFINER-lookup via FK** (skill db-safety): de variant-guard leest enkel `products.tenant_id` om de
  rol te toetsen, geeft geen data terug, en eist de rol op de winkel van zowel de oude als de nieuwe product_id.
- Geen policies, grants of RLS gewijzigd.

### Schrijvende paden — breekt er een legitiem pad?

Live (`pg_proc.prosrc`, 2-11-2026) zijn er drie functies die een prijs op products wijzigen, geen enkele op
product_variants:

| Pad | Beller | Na PRIJS-GATEN-1 |
|---|---|---|
| `kassa_product_quick_edit` (definer) | eist zelf tenant_admin/staff + PIN | ok (beller is admin/staff) |
| `kaart_bulk_update` (definer) | eist zelf tenant_admin/staff | ok — getest met staff en de guard actief |
| `bulk_adjust_prices` (definer, `useProducts.ts:153`) | nu tenant_admin/staff | ok voor admin/staff; anders 42501 (gewenst) |
| `kaart_duplicate_product` | INSERT (guard is UPDATE-only) | ongewijzigd |
| Overige definer-functies op products (`kaart_reorder`, `kaart_fill_positions`, `handle_primary_category_delete`, `record_stock_movement`, `handle_pos_refund_stock`, `bulk_update_tags`, `bulk_update_social_channels`, `bulk_adjust_stock`, `set_product_sold_out_today`) | raken geen prijsveld | ongewijzigd (guard vergelijkt OLD/NEW) |

Frontend (REST met de gebruikers-JWT, `rg "from('products'|'product_variants').update|upsert|insert"`):
`ProductForm.tsx`, `ProductGridView.tsx`, `useProducts.ts`, `useProductVariants.ts`, `useKaart.ts`,
`useEventWorkspace.ts`, `useFestival.ts`, `useCreateEvent.ts`, `useOnboarding.ts`, `ShopifyManualImport.tsx`
(+ niet-prijs-schrijvers: foto's, kanalen, allergenen, marketplace-status). RLS laat enkel
tenant_admin/staff/warehouse/marketing (products) en tenant_admin/staff/warehouse (variants) UPDATE doen;
admin/staff zijn ongewijzigd toegelaten. Een volledige payload met een **ongewijzigde** prijs (formulier,
`ProductForm.tsx:779` zet enkel `track_inventory` op varianten) blijft ok — getest.

Edge functions: alle product-schrijvers met prijsvelden gebruiken de service role (CSV-import, Shopify/WooCommerce/
bol/eBay/Amazon/Odoo/Printful-syncs, `duplicate-product`) → geen `auth.uid()` → ongewijzigd. Uitzonderingen met
de gebruikers-JWT: `ai-assistant-action` (eist zelf tenant_admin/staff via `requireRole`, `index.ts:42`) en
`process-order-refund` (schrijft enkel `stock`; zijn lege `rpc("bulk_adjust_prices", {})` faalde al op de signatuur
en verandert niet).

## Gedeelde-paden-waarschuwing

Geen `storefront-api`/`storefront-customer-api` geraakt, geen gedeelde storefronttabel. `products` en
`product_variants` worden door de custom frontends enkel gelezen (via storefront-api, service role). Eerste wet: n.v.t.

## Verificatie

- Lokaal PG16, `scripts/gks/sql/run.sh` (alle kassatests + migratie 2× + `test_prijs_gaten.sql`): **2× exit 0**.
- Rol-matrix (products én variants): tenant_admin ok, staff ok, platform_admin ok, service role ok, postgres ok;
  warehouse, marketing, viewer, accountant, admin van een andere zaak en anon-JWT → 42501 op elk prijsveld.
  Niet-prijsvelden (naam, titel, voorraad voor warehouse) blijven ok; sku/voorraad-regels voor marketing ongewijzigd.
  `bulk_adjust_prices`: admin/staff/platform/service ok; warehouse/marketing/viewer/accountant en gemengde selectie 42501.
- **Negatieve controle**: met de oude definities (uit de snapshot) en zonder variant-trigger faalt de test op 18
  controles; na opnieuw migreren 0. De terugdraai-instructie (snapshot `execute def`) is daarmee ook bewezen.
- Drift-controle bewezen: een gewijzigde `bulk_adjust_prices` laat de migratie stoppen met een duidelijke fout.
- Geen TypeScript, i18n of edge functions gewijzigd → tsc/lint/i18n-parity/deno check n.v.t.

## Bewust ongemoeid / Vervolg

- **Na de migratie live natrekken** (projectregel core-migratie): `select position('PRIJS-GATEN-1' in prosrc) > 0
  from pg_proc where proname in ('guard_product_commercial_fields','bulk_adjust_prices');` en
  `select tgname from pg_trigger where tgrelid = 'public.product_variants'::regclass and not tgisinternal;`.
- **UI-gat** (variantentab en raster toonden prijsvelden bewerkbaar aan rollen die ze niet mogen wijzigen):
  opgelost in dit batch-deel 2, zie hieronder.
- Breder, niet in deze batch: `ProductVariantsTab` krijgt de `readOnly` van `ProductForm` niet mee. Een rol zonder
  `products`-schrijfrecht (warehouse, viewer, accountant) ziet op de variantentab nog opties toevoegen, varianten
  genereren, verwijderen en koppelen; RLS weigert die stil of met een fout. Vervolg: `readOnly`-prop doorgeven
  en die knoppen verbergen.
- Het kernscenario uit PRIJS-REST-RECON (kassatoestel met tenant_admin-JWT zet prijs op 0,01) sluit deze batch
  **niet**: dat is KASSA-ACCOUNT-1 (toestelaccount met beperkte rol). Wie daar de guard verder aanpast: deze
  migratie is de nieuwe basis (marker `PRIJS-GATEN-1`).
- Prijs-audit (ontwerp A, `product_price_audit`) niet gebouwd — aparte batch.
- Default-deny voor sku/barcode/voorraad: niet gedaan (zie Security-keuzes).
- Skill-onderhoud: `sellqo-db-safety` mag een regel krijgen: "Een guard-trigger die zelf SECURITY DEFINER is, ziet
  `current_user = postgres`; om de beller te toetsen enkel `auth.uid()`/JWT-claims gebruiken, en `auth.uid() is
  null` is niet automatisch 'server' (anon-JWT)." Voorstel, niet toegepast.
- Geen `doc_articles`: niets nieuw voor de winkel om te leren (gedrag voor admin/staff ongewijzigd).

## Deel 2 — UI-afscherming (zelfde batch, op vraag van de hoofdsessie)

**Root cause.** `ProductVariantsTab` en `ProductGridView` (Producten › raster) hadden geen enkele rolcheck op prijsvelden:
warehouse/marketing (en elke rol zonder prijsrecht) kreeg bewerkbare prijs-, van-prijs-, kostprijs- en btw-velden die
de DB-guard bij opslaan weigert. Een dode affordance. `ProductForm` schermde al af, maar enkel voor marketing/warehouse,
met de globale rollen (niet per winkel) en een hardgecodeerde Nederlandse hint.

**Uitgevoerd.**
- `src/hooks/useCan.ts`: nieuwe resource `product_prices` (read: alle rollen, write: platform_admin, tenant_admin,
  staff), dus dezelfde regel als de DB-guards. `docs/sellqo-fase2-masterplan.md` Hoofdstuk 2: rij toegevoegd (de matrix
  moet op beide plekken gelijk lopen). `src/hooks/useCan.test.ts`: test op de nieuwe sleutel.
- `src/hooks/useProductFieldAccess.ts` (nieuw): `canEditCommercial` (= `useCan('write','product_prices')`, per actieve
  winkel) en `canEditStock` (PROD-TRIGGER-1-regel), plus de veldsets per guard.
- `ProductVariantsTab.tsx`: prijs, van-prijs en kostprijs uitgeschakeld (met tooltip) als je geen prijsrecht hebt,
  één zichtbare uitleg onder de kaarttitel (ook op 390 px, daar is geen hover). Bij opslaan worden prijsvelden dan niet
  meegestuurd. "Van-prijs" (label + kolomkop) via i18n.
- `ProductGridView.tsx`: vergrendelde cellen (prijs, kostprijs, van-prijs, btw, sku, barcode; voorraad enkel voor een
  marketing-rol) tonen dezelfde waarde gedimd met een slotje en een tooltip. Klikken, selecteren, bewerken en bulk-bewerken
  kunnen daar niet. Op variantrijen gaan enkel de drie prijsvelden op slot (de DB-guard op varianten bewaakt enkel die).
  Eén uitleg boven het raster.
- `ProductForm.tsx`: `canEditCommercial = useCan('write','product_prices')` (per winkel, default-deny); de hint
  "Wordt door een beheerder beheerd." gaat nu via i18n.
- i18n: 5 nieuwe keys onder `product_form` (`admin_managed_hint`, `prices_locked_hint`, `grid_locked_hint`,
  `field_locked`, `variant_compare_at_price`) in nl/en/fr/de/uk.
- Harnas: `scripts/harness/scenarios/prijs-slot/` (variantentab + raster, warehouse en beheerder, nl en en).

**Nagekeken, niets te doen.**
- Kaart (`KaartManager`, `KaartProductSheet`): prijs, ±-knoppen, btw, bulk en snel-toevoegen hangen al aan `canFull`
  (platform_admin/tenant_admin/staff). Kostprijs hangt aan `product_costs` write (tenant_admin), wat strenger is dan de DB.
- Kassa `ProductQuickEdit` (`src/kassa`): de kassa meldt zich enkel aan met admin/staff, en de prijs gaat via
  `kassa_product_quick_edit` met de PIN van een eigenaar/verantwoordelijke. De server beslist, het scherm niet. `src/kassa`
  is niet aangeraakt.

**Verificatie deel 2.**
- `npx tsc --noEmit -p tsconfig.app.json`: exit 0.
- `node scripts/i18n-parity.mjs`: exit 0 (volledige pariteit).
- `npx vitest run src/hooks/useCan.test.ts src/components/admin/products src/components/admin/horeca/kaart`: 44/44 groen.
- eslint op de gewijzigde bestanden: 23 problemen, gelijk aan de HEAD-baseline (allemaal bestaande `no-explicit-any`,
  `no-case-declarations` en één hooks-waarschuwing). Geen nieuwe; `useProductFieldAccess.ts` geeft 0.
- Harnas `prijs-slot` op 390 en 1280 px: exit 0. Warehouse: 3/3 variantprijsvelden uitgeschakeld, uitleg zichtbaar,
  opslaan stuurt geen prijsvelden mee, 5 slotjes in het raster, een klik op een prijscel opent geen invoer, de naamcel
  blijft bewerkbaar, geen horizontale overloop. Beheerder: geen uitleg, geen slotjes, velden aan. Engels gecontroleerd.
  Screenshots nagekeken (`/tmp/harness/prijs-slot-*.png`).

## Changelog (NL, type `security`)

**Titel:** Prijzen enkel nog door beheerders en medewerkers aan te passen

**Beschrijving:** Prijzen, kostprijzen en btw van producten en varianten kunnen nu enkel nog gewijzigd worden door
een beheerder of medewerker van je winkel, ook via prijzen in bulk aanpassen. Andere rollen, zoals magazijn of
marketing, zien ze nog maar kunnen ze niet meer wijzigen. In het productraster en op de variantentab staan die
velden voor hen op slot, met uitleg.

## Nieuwsbrief

Geen apart nieuwsbriefitem nodig; meenemen in de security-paragraaf van de volgende nieuwsbrief met de changelog-key.
