# H4e — Manuele Rookcheck Checklist

> Copy-paste deze checklist per rol bij regressie-tests. Vink af in PR
> of in een GitHub issue. Aanbevolen frequentie: bij elke major release
> die aan admin-UI raakt.

## Voorbereiding

- [ ] Test-tenant gekozen (default: Mancini Milano `2606c5b9-…`)
- [ ] Test-users aangemaakt per rol via `Platform → Tenants → Team`:
  - [ ] `tenant_admin@test.sellqo.app`
  - [ ] `staff@test.sellqo.app`
  - [ ] `accountant@test.sellqo.app`
  - [ ] `warehouse@test.sellqo.app`
  - [ ] `marketing@test.sellqo.app`
  - [ ] `viewer@test.sellqo.app`
- [ ] Alternatief: gebruik dev-only `🧪 Rol-simulator` (Ctrl+Shift+R) voor
      snelle UI-pre-check vóór echte rol-test.

---

## 🛡️ tenant_admin

- [ ] Sidebar toont **alle** items inclusief Settings, Billing, Team.
- [ ] `/admin/orders` → "Verwijderen" zichtbaar in bulk-bar én row-action.
- [ ] `/admin/products/:id/edit` → `cost_price`-veld zichtbaar en editable.
- [ ] `/admin/orders/invoices` → Peppol "Markeer als verzonden" + "Opnieuw versturen" zichtbaar.
- [ ] `/admin/ads/bolcom/campaigns/:id` → daily_budget / total_budget editable.
- [ ] `/admin/orders/discounts` → dropdown toont Bewerken + Verwijderen.
- [ ] `/admin/ads` → CampaignCard dropdown toont Bewerken + Pauzeren + Verwijderen.
- [ ] `/admin/settings` → opent zonder redirect.

## 👤 staff

- [ ] Sidebar verbergt Billing.
- [ ] `/admin/orders` → "Verwijderen" bulk-actie verborgen, status-update bulk wel.
- [ ] `/admin/products/:id/edit` → `cost_price`-veld VERBORGEN.
- [ ] `/admin/orders/invoices` → "Opnieuw versturen" zichtbaar, "Mark Peppol sent" zichtbaar.
- [ ] `/admin/ads/bolcom/campaigns/:id` → budget-velden DISABLED met tooltip "Geen toegang".
- [ ] `/admin/billing` → redirect naar `/no-access?from=/admin/billing`.
- [ ] `/admin/orders/discounts` → dropdown items VERBORGEN.

## 📊 accountant

- [ ] Sidebar toont Invoices/Reports/Billing; verbergt Products write CTA.
- [ ] `/admin/orders/invoices` → kan creditnota aanmaken (write op `credit_notes`).
- [ ] `/admin/orders` → "Verwijderen" bulk VERBORGEN; CSV-export zichtbaar.
- [ ] `/admin/customers/:id` → kan klantnotities lezen (read op `customer_notes`).
- [ ] `/admin/reports` → opent; export-knoppen actief.
- [ ] `/admin/settings` → opent (read).
- [ ] `/admin/marketing` → redirect naar `/no-access`.

## 📦 warehouse

- [ ] Sidebar toont Fulfillment + Products (read); verbergt Invoices, Marketing, Reports.
- [ ] `/admin/fulfillment` → bulk-acties (Mark shipped, Generate labels) zichtbaar.
- [ ] `/admin/products/:id/edit` → `cost_price` zichtbaar (read op `product_costs`).
- [ ] `/admin/orders` → "Verwijderen" VERBORGEN, status-update zichtbaar.
- [ ] `/admin/orders/invoices` → redirect naar `/no-access`.
- [ ] `/admin/customers` → kan lezen, "Nieuw" CTA disabled+tooltip.

## 📣 marketing

- [ ] Sidebar verbergt Invoices, Reports, Billing, Fulfillment.
- [ ] `/admin/marketing/*` → volledig toegang inclusief campagnes-edit.
- [ ] `/admin/orders/discounts` → dropdown Bewerken + Verwijderen zichtbaar.
- [ ] `/admin/ads/bolcom/campaigns/:id` → naam/targeting editable, budget DISABLED.
- [ ] `/admin/ads` → CampaignCard dropdown toont alle write-items.
- [ ] `/admin/orders` → kan lezen, "Verwijderen" verborgen.
- [ ] `/admin/customers` → kan lezen, write-CTA disabled.

## 👀 viewer

- [ ] Sidebar toont alleen read-pages.
- [ ] Alle "Nieuw" / "Aanmaken" knoppen disabled met tooltip "Geen toegang".
- [ ] `<ReadOnlyBadge>` zichtbaar bij Orders, Products, Customers, Invoices, Discounts.
- [ ] Geen dropdown row-actions zichtbaar.
- [ ] `/admin/settings` → opent in read-only modus (geen save-bar).
- [ ] `/admin/ads/bolcom/campaigns/:id` → budget DISABLED.

---

## 🔀 Cross-tenant (H4-5 verificatie)

- [ ] Maak user met `tenant_admin` op Tenant A én `viewer` op Tenant B.
- [ ] Login → kies Tenant A in tenant-switcher.
      - [ ] Sidebar gedraagt zich als tenant_admin.
      - [ ] Bulk-delete in Orders zichtbaar.
- [ ] Switch naar Tenant B.
      - [ ] Sidebar gedraagt zich als viewer.
      - [ ] Bulk-delete VERBORGEN, ReadOnlyBadge zichtbaar.
- [ ] Geen UI-flikker met admin-rechten tijdens switch (cf. H4-5 fix in `useCan`).

## 🔁 RouteGuard redirect-test

- [ ] Open `/admin/billing` als viewer → redirect naar `/no-access?from=/admin/billing`.
- [ ] NoAccess-pagina toont:
      - [ ] "Geen toegang tot Facturatie" (humaan label, geen pad).
      - [ ] "Vraag toegang aan"-knop opent mailto naar tenant-owner.
- [ ] Browser back werkt; geen redirect-loop.

---

## Smoke-conditie: console

- [ ] Geen `Failed prop type` warnings.
- [ ] Geen `useCan: matrix lookup miss` errors.
- [ ] `node scripts/verify-permissions-matrix.mjs` exit 0.
- [ ] `node scripts/verify-route-coverage.mjs` exit 0.