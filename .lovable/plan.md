
# Demo Tenant Feature voor Klantdemonstraties

## Overzicht

Je wilt demo stores kunnen markeren die:
1. **Onbeperkte functionaliteit** hebben (geen credit/feature limieten)
2. **Duidelijk gemarkeerd** zijn in de tenant lijst
3. **Uitgesloten** worden van platform statistieken

---

## Technische Aanpak

### Database Wijziging

Er bestaat al een `is_internal_tenant` veld in de database (voor SellQo zelf), maar voor demo stores maken we een apart veld:

```text
tenants tabel
+-- is_demo: boolean (default: false)
```

Waarom apart van `is_internal_tenant`?
- **Internal** = SellQo's eigen winkel (dogfooding)
- **Demo** = Demonstratie winkels voor klanten

---

### UI Wijzigingen

#### 1. Tenant Lijst (TenantsPage.tsx)
- Demo badge naast winkelnaam met lichtpaarse achtergrond
- Filter optie om demo stores te tonen/verbergen

#### 2. Tenant Formulier (TenantFormDialog.tsx)
- Toggle switch in "Instellingen" tab: "Demo winkel"
- Beschrijving: "Demo winkels hebben onbeperkte functionaliteit en worden niet meegeteld in statistieken"

#### 3. Platform Statistieken (usePlatformAdmin.ts)
- Nieuwe `demo` counter naast `internal`
- Platform totalen excluderen demo tenants

---

### Feature Gating Bypass

#### useUsageLimits.ts
Demo tenants krijgen:
- `checkLimit()` → altijd `true`
- `checkFeature()` → altijd `true`
- `enforceLimit()` → altijd `true`

#### useTenantSubscription.ts
- Usage percentages tonen "Onbeperkt" voor demo tenants

---

## Bestanden te Wijzigen

| Bestand | Wijziging |
|---------|-----------|
| **Database migratie** | `is_demo` column toevoegen aan tenants |
| `src/hooks/useTenants.ts` | `is_demo` property toevoegen aan interface en mutations |
| `src/hooks/useTenant.tsx` | `is_demo` property in Tenant interface |
| `src/hooks/useUsageLimits.ts` | Check voor demo tenant, bypass alle limieten |
| `src/hooks/usePlatformAdmin.ts` | Demo count toevoegen, exclude demo in stats |
| `src/pages/admin/Tenants.tsx` | Demo badge tonen, filter optie |
| `src/components/admin/TenantFormDialog.tsx` | Demo toggle switch |

---

## Visueel Ontwerp

### Demo Badge in Tenant Lijst

```text
┌─────────────────────────────────────────────────────────────────┐
│ ☐ │ 🏪 Demo Bakkerij  [DEMO]  │ Demo Account    │ Enterprise │
│   │    demo-bakkerij          │ demo@bakkerij.nl│ ⬤ Actief   │
├───┼───────────────────────────┼─────────────────┼────────────┤
│ ☐ │ 🏪 SellQo                 │ J. Vercammen    │ Enterprise │
│   │    sellqo                 │ info@sellqo.nl  │ ⬤ Actief   │
└───┴───────────────────────────┴─────────────────┴────────────┘
```

### Demo Toggle in Formulier

```text
┌──────────────────────────────────────────────────────────┐
│  Demo winkel                              [========●]    │
│  Demo winkels hebben onbeperkte functionaliteit en       │
│  worden niet meegeteld in platform statistieken          │
└──────────────────────────────────────────────────────────┘
```

---

## Samenvatting

| Functie | Implementatie |
|---------|---------------|
| Demo markeren | Toggle in tenant form |
| Badge in lijst | Paarse [DEMO] badge |
| Onbeperkt | Bypass in useUsageLimits |
| Stats exclusie | Filter in usePlatformAdmin |

Na implementatie kun je eenvoudig bestaande tenants als demo markeren via het bewerkformulier, en nieuwe demo stores aanmaken voor klantdemonstraties.
