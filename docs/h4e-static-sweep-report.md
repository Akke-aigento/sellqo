# H4e — Static Permission Sweep Report

_Gegenereerd: 2026-06-09T06:41:12.822Z_

## Totalen per categorie

| Categorie | Aantal |
|---|---:|
| useCan | 16 |
| PermissionGate | 10 |
| GatedButton | 5 |
| MaskedValue | 0 |
| RouteGuard | 37 |
| sidebarRequireRead | 47 |
| **TOTAAL** | **115** |

## ❌ Onbekende (action, resource) combos — FAIL

_Geen — alle gating-calls verwijzen naar bestaande matrix-entries._

## ⚠️ Matrix-resources zonder UI-gating — INFO

Resources die in de matrix staan maar nergens in de UI worden gegated. Kan bewust zijn (puur RLS) of een ontbrekend gating-point.

- `refunds`
- `customer_notes`
- `vat`
- `webhooks_api`
- `team`
- `settings_financial`
- `automations`
- `social_channels`
- `ops_helpers`
- `global_lookups`
- `sellqo_legal`

## ⚠️ Matrix-entries met 0 toegelaten rollen — WARNING

| Resource | Action |
|---|---|
| `reports` | write |

## Alle gating-calls (detail)

### useCan (16)

| File | Line | Action | Resource |
|---|---:|---|---|
| `src/components/admin/CreateCreditNoteFromInvoiceButton.tsx` | 37 | write | credit_notes |
| `src/components/admin/CreditNotesTable.tsx` | 50 | write | credit_notes |
| `src/components/admin/DiscountCodeCard.tsx` | 27 | write | discount_codes |
| `src/components/admin/OrderBulkActions.tsx` | 70 | write | orders |
| `src/components/admin/OrderBulkActions.tsx` | 71 | read | reports |
| `src/components/admin/ads/BolCampaignEditForm.tsx` | 45 | write | ad_budgets |
| `src/components/admin/ads/CampaignCard.tsx` | 39 | write | ads |
| `src/components/admin/marketplace/OdooB2CAggregationSettings.tsx` | 16 | write | integrations |
| `src/hooks/useCan.ts` | 248 | write | orders |
| `src/pages/admin/CreditNotes.tsx` | 36 | write | credit_notes |
| `src/pages/admin/Customers.tsx` | 321 | write | customers |
| `src/pages/admin/Invoices.tsx` | 40 | write | invoices |
| `src/pages/admin/OrderDetail.tsx` | 64 | correct | order_status |
| `src/pages/admin/Orders.tsx` | 31 | write | orders |
| `src/pages/admin/Orders.tsx` | 245 | write | orders |
| `src/pages/admin/Orders.tsx` | 352 | write | orders |

### PermissionGate (10)

| File | Line | Action | Resource |
|---|---:|---|---|
| `src/components/PermissionGate.tsx` | 15 | write | orders |
| `src/components/admin/OrderCreditNotesSection.tsx` | 97 | write | credit_notes |
| `src/components/admin/OrderCreditNotesSection.tsx` | 131 | write | credit_notes |
| `src/pages/admin/Customers.tsx` | 133 | write | customers |
| `src/pages/admin/Invoices.tsx` | 258 | write | invoices |
| `src/pages/admin/ProductForm.tsx` | 883 | read | product_costs |
| `src/pages/admin/Products.tsx` | 422 | write | products |
| `src/pages/admin/Products.tsx` | 543 | write | products |
| `src/pages/admin/Products.tsx` | 629 | write | products |
| `src/pages/admin/Products.tsx` | 794 | write | products |

### GatedButton (5)

| File | Line | Action | Resource |
|---|---:|---|---|
| `src/pages/admin/Discounts.tsx` | 94 | write | discount_codes |
| `src/pages/admin/Discounts.tsx` | 139 | write | discount_codes |
| `src/pages/admin/Marketing.tsx` | 62 | write | marketing |
| `src/pages/admin/Marketing.tsx` | 66 | write | marketing |
| `src/pages/admin/Products.tsx` | 426 | write | products |

### MaskedValue (0)

_Geen._

### RouteGuard (37)

| File | Line | Action | Resource |
|---|---:|---|---|
| `src/App.tsx` | 169 | read | orders |
| `src/App.tsx` | 170 | read | products |
| `src/App.tsx` | 171 | write | products |
| `src/App.tsx` | 172 | write | products |
| `src/App.tsx` | 173 | read | orders |
| `src/App.tsx` | 174 | read | orders |
| `src/App.tsx` | 175 | read | returns |
| `src/App.tsx` | 176 | read | returns |
| `src/App.tsx` | 181 | read | invoices |
| `src/App.tsx` | 187 | read | discount_codes |
| `src/App.tsx` | 188 | read | discount_codes |
| `src/App.tsx` | 198 | read | customers |
| `src/App.tsx` | 199 | read | customers |
| `src/App.tsx` | 202 | read | payments |
| `src/App.tsx` | 203 | read | platform_billing |
| `src/App.tsx` | 204 | read | settings_general |
| `src/App.tsx` | 205 | read | integrations |
| `src/App.tsx` | 206 | read | integrations |
| `src/App.tsx` | 207 | read | integrations |
| `src/App.tsx` | 208 | read | marketing |
| `src/App.tsx` | 209 | read | ai_assistant |
| `src/App.tsx` | 210 | read | ai_coach |
| `src/App.tsx` | 212 | read | seo |
| `src/App.tsx` | 213 | read | cms |
| `src/App.tsx` | 214 | read | settings_general |
| `src/App.tsx` | 215 | read | integrations |
| `src/App.tsx` | 216 | read | reports |
| `src/App.tsx` | 217 | read | reports |
| `src/App.tsx` | 218 | read | suppliers |
| `src/App.tsx` | 219 | read | suppliers |
| `src/App.tsx` | 220 | read | suppliers |
| `src/App.tsx` | 221 | read | pos |
| `src/App.tsx` | 224 | read | themes |
| `src/App.tsx` | 225 | read | ads |
| `src/App.tsx` | 226 | read | ads |
| `src/App.tsx` | 230 | read | ads |
| `src/App.tsx` | 231 | read | ads |

