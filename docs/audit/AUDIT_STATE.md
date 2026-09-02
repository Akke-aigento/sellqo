# AUDIT_STATE — SellQo volledige pagina-audit

Geheugen tussen sessies. **CC leest dit als eerste, altijd** (runbook §1).

| | |
|---|---|
| **pinned_sha** | `037819858ac875cba2a4c6c95e14d0d238546b59` |
| **Datum pin** | 2026-09-02 |
| **Audit-branch** | `audit-run` — rapporten committen hier, `main` blijft schoon tot fixes gemerged worden |
| **Runbook** | `docs/audit/RUNBOOK.md` v2 (autonome motor) |
| **Laatste run** | 2026-09-02 — run 0 + batch 1 (Storefront) afgerond |
| **Aard** | Audit-run. Geen productcode gewijzigd; uitsluitend geschreven onder `docs/audit/**` (runbook §9). |

`origin/main` en lokale `HEAD` stonden beide al op `03781985`; de pin vroeg geen checkout-sprong.

---

## Voortgang per batch

Routetellingen zijn feitelijk uit `src/App.tsx` @ `03781985` (124 `path=`-declaraties + 1 `index`-route = **125** entries). Volledige lijst: `reports/route-inventory.md`.

| Batch | Gebied | Routes | Status | Rapport |
|---|---|---|---|---|
| 0 | Visuele quick-scan (laag 2, alle routes) | 125 | ✅ af — 🔴4 🟡7 🟢9 | `reports/00-visual-quickscan.md` |
| 1 | Storefront `/shop/:tenantSlug/*` | 10 | ✅ af — 🔴12 🟡16 🟢35 | `reports/01-storefront-gedeeld.md` + 10 pagina-rapporten |
| 2 | Betaal- & onboarding-flows | 6 | ⏸ | — |
| 3 | Admin: Orders & facturatie | 8 | ⏸ | — |
| 4 | Admin: Producten & voorraad | 14 | ⏸ | — |
| 5 | Admin: Klanten & POS | 9 | ⏸ | — |
| 6 | Admin: Marketing, ads & promoties | 23 | ⏸ | — |
| 7 | Admin: Overig & instellingen | 12 | ⏸ | — |
| 8 | Platform-admin `platform/*` | 13 | ⏸ | — |
| 9 | Publieke marketingsite | 22 | ⏸ | — |
| 10 | Auth | 3 | ⏸ | — |
| — | **Niet aan een batch toegewezen** | **5** | ⚠️ zie errata E-1 | — |

Legenda: ⏸ niet gestart · 🔄 bezig · ✅ af · 🔁 herverificatie nodig na fixbatch

### Status per pagina
Wordt per batch ingevuld zodra die batch loopt.

---

## Open 🟡 — natrek voor laag 3 (chat-Claude via Lovable-connector)

Uitgeschreven queries staan in `reports/00-visual-quickscan.md` §🟡 — klaar om te copy-pasten.

| ID | Onderwerp | Blokkeert | Status |
|---|---|---|---|
| D-1 | Is `sellqo_legal_pages.content` nullable, en heeft een gepubliceerde rij lege content? | ernstbepaling 🔴 V-1 | ⏳ open |
| D-2 | Bestaan alle 7 juridische slugs, incl. `account-deletion`? | 🔴 V-4 | ⏳ open |
| D-3 | RLS/policies op `sellqo_legal_pages` — wie mag `content` schrijven? (XSS-oppervlak) | security-oordeel | ⏳ open |
| D-4 | Echte slug van SellQo Speeltuin, voor een storefront-herscan met data | batch 1 | ⏳ open |
| D-5 | `role_permissions` voor de 26 ongeguarde admin-routes | batch 3/4/6 | ⏳ open |
| D-6 | Gedragsvingerafdruk: zijn `auth-email-hook` en `send-return-email` live gedeployed? | 🔴 V-2, V-3 | ⏳ open |
| M-1 | Handmatige spotcheck door Akke: 5 ingelogde admin-routes op 375px en 1440px | 101 ongeziene routes | ⏳ open |
| S-4 | Is de embed `products → categories` ondubbelzinnig? (`pg_constraint`) | hele productcatalogus batch 1 | ⏳ open |
| S-5 | Wie mag `tenant_theme_settings.custom_head_scripts` schrijven? (scriptuitvoering) | security-oordeel | ⏳ open |
| S-6 | Echte slug van SellQo Speeltuin (identiek aan D-4) | visuele herscan batch 1 | ⏳ open |
| B1-C2 | Hoeveel actieve producten per tenant? (ernst van de onbounded fetch) | `01-shop-products.md` 🔴 C1 | ⏳ open |
| B1-C3 | Grootste categorie qua gekoppelde producten (`IN`-lijstlengte) | `01-shop-products.md` | ⏳ open |
| B1-D1 | RLS op `legal_pages` / `storefront_pages` (XSS via `dangerouslySetInnerHTML`) | security-oordeel | ⏳ open |
| B1-D2 | Gedragsvingerafdruk van de zes checkout-acties in `storefront-api` | `01-shop-checkout.md` | ⏳ open |
| B1-B1 | Klopt de OGM-mededeling + QR-bedrag op overschrijvingsorders? | `01-shop-qr-betaling.md` | ⏳ open |
| B1-E1 | Welke `locale`-waarden staan er feitelijk op orders? | meet effect van S-2 | ⏳ open |
| B1-V1 | Bestaat `product_variants.linked_product_slug`, of alleen `_id`? | `01-shop-product-detail.md` | ⏳ open |

