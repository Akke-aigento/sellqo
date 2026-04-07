

## Herziening feature-verdeling per plan + implementatie

### Huidige situatie vs. logische verdeling

Hieronder de volledige feature-matrix zoals die logisch zou moeten zijn. **Vet** = wijziging t.o.v. huidige DB.

| Feature | Free | Starter | Pro | Enterprise |
|---|---|---|---|---|
| **BASIS** |
| Producten | 25 | 250 | 2.500 | Onbeperkt |
| Bestellingen/maand | 50 | 500 | 5.000 | Onbeperkt |
| Klanten | 100 | 1.000 | 10.000 | Onbeperkt |
| Teamleden | 1 | 3 | 10 | 50 |
| Opslag | 1 GB | 10 GB | 50 GB | 250 GB |
| **WEBSHOP & VERKOOP** |
| webshop_builder | ❌ | ✅ | ✅ | ✅ |
| visual_editor | ❌ | ❌ | ✅ | ✅ |
| pos | ❌ | ❌ | ✅ | ✅ |
| customDomain | ❌ | ✅ | ✅ | ✅ |
| removeWatermark | ❌ | ✅ | ✅ | ✅ |
| **FACTURATIE** |
| facturX | ❌ | ✅ | ✅ | ✅ |
| peppol | ❌ | ❌ | ✅ | ✅ |
| multiCurrency | ❌ | ❌ | ✅ | ✅ |
| **PROMOTIES** |
| Kortingscodes (basis) | ✅ | ✅ | ✅ | ✅ |
| promo_bundles | ❌ | **❌** | ✅ | ✅ |
| promo_bogo | ❌ | **❌** | ✅ | ✅ |
| promo_volume | ❌ | **❌** | ✅ | ✅ |
| promo_giftcards | ❌ | **❌** | ✅ | ✅ |
| loyalty_program | ❌ | ❌ | ✅ | ✅ |
| recurring_subscriptions | ❌ | ❌ | ✅ | ✅ |
| **AI** |
| ai_marketing | ❌ | ✅ | ✅ | ✅ |
| ai_copywriting | ❌ | ✅ | ✅ | ✅ |
| ai_images | ❌ | ❌ | ✅ | ✅ |
| ai_seo | ❌ | ❌ | ✅ | ✅ |
| ai_coach | ❌ | ❌ | ✅ | ✅ |
| ai_chatbot | ❌ | ❌ | ✅ | ✅ |
| ai_ab_testing | ❌ | ❌ | ✅ | ✅ |
| **INTEGRATIES & KANALEN** |
| bol_com | ❌ | ❌ | ✅ | ✅ |
| bol_vvb_labels | ❌ | ❌ | ✅ | ✅ |
| amazon | ❌ | ❌ | ❌ | ✅ |
| ebay | ❌ | ❌ | ❌ | ✅ |
| social_commerce | ❌ | ❌ | ✅ | ✅ |
| whatsapp | ❌ | ❌ | ✅ | ✅ |
| **GEAVANCEERD** |
| shop_health | ❌ | ✅ | ✅ | ✅ |
| gamification | ❌ | ✅ | ✅ | ✅ |
| live_activity | ❌ | ❌ | ✅ | ✅ |
| multi_warehouse | ❌ | ❌ | ✅ | ✅ |
| advancedAnalytics | ❌ | ❌ | ✅ | ✅ |
| **TECHNISCH** |
| apiAccess | ❌ | ✅ | ✅ | ✅ |
| webhooks | ❌ | ✅ | ✅ | ✅ |
| prioritySupport | ❌ | ❌ | ✅ | ✅ |
| whiteLabel | ❌ | ❌ | ❌ | ✅ |

### Wijzigingen t.o.v. huidige DB (Starter plan)

Het Starter-plan heeft momenteel te veel premium features aan. De volgende worden **uitgeschakeld**:

- `promo_bundles`: false (was true) — premium promotie
- `promo_bogo`: false (was true) — premium promotie
- `promo_volume`: false (was true) — premium promotie
- `promo_giftcards`: false (was true) — premium promotie

### Nieuwe featureKey: SellQo Connect

Voeg een featureKey `integrations_connect` toe aan de sidebar voor het "Integraties" menu-item. Dit blokkeert SellQo Connect voor Free-plan tenants.

### Implementatie

**1. Database migration — Starter plan features updaten**

```sql
UPDATE pricing_plans 
SET features = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(features::jsonb, '{promo_bundles}', 'false'),
      '{promo_bogo}', 'false'),
    '{promo_volume}', 'false'),
  '{promo_giftcards}', 'false')
WHERE slug = 'starter';
```

**2. Sidebar — featureKey toevoegen aan Integraties**

In `sidebarConfig.ts`: voeg `featureKey: 'apiAccess'` toe aan het `integrations` item (hergebruik bestaande feature — iedereen zonder API-access heeft ook geen Connect nodig).

**3. Landing page PricingSection.tsx updaten**

- Starter: verwijder "Alle promotietypes", vervang door "Kortingscodes"
- Starter: verwijder "Bol.com" en "WhatsApp" uit addons (die zitten niet in het plan)
- Free: voeg "Geen integraties" toe aan limitations

**4. Pricing.tsx (aparte pricing pagina) — feature-weergave**

De feature-lijst wordt al dynamisch uit de DB geladen, dus na de DB-update kloppen de checkmarks automatisch.

### Bestanden

| Bestand | Actie |
|---|---|
| Database migration | Starter plan features: 4 promo-features naar false |
| `src/components/admin/sidebar/sidebarConfig.ts` | `featureKey: 'apiAccess'` op integrations item |
| `src/components/landing/PricingSection.tsx` | Starter/Free teksten corrigeren |

