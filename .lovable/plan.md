

## Drie fixes: Inbox hernoemen, toggle-bug fixen, Verzending verplaatsen

### 1. "Gesprekken" hernoemen naar "Inbox"
**Bestand:** `src/components/admin/sidebar/sidebarConfig.ts` regel 80
- `title: 'Gesprekken'` → `title: 'Inbox'`

**Bestand:** `src/components/admin/sidebar/InboxNavItem.tsx` regel 30
- `<span>Gesprekken</span>` → `<span>Inbox</span>`

### 2. Toggle zichtbaar/onzichtbaar bug fixen
**Bestand:** `src/hooks/useTenantPageOverrides.ts` regel 55-56

De `onSuccess` van `togglePageMutation` zet de query-cache naar een platte array (`newHidden`), maar de query verwacht een object `{ hiddenPages: string[], grantedFeatures: string[] }`. Na de eerste toggle wordt de cache-structuur corrupt, waardoor `overrides?.hiddenPages` `undefined` wordt en de toggle niet meer werkt.

Fix: de `onSuccess` callback het juiste object-formaat laten schrijven:
```typescript
onSuccess: (newHidden) => {
  queryClient.setQueryData(['tenant-page-overrides', tenantId], (old: any) => ({
    hiddenPages: newHidden,
    grantedFeatures: old?.grantedFeatures || [],
  }));
  queryClient.invalidateQueries({ queryKey: ['platform-tenant-overrides'] });
},
```

Dezelfde fix voor `setHiddenPages.onSuccess` (regel 81-82) — zelfde probleem.

### 3. Verzending verplaatsen van Systeem naar Beheer
**Bestand:** `src/components/admin/sidebar/sidebarConfig.ts`
- Regel 195 verwijderen uit `systemItems`
- Toevoegen aan `managementItems` (na Rapporten)

### Bestanden die wijzigen
- `src/components/admin/sidebar/sidebarConfig.ts` — hernoemen + verplaatsen
- `src/components/admin/sidebar/InboxNavItem.tsx` — hernoemen
- `src/hooks/useTenantPageOverrides.ts` — cache-bug fixen

