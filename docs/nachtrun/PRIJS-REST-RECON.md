# PRIJS-REST-RECON — wie kan products.price wijzigen, en hoe sluiten we "prijs even op 0,01" — 2 november 2026

Alleen recon (batch VERVOLG-1, onderdeel E). Niets gebouwd, niets in de DB geschreven. Alle DB-feiten read-only
nagetrokken op de live DB (project 9932a7fe) op 2-11-2026.

## Het scenario

Een kassamedewerker zet met de JWT van het toestel via REST `products.price` op 0,01, tikt het product aan
(`add_line`), verstuurt, en zet de prijs terug. Gevolg: korting zonder akkoord van een verantwoordelijke
(KASSA-RECHTEN-1 omzeild) en zonder spoor van wie de prijs wijzigde.

**Werkt dat echt? Ja.** `horeca_apply_one` → `add_line` leest de prijs live:
`select pr.price … from public.products pr` → `v_price := round(p.price * 100)` (varianten idem uit
`product_variants.price`). Er is geen prijs-snapshot of vergelijking met een vorige prijs.

Wat wél een spoor laat: de P/ORDER en het kasticket bevatten de eenheidsprijs 0,01 (fiscaal correct
geregistreerd wat er gerekend is). Wat níet bestaat: wie de prijs wijzigde, wanneer, en dat het geen
geautoriseerde korting was.

## 1. Rechten vandaag (live)

**`products`** — grants: `authenticated` en `anon` hebben tabelbrede `INSERT`/`UPDATE` (geen kolom-grants).
RLS:

| Policy | Cmd | Wie |
|---|---|---|
| Users can update their tenant's products | UPDATE | lid van de winkel én `tenant_admin`, `staff`, `warehouse` of `marketing` (rol `{public}`, geen `with_check`) |
| Users can insert products for their tenant | INSERT | `tenant_admin`, `staff` |
| Platform admins can update any product | UPDATE | platformadmin |

**Trigger `trg_guard_product_commercial_fields`** (BEFORE UPDATE, `guard_product_commercial_fields()`):
- `auth.uid()` null (service role: edge functions, cron, imports) of platformadmin → alles mag.
- `tenant_admin` of `staff` → alles mag.
- `marketing` / `warehouse` (zonder admin/staff) → `price`, `compare_at_price`, `cost_price`, `vat_rate_id`,
  `takeaway_vat_rate_id`, `sku`, `barcode` geweigerd (42501); voorraad enkel voor `warehouse`.

Correctie op de opdracht: warehouse en marketing kunnen `products.price` dus **niet** via REST wijzigen; de
trigger houdt ze tegen. Het gat zit bij `tenant_admin` en `staff`.

**`product_variants`** — gevonden gat: UPDATE-policy "Tenant staff can update product_variants" laat
`tenant_admin`, `staff` **en `warehouse`** schrijven, en er is **geen** guard-trigger op deze tabel (enkel
`trg_product_variants_media_register` en `update_product_variants_updated_at`). Een warehouse-account kan dus
`product_variants.price` wijzigen, en `add_line` met `variant_id` rekent die prijs. (Grants: ook hier
tabelbreed voor `authenticated`/`anon`.)

