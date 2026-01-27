
# Platform Eigenaar Badge voor SellQo

## Wat we gaan doen

SellQo is de platform eigenaar (`is_internal_tenant: true`) en moet anders worden weergegeven dan normale tenants of demo stores:

- **Geen** abonnement badge
- **Geen** status badge  
- Optioneel: een "OWNER" of "PLATFORM" badge bij de naam

---

## Technische Wijzigingen

### 1. useTenants.ts - Interface uitbreiden

```typescript
export interface Tenant {
  // ... bestaande velden
  is_demo: boolean | null;
  is_internal_tenant: boolean | null;  // ← Toevoegen
}
```

### 2. TenantsPage.tsx - Weergave aanpassen

Bij het tonen van badges checken we nu 3 scenario's:

| Type | Naam Badge | Abonnement | Status |
|------|------------|------------|--------|
| **Internal** (SellQo) | OWNER | — (niets) | — (niets) |
| **Demo** | DEMO | N/A | N/A |
| **Normaal** | (geen) | Plan badge | Status badge |

```tsx
// Naam kolom
{tenant.is_internal_tenant && (
  <Badge className="bg-amber-100 text-amber-800">OWNER</Badge>
)}
{tenant.is_demo && !tenant.is_internal_tenant && (
  <Badge className="bg-purple-100 text-purple-800">DEMO</Badge>
)}

// Abonnement kolom
{tenant.is_internal_tenant ? null : tenant.is_demo ? (
  <Badge variant="secondary">N/A</Badge>
) : (
  getPlanBadge(tenant.subscription_plan)
)}

// Status kolom  
{tenant.is_internal_tenant ? null : tenant.is_demo ? (
  <Badge variant="secondary">N/A</Badge>
) : (
  getStatusBadge(tenant.subscription_status)
)}
```

---

## Visueel Resultaat

```
┌───────────────────────────────────────────────────────────────────┐
│ ☐ │ 🏪 SellQo [OWNER]         │ J. Vercammen    │     │     │
│   │    sellqo                 │ info@sellqo.nl  │     │     │
├───┼───────────────────────────┼─────────────────┼─────┼─────┤
│ ☐ │ 🏪 Demo Bakkerij [DEMO]   │ Demo Account    │ N/A │ N/A │
│   │    demo-bakkerij          │ demo@bakkerij.nl│     │     │
├───┼───────────────────────────┼─────────────────┼─────┼─────┤
│ ☐ │ 🏪 Fashion Store Demo     │ Demo Fashion    │ Pro │ ●   │
│   │    fashion-demo           │ demo@fashion.nl │     │Actief│
└───┴───────────────────────────┴─────────────────┴─────┴─────┘
```

---

## Bestanden te Wijzigen

| Bestand | Wijziging |
|---------|-----------|
| `src/hooks/useTenants.ts` | `is_internal_tenant` toevoegen aan Tenant interface |
| `src/pages/admin/Tenants.tsx` | Conditionele weergave voor internal tenant, OWNER badge |

---

## Samenvatting

- SellQo krijgt een gouden "OWNER" badge
- Abonnement en status kolommen blijven leeg (geen N/A, gewoon niets)
- Demo stores behouden hun paarse "DEMO" badge met N/A waardes
- Beide types (internal + demo) hebben al onbeperkte functionaliteit via `useUsageLimits`
