

## Fix: InvoiceAutomationSettings laadt verkeerde tenant

### Oorzaak
`InvoiceAutomationSettings` gebruikt `useAuth().roles.find(r => r.tenant_id)?.tenant_id` om de tenant te bepalen, terwijl alle andere settings-componenten `useTenant().currentTenant` gebruiken. Hierdoor wordt mogelijk data van een andere tenant geladen dan de geselecteerde in de tenant-switcher.

De database bevestigt dat VanXcel wél een BCC-adres heeft (`verkoopdagboek-shopify@nomadix-bv.odoo.com`), maar het component laadt waarschijnlijk een andere tenant waar deze waarde `null` is.

### Wijziging

**Bestand: `src/components/admin/settings/InvoiceAutomationSettings.tsx`**

- Import `useTenant` i.p.v. `useAuth`
- Vervang `const { roles } = useAuth(); const activeTenantId = roles.find(r => r.tenant_id)?.tenant_id;` door `const { currentTenant } = useTenant(); const activeTenantId = currentTenant?.id;`
- Alle overige code blijft identiek — `activeTenantId` wordt al overal correct gebruikt

### Bestanden

| Bestand | Actie |
|---|---|
| `src/components/admin/settings/InvoiceAutomationSettings.tsx` | `useAuth` → `useTenant` voor tenant ID |

### Geen database wijzigingen nodig