**`product_addon_options`** (prijs van extra's, ook door `add_line` gelezen): schrijven enkel `tenant_admin`
of platformadmin.

## 2. Welke rol heeft een kassatoestel?

- Het toestel meldt zich aan met een gewone SellQo-account van de zaak (`src/kassa/app/screens/SignIn.tsx`:
  "beheerder of medewerker"); daarna werkt het personeel enkel met een PIN (`pos_cashiers`), zonder eigen JWT.
  Elke kassabediener werkt dus met de JWT van die ene account. Op het web (`/kassa`) staat die sessie in de
  browseropslag en is ze met de ontwikkelaarstools te lezen; in de native app is dat moeilijker, niet onmogelijk.
- Live `user_roles`: 16× `tenant_admin` (11 winkels), 1× `marketing`, 1× `platform_admin`, **0× `staff`**.
  In de praktijk draait elk kassatoestel vandaag dus op een **tenant_admin**-JWT (meestal die van de eigenaar).
- `kassa_devices` heeft geen kolom die het toestel aan een auth-user koppelt.

Gevolg voor het ontwerp: "staff mag price niet meer schrijven" alleen sluit het gat vandaag **niet**, want de
toestellen zijn tenant_admin. Dat helpt pas als toestellen met een aparte account met een beperkte rol aanmelden.

## 3. Paden die products.price schrijven

| Pad | Hoe | Rol / controle | Spoor vandaag |
|---|---|---|---|
| Admin-productformulier (`ProductForm.tsx` → `useProducts.updateProduct`) | REST `update` | RLS + guard; UI verbergt prijzen niet voor staff (`canEditCommercial = !isRestrictedRole`) | geen (enkel `updated_at`) |
| Productraster (`ProductGridView.tsx` → `useProducts.updateProduct`) | REST `update` | idem | geen |
| Bulkbewerking prijs (`useProducts` → RPC `bulk_adjust_prices`) | SECURITY DEFINER; checkt enkel "producten van eigen winkel", **geen rolcheck** (de guard vangt marketing/warehouse wel, want `auth.uid()` blijft de beller) | elk lid; guard | geen |
| Kaart: prijs in het productvenster (`useKaart.ts:181`) | REST `update` | RLS + guard | geen |
| Kaart: bulkprijzen (RPC `kaart_bulk_update`) | SECURITY DEFINER | `tenant_admin`, `staff` | geen |
| Kaart: maat toevoegen (RPC `kaart_duplicate_product`, `p_price`) | SECURITY DEFINER, INSERT | `tenant_admin`, `staff` | geen |
| Kassa: prijs aanpassen (RPC `kassa_product_quick_edit`) | SECURITY DEFINER; PIN van owner/manager, lockout | `tenant_admin`, `staff` + PIN | **ja**: `fiscal_audit_log` `kassa_product_edit` (old/new price, approver, staff, device) |
| Events/festival (`useEventWorkspace.ts`, `useFestival.ts`, `useEventTicketTypes.ts`) | REST `update`/`insert` ticketproducten | RLS + guard | geen |
| AI-assistent (`ai-assistant-action`, acties `price` en `bulk_price`) | REST met de JWT van de gebruiker (`asUser`) | rolcheck `tenant_admin`/`staff` in de functie + RLS + guard; bevestiging + AI-credit | `ai_actions`-rij (voor/na) |
| CSV-import (`run-csv-import`), Shopify/WooCommerce/bol/Odoo/Printful-sync, `create-tenant`, demo-reset | service role | `auth.uid()` null → guard laat door | geen (enkel importlogs) |
| Webshop-POS (`usePOS.ts`) | schrijft geen productprijs; rekent wel client-side (bekend, zie projectinstructies, buiten deze recon) | — | — |
| `product_variants.price` (`ProductVariantsTab` → `useProductVariants.ts`, imports) | REST / service role | `tenant_admin`, `staff`, **`warehouse`**, geen guard | geen |

## 4. Twee ontwerpen

### Ontwerp A — audit-trigger op elke prijswijziging (detecteren)

`AFTER UPDATE OF price, compare_at_price, cost_price, vat_rate_id, takeaway_vat_rate_id ON products` (en
`price` op `product_variants`, `price` op `product_addon_options`), `SECURITY DEFINER`, schrijft per gewijzigde
rij één rij in een **eigen** append-only log `product_price_audit` (tenant_id, product_id, variant_id, veld,
old, new, actor_id = `auth.uid()` (null = server), bron = `current_setting('sellqo.price_source', true)` die de
RPC's zetten: `kassa_quick_edit`, `kaart_bulk`, `bulk_adjust`, `ai_action`, `import`; leeg = `rest`).

- Waarom niet `fiscal_audit_log`: die hoort bij de GKS-kern (append-only, in het dossier); prijswijzigingen
  uit de webshop, imports en events horen daar niet. Wel: wijzigingen van een product dat op de kaart van een
  kassa staat **én** zonder bron `kassa_quick_edit` kunnen extra als `price_changed_outside_kassa` in
  `fiscal_audit_log`, zodat de kassa-audit compleet is. Eerst toetsen aan de eisenmatrix (projectdoc
  `claude/gks-eisenmatrix.md`, hier niet leesbaar) of de FOD dit verwacht.
- Signaal: een prijs die binnen bv. 15 minuten heen-en-terug gaat (`old → x → old`) met een `add_line`
  ertussen → melding (`notifications`, categorie `system`) aan de eigenaar, en zichtbaar in Rapporten.
- Impact per pad: geen enkel pad breekt. Kost: één insert per gewijzigde prijs (imports met duizenden
  regels → duizenden auditrijen; bron `import` kan per batch samengevat worden).
- Zwakte: houdt niets tegen, toont enkel achteraf. Met de toestel-JWT = eigenaar staat er "eigenaar" als
  actor; het onderscheid zit in bron `rest` + timing + `device`-loze wijziging.

### Ontwerp B — directe prijswijziging via REST dicht voor kassa-accounts (voorkomen)

1. **Kassatoestel krijgt een eigen account met een eigen rol** (bv. nieuwe `app_role` `pos_device`, of `staff`
   met een vlag), aangemaakt vanuit "Kassa › Toestellen" (de zaakvoerder koppelt een toestel, SellQo maakt de
   account). Deze stap is nodig, want vandaag zijn alle toestellen tenant_admin.
2. **`guard_product_commercial_fields` uitbreiden**: voor die rol (en eventueel `staff`) ook `price`,
   `compare_at_price`, `cost_price` en btw weigeren, **tenzij** de wijziging via een geautoriseerde RPC loopt
   (`set_config('sellqo.price_rpc', 'on', true)` in `kassa_product_quick_edit`, `kaart_bulk_update`,
   `kaart_duplicate_product`; de trigger checkt die vlag). Zelfde guard op `product_variants` en
   `product_addon_options` (nieuw), met `warehouse` ook geweerd.
   Alternatief voor 2: kolom-grants (`revoke update on products from authenticated; grant update (…alle kolommen
   behalve prijzen…)`). Afgeraden: geldt voor élke rol inclusief tenant_admin (breekt het productformulier,
   raster, Kaart en AI-acties die via REST schrijven), en elke nieuwe kolom moet dan expliciet gegrant worden
   (breekt stil bij een volgende migratie).
3. Impact per pad met B: kassa-app gebruikt al enkel `kassa_product_quick_edit` (blijft werken); Kaart-venster
   en productformulier schrijven via REST → voor de beperkte rol prijsveld uitschakelen (zoals nu voor
   marketing/warehouse), voor tenant_admin ongewijzigd; AI-acties: rolcheck in de functie (enkel tenant_admin
   voor prijs) of via een RPC met de vlag; imports/syncs (service role) ongewijzigd; `bulk_adjust_prices` krijgt
   een rolcheck (`tenant_admin`, `staff`) — los daarvan een gat dat dicht moet.

### Aanbeveling

**Beide, in deze volgorde, als twee batches:**

1. **PRIJS-AUDIT-1 (ontwerp A, klein, nu):** eigen `product_price_audit` + trigger op products, variants en
   addon-opties, bron via `set_config` in de vier RPC's, en een melding bij heen-en-terug rond een kassaverkoop.
   Breekt niets, geeft meteen zicht. Neem in dezelfde batch de twee losse gaten mee: guard op
   `product_variants`/`product_addon_options` (warehouse weg van prijzen) en een rolcheck in `bulk_adjust_prices`.
2. **KASSA-ACCOUNT-1 (ontwerp B):** toesteleigen account met beperkte rol + guard die prijzen enkel via de
   RPC's toelaat. Pas dit sluit het gat echt, omdat de toestel-JWT dan geen eigenaarsrechten meer heeft. Is
   ook los van prijzen gezond (vandaag kan elke kassabediener met de toestel-JWT alles wat de eigenaar kan in
   de admin-API, niet alleen prijzen).

Plan-scope (projectregel): geen nieuwe feature-sleutel; geldt voor alle plannen met kassa (`pos`/`horeca`).
Valt buiten `src/kassa/` zolang de kassa-app enkel `kassa_product_quick_edit` blijft aanroepen; stap 2 raakt
de aanmelding van de kassa-app (`SignIn`/`DeviceSetup`) en is dan wél een fiscale release (`KASSA_SW_VERSION`).

## Open vragen voor Akke

1. Mag een prijswijziging buiten de kassa óók in `fiscal_audit_log` (eisenmatrix nalezen), of enkel in een eigen log?
2. Toestelaccounts (B1): akkoord met een aparte account per zaak of per toestel? Per toestel geeft een beter
   spoor, per zaak is eenvoudiger beheer.
3. Melding bij heen-en-terug: drempel (15 min?) en naar wie (eigenaar enkel, of ook verantwoordelijken)?
