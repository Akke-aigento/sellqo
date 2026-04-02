

## Platform Admin: Volledige toegang + Admin/Tenant View Toggle

### Probleem

Als platform admin en je switcht naar een tenant met een beperkt abonnement:
1. **FeatureGate** blokkeert features op basis van het tenant-abonnement
2. **AdminSidebar** verbergt menu-items op basis van subscription features
3. **useUsageLimits** enforced limieten (producten, orders, etc.)
4. **TrialExpiredBlocker** kan toegang blokkeren (dit werkt al correct voor platform admins)

Je mist een manier om te zien wat de tenant zelf zou zien vs. jouw volledige toegang.

### Wijzigingen

**1. `src/hooks/useUsageLimits.ts`** — Platform admin bypass

- Voeg `isPlatformAdmin` check toe uit `useAuth()`
- `checkFeature()`: return `true` als `isPlatformAdmin` (naast bestaande `isUnlimited` check)
- `checkLimit()` en `enforceLimit()`: bypass als `isPlatformAdmin`
- Dit fixt automatisch alle `FeatureGate` componenten in de hele app

**2. `src/components/admin/AdminSidebar.tsx`** — Bypass feature-hiding

- In `isItemFeatureHidden()`: return `false` als `isPlatformAdmin` (toon alle items)

**3. Nieuw: `src/hooks/usePlatformViewMode.ts`** — View mode context

- React context met state: `'admin'` (default voor platform admins) of `'tenant'`
- `admin` mode = volledige toegang, alle features zichtbaar
- `tenant` mode = zie exact wat de tenant ziet (respecteer subscription/limieten)
- Persist in sessionStorage (niet localStorage — per tab)
- Exporteert `viewMode`, `setViewMode`, `isAdminView`

**4. `src/components/admin/AdminHeader.tsx`** — View mode toggle

- Alleen zichtbaar als `isPlatformAdmin` en een tenant geselecteerd is
- Toggle knop/switch: "Admin View" ↔ "Tenant View"
- Visuele indicator (badge/kleur) zodat je altijd weet in welke modus je zit
- Bijv. oranje banner "Je bekijkt als tenant" in tenant-modus

**5. Integratie in bypass-logica**

- `useUsageLimits`: bypass alleen als `isPlatformAdmin && isAdminView`
- `AdminSidebar.isItemFeatureHidden`: bypass alleen als `isPlatformAdmin && isAdminView`
- Zo kun je snel schakelen om te zien wat de klant ziet

**6. `src/components/admin/AdminLayout.tsx`** — Provider toevoegen

- Wrap `AdminLayoutContent` met `PlatformViewModeProvider`

### Bestanden

| Bestand | Actie |
|---|---|
| `src/hooks/usePlatformViewMode.ts` | Nieuw — context + provider voor view mode |
| `src/hooks/useUsageLimits.ts` | Platform admin + view mode bypass |
| `src/components/admin/AdminSidebar.tsx` | Feature-hiding bypass |
| `src/components/admin/AdminHeader.tsx` | Toggle knop toevoegen |
| `src/components/admin/AdminLayout.tsx` | Provider wrappen |

### Geen database wijzigingen nodig

