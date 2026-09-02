# AUDIT_STATE — SellQo volledige pagina-audit

Geheugen tussen sessies. **CC leest dit als eerste, altijd** (runbook §1).

| | |
|---|---|
| **pinned_sha** | `037819858ac875cba2a4c6c95e14d0d238546b59` |
| **Datum pin** | 2026-09-02 |
| **Audit-branch** | `audit-run` — rapporten committen hier, `main` blijft schoon tot fixes gemerged worden |
| **Runbook** | `docs/audit/RUNBOOK.md` v2 (autonome motor) |
| **Laatste run** | 2026-09-02 — stap 0 (setup) afgerond |
| **Aard** | Audit-run. Geen productcode gewijzigd; uitsluitend geschreven onder `docs/audit/**` (runbook §9). |

`origin/main` en lokale `HEAD` stonden beide al op `03781985`; de pin vroeg geen checkout-sprong.

---

## Voortgang per batch

Routetellingen zijn feitelijk uit `src/App.tsx` @ `03781985` (124 `path=`-declaraties + 1 `index`-route = **125** entries). Volledige lijst: `reports/route-inventory.md`.

| Batch | Gebied | Routes | Status | Rapport |
|---|---|---|---|---|
| 0 | Visuele quick-scan (laag 2, alle routes) | 125 | 🔄 bezig | `reports/00-visual-quickscan.md` |
| 1 | Storefront `/shop/:tenantSlug/*` | 10 | ⏸ | — |
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

Nog geen. Wordt gevuld vanaf run 0 / batch 1. Elk item krijgt de exacte natrek-query uitgeschreven (runbook §4).

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
