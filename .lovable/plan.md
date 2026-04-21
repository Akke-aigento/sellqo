

## Tenant ID zichtbaar maken in Tenant Details

Op de "Overzicht"-tab van een tenant (`/admin/platform/tenants/:tenantId`) staat momenteel onderaan een "Tenant Details"-blok met Naam, Slug, Status en Laatst bijgewerkt. De UUID ontbreekt — die wil je als platform eigenaar kunnen zien én snel kunnen kopiëren.

### Wijziging

**Bestand**: `src/components/platform/TenantOverviewTab.tsx`

In het "Tenant Details"-grid wordt één extra veld toegevoegd: **Tenant ID**, met de volledige UUID in `font-mono` en een kleine kopieerknop ernaast.

- Label: `Tenant ID`
- Waarde: `tenant.id` in `font-mono text-sm`, selecteerbaar
- Naast de waarde een ghost-button (icoon `Copy` van lucide-react) die `navigator.clipboard.writeText(tenant.id)` aanroept en een toast toont (`"Tenant ID gekopieerd"`)
- Plaatsing: bovenaan het Details-blok (boven Naam), zodat het direct opvalt voor admins

### Niet aanraken
- Geen wijziging in `usePlatformAdmin` of `useTenantDetail` — `tenant.id` zit al in de payload.
- Geen wijziging in tenant-lijstpagina (UUID's daar tonen zou de tabel onleesbaar maken; detailpagina is de juiste plek).
- Geen extra tab of sectie — past binnen bestaande "Tenant Details"-card.

### Acceptance
1. Open een tenant detail → Overzicht tab → "Tenant ID" zichtbaar bovenaan Tenant Details met volledige UUID.
2. Klik op kopieer-icoon → UUID staat op klembord, toast bevestigt.
3. UUID is selecteerbaar voor handmatig kopiëren.
4. Werkt identiek voor SellQo Sandbox (`75c80e40-…`), Mancini, VanXcel, en alle overige tenants.