---

## Herverificatie openstaand

- `platform/tenants/:tenantId` — geaudit 1 sep 2026, drie open fixes (onboarding-link cross-origin-302, ambigue plan-embed `plan_id`+`pending_plan_id`, "Activeer abonnement"-no-op). Eénmalig herverifiëren ná fix-deploy, dan afvinken (runbook §7). Batch 8 slaat deze pagina over tot dan.

---

## Runbook-errata

Afwijkingen tussen het runbook en wat de code feitelijk zegt. Hier genoteerd, **niet** stilzwijgend in het runbook gecorrigeerd (kickoff-regel).

### E-1 — Vijf routes vallen buiten élke batch van §6
**Wat §6 zegt:** tien batches die samen "elke pagina" heten te dekken; §Doel: "Geen steekproef, geen aannames."
**Wat de code zegt:** van de 125 route-entries in `src/App.tsx` valt geen enkele batch over deze vijf:

| Route | Component | `App.tsx` | Waarom het telt |
|---|---|---|---|
| `/admin/payments` | `PaymentsPage` | 244 | **Geld-kritiek.** §6 batch 8 noemt `payments`, maar dat is `platform/payments` (regel 344). De tenant-pagina komt in geen enkele batchopsomming voor. |
| `/admin/orders/subscriptions` | `SubscriptionsPage` | 228 | **Geld-kritiek.** Batch 3 somt op: "orders, order-detail, discounts, invoices, quotes (+detail/edit)" — abonnementen ontbreken. |
| `/admin/orders/creditnotes` | `Navigate` → `/admin/orders/invoices?tab=creditnotes` | 225-227 | Redirect-route. Laag risico, maar hoort expliciet in batch 3 afgevinkt. |
| `/admin` | `AdminLayout` (layout-route) | 200-204 | Draagt `ProtectedRoute`; de guard zelf is auditwaardig. De `index` eronder (`AdminDashboard`, regel 205) valt wél onder batch 7 "dashboard". |
| `*` | `NotFound` | 377 | 404-pagina, in geen enkele batch. |

**Gevolg:** twee geld-kritieke tenant-pagina's zouden stil buiten de audit vallen.
**Voorstel:** `payments`, `orders/subscriptions` en `orders/creditnotes` toevoegen aan batch 3; `/admin`-guard aan batch 7; `*` aan batch 9. Wacht op Akke's akkoord — het runbook wordt niet eigenmachtig gewijzigd.

### Ingetrokken errata
- **E-0 (ingetrokken):** vermoeden dat de mail-renders ten onrechte vier talen noemen terwijl `SUPPORTED_LANGUAGES` er vijf telt. Onterecht: runbook §2E maakt het onderscheid expliciet ("E-mail-i18n is apart ... 4 talen (nl/en/fr/de, GÉÉN uk)") en `supabase/functions/_shared/tenantEmailI18n.ts` definieert inderdaad alleen `nl` (151), `en` (270), `fr` (389), `de` (508). Het runbook heeft gelijk. Dat de e-mailtalen achterlopen op de vijf app-talen is een reële, bij het runbook bekende beperking — geregistreerd als bevinding in run 0, niet als errata.

---

## Toolchain-baseline @ `03781985`

Eénmalig gedraaid bij kickoff. Alles groen — er is dus géén bestaande ruis waartegen latere bevindingen weggestreept moeten worden.

