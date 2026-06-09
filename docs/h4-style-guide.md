# Hoofdstuk 4 — Frontend Gating Style Guide

Korte spelregels voor nieuwe admin-pagina's en componenten. Volledig
achtergrondverhaal staat in `docs/sellqo-fase2-masterplan.md` (Hoofdstuk 4)
en in `docs/role-audit.md`.

## 1. Eén bron van waarheid: `src/hooks/useCan.ts`

- Permission-matrix staat **alleen** in `PERMISSION_MATRIX`.
- Toevoeging van een nieuwe resource → eerst matrix uitbreiden, daarna
  `Resource` type in `useCan.ts`, daarna pas UI-gating.
- Wijzigingen synchroon documenteren in
  `docs/sellqo-fase2-masterplan.md` Hoofdstuk 2.

## 2. Vier gating-primitieven (gebruik in deze volgorde van voorkeur)

| Primitief | Wanneer | Locatie |
|---|---|---|
| `<RouteGuard requireRead="..." />` | Voor elke nieuwe `/admin/*` route — eerste verdediging. | `src/App.tsx` |
| `requireRead: "..."` op sidebar-entry | Verbergt menu-item voor non-read rollen. | `src/components/admin/sidebar/sidebarConfig.ts` |
| `<PermissionGate action="write" resource="...">` | Wrap rond hele blokken die alleen schrijvers mogen zien. | Page-componenten |
| `<GatedButton action="..." resource="...">` | Voor losse CTA's: disable+tooltip patroon. | Page-componenten |
| `useCan('write', '...')` directe boolean | In dropdown-items, conditional render, bulk-bars. | Componenten |
| `<MaskedValue resource="...">` | Voor cellen die maskeren ipv hide. | Tabellen |

## 3. Hide vs Disable — beslisregel

- **Hide** (verberg volledig) — wanneer de gebruiker geen recht heeft
  EN het bestaan van de actie geen waarde toevoegt:
  - Items binnen een drie-puntjes-menu / dropdown.
  - Hele tabs.
  - Velden met privacy-impact (bv. `cost_price`).
- **Disable + tooltip** — wanneer de actie transparant moet blijven:
  - Top-level CTA-knoppen (Nieuw, Aanmaken, Importeren).
  - Budget-velden (`ad_budgets`) — de gebruiker moet zien dát het bestaat.
  - Save-bar in settings.

## 4. Cross-tenant veiligheid (H4-5)

`useCan` filtert intern op `currentTenant.id`. Voeg geen ad-hoc rol-checks
toe op `useAuth().roles` direct — die zijn cross-tenant en lekken
rechten van Tenant A naar Tenant B.

```ts
// ❌ FOUT — leakage
const isAdmin = roles.some(r => r.role === "tenant_admin");

// ✅ JUIST
const canWriteOrders = useCan("write", "orders");
```

## 5. Page-template

Elke nieuwe admin-pagina volgt deze structuur:

```tsx
import { ReadOnlyBadge } from "@/components/permissions/ReadOnlyBadge";
import { GatedButton } from "@/components/permissions/GatedButton";

export default function FooPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          Foo
          <ReadOnlyBadge resource="foo" />
        </h1>
        <GatedButton action="write" resource="foo" onClick={openCreate}>
          Nieuw
        </GatedButton>
      </div>
      {/* … */}
    </div>
  );
}
```

En in `App.tsx`:

```tsx
<Route
  path="foo"
  element={
    <RouteGuard requireRead="foo">
      <FooPage />
    </RouteGuard>
  }
/>
```

## 6. Tooltip-tekst (centraal)

Gebruik altijd `TOOLTIP_NO_ACCESS_SHORT` / `_LONG` uit
`src/lib/permissions/constants.ts`. Geen ad-hoc strings.

## 7. Verificatie vóór merge

```bash
node scripts/verify-permissions-matrix.mjs
node scripts/verify-route-coverage.mjs
```

Beide moeten exit-code 0 retourneren. Rapport komt in
`docs/h4e-static-sweep-report.md` en `docs/h4e-route-coverage.md`.

## 8. Dev-only Rol-simulator

`Ctrl+Shift+R` opent de simulator (alleen in `npm run dev`). Verifieer
hide/disable-gedrag visueel zonder echte rol-accounts. **Let op**: dit
overschrijft alleen `useCan` — RLS en edge-functions blijven onder je
echte rol draaien.