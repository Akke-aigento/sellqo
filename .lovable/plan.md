
# Plan: Webshop Builder Inbegrepen bij Starter Plan

## Huidige Situatie

De Webshop Builder staat nu als **betaalde add-on** voor het Starter plan:
- Database: `webshop_builder: false` in de Starter plan features
- Marketing page: "Webshop" staat in de `addons` array voor Starter
- Dit blokkeert Starter-gebruikers van toegang tot `/admin/storefront`

## Wijzigingen

### 1. Database Migratie

Update de `pricing_plans` tabel om `webshop_builder: true` te zetten voor Starter:

```sql
UPDATE pricing_plans 
SET features = features || '{"webshop_builder": true}'::jsonb
WHERE slug = 'starter';
```

### 2. Marketing Page Updates

**Bestand:** `src/components/landing/PricingSection.tsx`

| Wijziging | Locatie | Detail |
|-----------|---------|--------|
| Verwijder uit addons | Regel 46 | `['POS Kassa', 'Bol.com', 'WhatsApp']` (Webshop weg) |
| Voeg toe aan features | Regel 38-39 | `'🛒 Webshop Builder'` toevoegen |

**Voor:**
```javascript
addons: ['POS Kassa', 'Webshop', 'Bol.com', 'WhatsApp'],
```

**Na:**
```javascript
addons: ['POS Kassa', 'Bol.com', 'WhatsApp'],
// En in features array:
'🛒 Webshop Builder',
```

### 3. Vergelijkingstabel (optioneel)

Als er een `ComparisonSection` is die Webshop per plan toont, deze ook updaten.

---

## Impact

Na deze wijzigingen:
- Starter-gebruikers krijgen **direct toegang** tot de Webshop Builder
- Het menu-item in de sidebar wordt zichtbaar (geen feature gate meer)
- Marketing toont Webshop als **inbegrepen feature** i.p.v. add-on

## Bestanden

| Bestand | Actie |
|---------|-------|
| Database migratie | `webshop_builder: true` voor Starter |
| `src/components/landing/PricingSection.tsx` | Webshop van addons → features |

---

## Technische Details

De feature check in `useUsageLimits.ts` hoeft niet aangepast te worden - deze leest automatisch de `features` JSONB uit de database. Zodra `webshop_builder: true` staat, werkt de sidebar filtering correct.