| Check | Commando | Uitkomst |
|---|---|---|
| Dependencies | `npm ci` | exit 0 |
| Build | `npm run build` | exit 0, ✓ built in 59.36s |
| Typecheck | `npx tsc --noEmit -p tsconfig.app.json` | **exit 0, 0 fouten** |
| i18n-pariteit | `node scripts/i18n-parity.mjs` | **exit 0** — 5 talen (de/en/fr/nl/uk), 5165/5165 keys elk, volledige pariteit |

Bekende, niet-regressieve ruis: chunk-size-waarschuwing (`index-CQKokvYX.js` 9,16 MB / 2,51 MB gzip) en een verouderde `caniuse-lite`. Beide bestaand, conform CLAUDE.md §6.

---

## Bevindingen run 0 — samenvatting

🔴 4 · 🟡 7 · 🟢 9. Volledig rapport: `reports/00-visual-quickscan.md`.

| ID | Bevinding | Bestand |
|---|---|---|
| 🔴 V-1 | Alle 7 juridische pagina's crashen naar wit scherm op contentloze data | `src/pages/SellqoLegal.tsx:84` |
| 🔴 V-2 | Auth-mails: Engels onderwerp op Nederlandse body, geen taalkeuze | `supabase/functions/auth-email-hook/index.ts:19-26` |
| 🔴 V-3 | Duitse klanten krijgen Nederlandse retourmails; DE-vertalingen liggen ongebruikt | `supabase/functions/send-return-email/index.ts:17,42-58,84` |
| 🔴 V-4 | `/account-deletion` heeft geen type in `LEGAL_PAGE_TYPES` → onbeheerbaar | `src/hooks/useSellqoLegal.ts:18-25` |

**Fixes zijn niet uitgevoerd** (runbook §9). Geen productcode gewijzigd; `git status` op de productmappen is schoon.

### Aandachtspunt voor Akke — dood gewicht met een vraag
`supabase/functions/_shared/email-templates/index.ts` (6 KB, string-gebaseerde auth-mailrenderer) wordt nergens geïmporteerd, terwijl z'n eigen header claimt de gebruikte stack te zijn. Runbook §2F waarschuwt tegen blind schrappen: was dit de bedoelde vervanger die nooit is aangesloten? Zo ja, dan raakt hij 🔴 V-2. Niet aangeraakt.

---

## Bevindingen batch 1 — Storefront

🔴 12 · 🟡 16 · 🟢 35. Elf rapporten: `reports/01-storefront-gedeeld.md` plus één per pagina.

| ID | Bevinding | Bestand |
|---|---|---|
| 🔴 S-1 | De taalkiezer van de winkel doet niets — schrijft alleen localStorage | `ShopLayout.tsx:121-124` |
| 🔴 S-2 | Checkout stuurt `i18n.language` i.p.v. de gekozen winkeltaal naar `storefront-api` | `ShopCheckout.tsx:270,320` |
| 🔴 S-3 | Storefront-pagina's zijn feitelijk eentalig NL (3 `t()` op 2805 regels) | 10 pagina's |
| 🔴 cart-A1 | Kortingscode-knop valideert niets en weigert élke code | `ShopCart.tsx:55-64` |
| 🔴 products-C1 | Productoverzicht haalt de hele catalogus op, zonder limiet of paginering | `ShopProducts.tsx:39-42` |
| 🔴 detail-A1 | Gekoppelde-productvarianten werken niet; de code erachter zou naar een 404 leiden | `ShopProductDetail.tsx:136-139` |
| 🔴 legal-E1 | Juridische pagina's tonen altijd Nederlands, vertalingen liggen ongebruikt | `ShopLegalPage.tsx:43,45,61,80,88` |
| 🔴 wishlist-B1 | Elk verlanglijst-item claimt "op voorraad" (`in_stock: true` hardcoded) | `ShopWishlist.tsx:18-26` |
| 🔴 checkout-A1 | Onbekend `payment_type` leegt de winkelwagen en doet verder niets | `ShopCheckout.tsx:403-420` |
| 🔴 checkout-E1 | E-mailadres wordt nooit op vorm gecontroleerd | `ShopCheckout.tsx:242-245` |
| 🔴 qr-A1 | QR-pagina zonder navigatiestatus openen wist de winkelwagen | `ShopQRPayment.tsx:34-43` |
| 🔴 order-B1 | Mislukte order-ophaling wordt getoond als "geen bestelling" | `ShopOrderConfirmation.tsx:69-73` |

**Fixes zijn niet uitgevoerd** (runbook §9). Geen productcode gewijzigd.
