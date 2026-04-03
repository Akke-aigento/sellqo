

## Per-tenant pagina-zichtbaarheid met inline toggles voor platform admins

### Wat wordt er gebouwd

Een systeem waarmee je als platform admin, wanneer je in "Admin View" bij een tenant zit, direct in de sidebar per pagina/menu-item kunt aan- of uitzetten wat die tenant mag zien. Onafhankelijk van het abonnement. De tenant ziet alleen wat jij hebt vrijgegeven.

### Aanpak

**1. Database: `hidden_pages` kolom op `tenant_feature_overrides`**

Voeg een `text[]` kolom toe aan de bestaande `tenant_feature_overrides` tabel:

```sql
ALTER TABLE public.tenant_feature_overrides 
ADD COLUMN IF NOT EXISTS hidden_pages text[] NOT NULL DEFAULT '{}';
```

Dit slaat sidebar-item-IDs op (bijv. `['storefront', 'campaigns', 'ai-tools']`) die voor die tenant verborgen moeten zijn.

**2. Hook: `useTenantPageOverrides`**

Nieuwe hook die voor de huidige tenant de `hidden_pages` ophaalt en toggle-functies biedt:
- `hiddenPages: string[]` — welke pagina's verborgen zijn
- `isPageHidden(itemId)` — check
- `togglePage(itemId)` — aan/uit zetten (upsert naar `tenant_feature_overrides`)

**3. AdminSidebar: inline toggle-iconen**

Wanneer `isPlatformAdmin && isAdminView`:
- Toon naast elk menu-item een klein oogje-icoon (Eye/EyeOff)
- Klikken toggle de pagina voor die tenant
- Verborgen items worden getoond met een rode doorstreping/dimmed stijl (admin ziet ze nog, maar ziet dat ze uit staan)

Wanneer de tenant zelf inlogt (of admin in "Tenant View"):
- Items in `hidden_pages` worden volledig verborgen, net als `isItemFeatureHidden`

**4. TenantModulesTab uitbreiden**

Op de platform Tenant Detail pagina ook een "Pagina Toegang" sectie toevoegen met alle sidebar-items als toggles. Zo kan het ook vanuit het platform beheer.

### Technisch detail

```text
shouldHideItem(item) checkt nu:
  1. isItemHidden (user preference)
  2. isItemRoleHidden (rol-gebaseerd)  
  3. isItemFeatureHidden (abonnement)
  4. NEW: isItemPageOverridden (tenant_feature_overrides.hidden_pages)
     → Skip als isPlatformAdmin && isAdminView
```

### Bestanden

| Bestand | Actie |
|---|---|
| Migratie | `hidden_pages text[]` kolom toevoegen |
| `src/hooks/useTenantPageOverrides.ts` | Nieuw — hidden_pages ophalen + toggle |
| `src/components/admin/AdminSidebar.tsx` | Inline Eye/EyeOff toggles + hiding logic |
| `src/components/platform/TenantModulesTab.tsx` | "Pagina Toegang" sectie toevoegen |