### sidebarRequireRead (47)

| File | Line | Action | Resource |
|---|---:|---|---|
| `src/components/admin/sidebar/sidebarConfig.ts` | 103 | read | inbox |
| `src/components/admin/sidebar/sidebarConfig.ts` | 109 | read | orders |
| `src/components/admin/sidebar/sidebarConfig.ts` | 111 | read | orders |
| `src/components/admin/sidebar/sidebarConfig.ts` | 112 | read | orders |
| `src/components/admin/sidebar/sidebarConfig.ts` | 113 | read | returns |
| `src/components/admin/sidebar/sidebarConfig.ts` | 114 | read | invoices |
| `src/components/admin/sidebar/sidebarConfig.ts` | 115 | read | invoices |
| `src/components/admin/sidebar/sidebarConfig.ts` | 118 | read | products |
| `src/components/admin/sidebar/sidebarConfig.ts` | 119 | read | customers |
| `src/components/admin/sidebar/sidebarConfig.ts` | 124 | read | pos |
| `src/components/admin/sidebar/sidebarConfig.ts` | 125 | read | themes |
| `src/components/admin/sidebar/sidebarConfig.ts` | 126 | read | payments |
| `src/components/admin/sidebar/sidebarConfig.ts` | 133 | read | ads |
| `src/components/admin/sidebar/sidebarConfig.ts` | 135 | read | ads |
| `src/components/admin/sidebar/sidebarConfig.ts` | 136 | read | ads |
| `src/components/admin/sidebar/sidebarConfig.ts` | 137 | read | ads |
| `src/components/admin/sidebar/sidebarConfig.ts` | 141 | read | ads |
| `src/components/admin/sidebar/sidebarConfig.ts` | 149 | read | discount_codes |
| `src/components/admin/sidebar/sidebarConfig.ts` | 151 | read | discount_codes |
| `src/components/admin/sidebar/sidebarConfig.ts` | 152 | read | discount_codes |
| `src/components/admin/sidebar/sidebarConfig.ts` | 153 | read | discount_codes |
| `src/components/admin/sidebar/sidebarConfig.ts` | 154 | read | volume_discounts |
| `src/components/admin/sidebar/sidebarConfig.ts` | 155 | read | discount_codes |
| `src/components/admin/sidebar/sidebarConfig.ts` | 156 | read | discount_codes |
| `src/components/admin/sidebar/sidebarConfig.ts` | 157 | read | loyalty |
| `src/components/admin/sidebar/sidebarConfig.ts` | 158 | read | customers |
| `src/components/admin/sidebar/sidebarConfig.ts` | 159 | read | discount_codes |
| `src/components/admin/sidebar/sidebarConfig.ts` | 166 | read | marketing |
| `src/components/admin/sidebar/sidebarConfig.ts` | 173 | read | ai_assistant |
| `src/components/admin/sidebar/sidebarConfig.ts` | 175 | read | ai_assistant |
| `src/components/admin/sidebar/sidebarConfig.ts` | 176 | read | ai_coach |
| `src/components/admin/sidebar/sidebarConfig.ts` | 179 | read | seo |
| `src/components/admin/sidebar/sidebarConfig.ts` | 184 | read | products |
| `src/components/admin/sidebar/sidebarConfig.ts` | 185 | read | cms |
| `src/components/admin/sidebar/sidebarConfig.ts` | 192 | read | suppliers |
| `src/components/admin/sidebar/sidebarConfig.ts` | 194 | read | suppliers |
| `src/components/admin/sidebar/sidebarConfig.ts` | 195 | read | suppliers |
| `src/components/admin/sidebar/sidebarConfig.ts` | 196 | read | suppliers |
| `src/components/admin/sidebar/sidebarConfig.ts` | 204 | read | reports |
| `src/components/admin/sidebar/sidebarConfig.ts` | 206 | read | reports |
| `src/components/admin/sidebar/sidebarConfig.ts` | 207 | read | reports |
| `src/components/admin/sidebar/sidebarConfig.ts` | 215 | read | settings_general |
| `src/components/admin/sidebar/sidebarConfig.ts` | 223 | read | integrations |
| `src/components/admin/sidebar/sidebarConfig.ts` | 225 | read | integrations |
| `src/components/admin/sidebar/sidebarConfig.ts` | 226 | read | integrations |
| `src/components/admin/sidebar/sidebarConfig.ts` | 229 | read | platform_billing |
| `src/components/admin/sidebar/sidebarConfig.ts` | 230 | read | settings_general |
