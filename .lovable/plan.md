

## Twee issues: Verzending loskoppelen + Admin page-verbergen fix

### Issue 1: Verzending hoort niet onder SellQo Connect

In `src/components/admin/sidebar/sidebarConfig.ts` staat "Verzending" als child van "SellQo Connect" (regel 193). Dit is onlogisch — verzending is een kernfunctie van de winkel, niet een integratie/kanaal.

**Aanpak:**
- "Verzending" verplaatsen naar een eigen top-level item in de **Systeem**-groep (naast Instellingen), met het `Truck` icoon dat al geïmporteerd is
- Het item `integrations-shipping` hernoemen naar `shipping` met eigen url `/admin/shipping`
- `WAREHOUSE_ALLOWED_ITEMS` bijwerken van `'integrations-shipping'` naar `'shipping'`

### Issue 2: Admin kan pagina's niet verbergen

De oog-toggles (👁) voor het verbergen van pagina's zijn alleen zichtbaar wanneer `showAdminToggles = isPlatformAdmin && isAdminView` (regel 136 in AdminSidebar). Dit betekent dat de Admin/Tenant toggle-switch in de header op "Admin" moet staan.

Mogelijke oorzaken waarom het niet werkt:
1. De switch staat op "Tenant" mode — dan worden de eye-toggles verborgen
2. Er is geen `currentTenant` geselecteerd — dan toont de header de switch niet (regel 69 van AdminHeader: `isPlatformAdmin && currentTenant`)
3. De `tenant_feature_overrides` tabel geeft een RLS-fout bij het opslaan

**Aanpak:**
- Controleren of de toggle daadwerkelijk zichtbaar is en werkt wanneer Admin View actief is
- Een duidelijker visueel signaal toevoegen wanneer Admin View actief is (bijv. een subtiele banner boven de sidebar)
- De eye-toggle knoppen iets groter/duidelijker maken zodat ze niet over het hoofd worden gezien

### Bestanden die wijzigen
- `src/components/admin/sidebar/sidebarConfig.ts` — Verzending verplaatsen naar eigen item
- `src/components/admin/AdminSidebar.tsx` — eventuele visuele verbeteringen aan page-toggle indicators

### Technische details

```text
sidebarConfig.ts wijzigingen:

// Verzending uit SellQo Connect children halen
integrations children: [connect, import]  (zonder shipping)

// Nieuw top-level item in systemItems toevoegen
{ id: 'shipping', title: 'Verzending', url: '/admin/shipping', icon: Truck }

// WAREHOUSE_ALLOWED_ITEMS updaten
'integrations-shipping' → 'shipping'
```

