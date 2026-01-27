
# Super Admin Platform - Volledige Validatie & Verbeteringen

## Huidige Status Analyse

Na grondige inspectie van de codebase is de Super Admin implementatie grotendeels correct opgezet, maar er zijn enkele verbeteringen nodig voor een volledig functioneel platform.

### Wat al correct werkt

| Component | Status | Details |
|-----------|--------|---------|
| Platform Admin Rol | OK | info@sellqo.ai heeft platform_admin + tenant_admin rollen |
| SellQo Internal Tenant | OK | Tenant met is_internal_tenant=true bestaat |
| Sidebar Navigatie | OK | Platform groep met alle 8 menu-items zichtbaar voor admins |
| Routing & Protection | OK | Alle /admin/platform/* routes beveiligd met requirePlatformAdmin |
| Database Tabellen | OK | Alle platform_* tabellen bestaan (changelogs, health_metrics, incidents, invoices, etc.) |
| Pricing Plans | OK | 4 tiers: Free, Starter (€29), Pro (€79), Enterprise (€199) |
| Legal Pages | OK | 6 juridische pagina's aanwezig (nog niet gepubliceerd) |
| Quick Actions | OK | 6 acties geconfigureerd (credits, gratis maand, trial verlenging, etc.) |

### Te verbeteren onderdelen

## 1. Tenant Overview Tab - Meer Metrics Toevoegen

**Probleem**: De TenantOverviewTab toont beperkte informatie. Ontbrekende velden:
- Lifetime revenue (lifetime_revenue)
- Lifetime orders (lifetime_order_count)  
- Lifetime customers (lifetime_customer_count)
- Owner email en naam
- Stripe status

**Oplossing**: Uitbreiden met extra statistieken en tenant metadata.

---

## 2. Platform Dashboard - Tenant Tellingen Toevoegen

**Probleem**: Het Platform Dashboard mist een kaart met totale tenant statistieken.

**Oplossing**: Toevoegen van een stats kaart met:
- Totaal aantal tenants
- Actieve tenants
- Trial tenants
- Internal tenants

---

## 3. Platform Coupons Sidebar Link Ontbreekt

**Probleem**: In de sidebarConfig staat geen directe link naar Platform Coupons, alleen via TenantActionsTab.

**Oplossing**: Coupons toevoegen aan platformItems in sidebarConfig.

---

## 4. Tenant Detail - Subscription Tab Uitbreiden

**Probleem**: De TenantSubscriptionTab bestaat maar is niet volledig geïmplementeerd voor het wijzigen van abonnementen.

**Oplossing**: Toevoegen van functionaliteit om:
- Plan te upgraden/downgraden
- Billing interval te wijzigen
- Subscription status te wijzigen

---

## 5. Security Linter Waarschuwingen

**Probleem**: 5x RLS policies met `USING (true)` voor INSERT/UPDATE/DELETE operaties.

**Actie**: Dit is een bekende configuratie voor sommige tabellen maar moet worden gereviewed per tabel.

---

## Implementatie Plan

### Stap 1: Sidebar Link voor Coupons
Bestand: `src/components/admin/sidebar/sidebarConfig.ts`
- Voeg `platform-coupons` item toe aan platformItems array

### Stap 2: Tenant Overview Tab Uitbreiden
Bestand: `src/components/platform/TenantOverviewTab.tsx`
- Uitbreiden met lifetime metrics
- Owner informatie toevoegen
- Stripe account status tonen

### Stap 3: Platform Dashboard - Tenant Stats
Bestand: `src/pages/platform/PlatformDashboard.tsx`
- Nieuwe stats kaart met tenant tellingen
- Query toevoegen voor tenant statistieken

### Stap 4: Tenant Subscription Tab Verbeteren
Bestand: `src/components/platform/TenantSubscriptionTab.tsx`
- Plan selectie dropdown
- Status wijziging mogelijkheid
- Billing interval toggle

### Stap 5: usePlatformAdmin Hook - Tenant Stats Query
Bestand: `src/hooks/usePlatformAdmin.ts`
- Nieuwe query voor tenant overview statistieken
- Mutation voor subscription updates

---

## Technische Details

### Database Queries (Alleen Lezen - Geen Wijzigingen)
De huidige database structuur is correct:
- `tenants` tabel bevat: lifetime_revenue, lifetime_order_count, lifetime_customer_count
- `tenant_subscriptions` tabel heeft relatie met pricing_plans
- `platform_quick_actions` heeft 6 actieve acties

### Component Structuur
```text
src/
├── components/platform/
│   ├── TenantOverviewTab.tsx    ← Uitbreiden
│   ├── TenantSubscriptionTab.tsx ← Verbeteren
│   └── ...
├── pages/platform/
│   └── PlatformDashboard.tsx    ← Tenant stats toevoegen
└── hooks/
    └── usePlatformAdmin.ts      ← Stats query toevoegen
```

### Estimated Effort
| Taak | Geschatte tijd |
|------|----------------|
| Sidebar coupons link | 5 min |
| Tenant Overview uitbreiden | 15 min |
| Dashboard tenant stats | 15 min |
| Subscription tab verbeteren | 30 min |
| Hook uitbreidingen | 15 min |
| **Totaal** | **~1.5 uur** |
