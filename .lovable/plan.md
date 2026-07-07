## Probleem

De zijbalk verbergt items via `tenant_feature_overrides.hidden_pages` (zoals `pos`, `integrations`, `integrations-connect`, `ai-tools`), maar het **dashboard** houdt daar geen rekening mee. Widgets zoals POS-overzicht, Marketplace en AI Coach — en snelkoppelingen in Quick Actions — blijven zichtbaar en klikbaar, óók als de pagina in de zijbalk verborgen is. Alleen `requiredFeature` (abonnement) wordt gecheckt.

De bestaande logica die dit correct doet in de zijbalk: `isFeatureGranted` overrulet — dus als admin een feature expliciet grant, blijft alles zichtbaar. Diezelfde regel geldt automatisch omdat `hidden_pages` een aparte lijst is die admins beheren.

## Oplossing

Dashboard-widgets en Quick Actions koppelen aan hun sidebar page-id en verbergen als die in `hiddenPages` staat. Platform admins in admin view zien alles (consistent met sidebar-gedrag).

### 1. `src/config/dashboardWidgets.ts`
Nieuw optioneel veld `pageId?: string` (of `pageIds?: string[]`) toevoegen aan `DashboardWidgetDefinition`. Mapping invullen voor de relevante widgets:

- `pos-overview` → `pageId: 'pos'`
- `marketplace` → `pageId: 'integrations'` (parent-groep; SellQo Connect zit hieronder)
- `ai-marketing` → `pageId: 'ai-tools'`

Health/Today/Quick-actions/Badges krijgen geen `pageId` (geen 1-op-1 pagina).

### 2. `src/components/admin/DashboardGrid.tsx`
- `useTenantPageOverrides()` importeren, `isPageHidden` gebruiken.
- `usePlatformViewMode()` + `useAuth()` gebruiken voor de bypass (platform-admin + admin-view).
- `visibleWidgets` filter uitbreiden:
  ```ts
  const visibleWidgets = widgetOrder.filter((id) => {
    if (!isWidgetVisible(id)) return false;
    const def = getWidgetById(id);
    if (def?.pageId) {
      const bypass = isPlatformAdmin && isAdminView;
      if (!bypass && isPageHidden(def.pageId)) return false;
    }
    return true;
  });
  ```

### 3. `src/components/admin/widgets/QuickActionsWidget.tsx`
Elke snelkoppeling koppelen aan een sidebar-id en filteren via `useTenantPageOverrides().isPageHidden` (met dezelfde platform-admin bypass):

- "Nieuw product" → `products`
- "Bestellingen" → `orders` (parent) of `orders-all`
- "Categorieën" → `categories`

Als een item verborgen is: knop niet renderen. Als álle knoppen verborgen zijn: hele widget-inhoud vervangen door een korte lege staat (of gewoon `null` render — de DashboardGrid toont dan simpelweg minder).

### 4. `DashboardCustomizeDialog` (optioneel, klein)
In het "verborgen widgets" overzicht een read-only "Verborgen door beheerder" label tonen als `pageId` in `hiddenPages` zit, zodat de gebruiker begrijpt waarom die widget niet aan te zetten is. Niet noodzakelijk voor de fix, maar voorkomt verwarring. Ik neem dit alleen mee als kleine polish.

## Scope-notitie

Dit betreft alleen de **dashboardweergave** (zoals gevraagd). Directe URL-toegang tot `/admin/pos` etc. wordt niet geblokkeerd door `hidden_pages` — dat is een aparte laag (RouteGuard werkt op permissie-matrix, niet op `hidden_pages`). Laat het weten als je wilt dat ik dat ook doortrek naar RouteGuard.

## Bestanden

- `src/config/dashboardWidgets.ts` — veld toevoegen + mapping
- `src/components/admin/DashboardGrid.tsx` — filter uitbreiden
- `src/components/admin/widgets/QuickActionsWidget.tsx` — per-actie filteren

Geen DB-migratie, geen edge-functions.