

## SellQo Connect branding doorvoeren in de hele applicatie

### Scope

Dit is een pure copy/UI-wijziging — geen database, geen API, geen functionele verandering. "SellQo Connect" wordt als branded product gepositioneerd met tier-varianten: **Lite** (Starter) en **Full** (Pro/Enterprise).

### Wijzigingen per bestand

**1. `src/components/landing/PricingSection.tsx` — Marketing pricing cards**

- **Starter** features: voeg toe: `'🔗 SellQo Connect Lite — 1 kanaal'` na Webshop Builder, plus kleine muted tekst `'↑ Pro voor alle kanalen'`
- **Pro** features: vervang `'📊 Bol.com + VVB Labels'` en `'Social Commerce sync'` door `'🔗 SellQo Connect — alle kanalen'` (met sub-items: Bol.com + VVB, Social Commerce, WhatsApp)
- **Enterprise** features: vervang `'Amazon & eBay sync'` en `'Custom integraties'` door `'🔗 SellQo Connect — alle kanalen + custom'`
- **Free** limitations: verander `'Geen integraties'` naar `'Geen SellQo Connect'`

**2. `src/components/landing/FeaturesSection.tsx` — Marketing feature cards**

- Eerste feature card ("Verkoop Overal, Beheer Centraal"): voeg "SellQo Connect" toe in subtitle of description
- Badge `'20+ integraties'` → `'SellQo Connect'`

**3. `src/components/landing/IntegrationsShowcaseSection.tsx` — Marketing integrations grid**

- Sectie titel: voeg "SellQo Connect" toe als onderdeel van de heading
- Badge `'20+ Integraties'` → `'SellQo Connect'`

**4. `src/components/admin/billing/PlanComparisonCards.tsx` — Admin upgrade flow**

- `featureLabels`: hernoem integration-gerelateerde labels:
  - `bol_com` → `'SellQo Connect — Bol.com'`
  - `bol_vvb_labels` → `'SellQo Connect — VVB Labels'`
  - `amazon` → `'SellQo Connect — Amazon'`
  - `ebay` → `'SellQo Connect — eBay'`
  - `social_commerce` → `'SellQo Connect — Social Commerce'`
  - `whatsapp` → `'SellQo Connect — WhatsApp'`

**5. `src/components/admin/billing/PlanFeatureDetailDialog.tsx` — Feature detail popup**

- Categorie `'Integraties & Kanalen'` → `'SellQo Connect'`
- Dezelfde label-hernoemen als in PlanComparisonCards

**6. `src/components/admin/sidebar/sidebarConfig.ts` — Sidebar navigatie**

- Rename parent item `title: 'Integraties'` → `title: 'SellQo Connect'`
- Op Starter plan: de sidebar toont al "Lite" badge via bestaand featureKey mechanisme — dit vereist een kleine aanpassing in de sidebar renderer om een "Lite" badge te tonen als de user op Starter zit (check `bol_com === false` of een dedicated check)

**7. `src/pages/admin/Marketplaces.tsx` — Connect hub header**

- Header al correct ("SellQo Connect"). Voeg een plan-afhankelijke banner toe:
  - Starter: "Je gebruikt SellQo Connect Lite. Je kunt 1 kanaal actief hebben. Upgrade naar Pro"
  - Pro/Enterprise: "SellQo Connect actief — alle kanalen beschikbaar"

**8. `src/pages/admin/Settings.tsx` — Settings channels tab**

- Tab titel `'Koppelingen & Kanalen'` → `'SellQo Connect'`

**9. `src/types/notification.ts` — Notification labels**

- Categorie `label: 'Integraties'` → `label: 'SellQo Connect'`
- `integration_connected` label: `'Integratie gekoppeld'` → `'SellQo Connect verbonden'`

**10. `src/pages/Pricing.tsx` — Standalone pricing pagina**

- De feature labels worden dynamisch uit de DB geladen en weergegeven via `featureLabels` map. Update deze map:
  - Dezelfde hernoemen als in PlanComparisonCards (bol_com, amazon, etc. → SellQo Connect prefix)

**11. `src/components/admin/billing/PeppolUpgradeCard.tsx` — Peppol upgrade prompt**

- Bij "Upgrade naar Pro" beschrijving: voeg "SellQo Connect" toe: "Peppol + SellQo Connect + AI features + alles inbegrepen"

**12. `src/pages/admin/Billing.tsx` — Usage warning upgrade knop**

- "Limiet overschreden — upgrade je plan" tekst is generic en blijft zo (niet integration-specifiek)

### Items die NIET bestaan en worden overgeslagen

- Onboarding wizard: heeft geen "integraties instellen" stap — **skip** (geen nieuwe stap toevoegen per instructie)
- Email/notification hardcoded strings: `'Bol.com klantvraag ontvangen'` zit in edge function code (backend) — **skip** per instructie
- Plan comparison table (apart): bestaat niet als apart component — de PlanFeatureDetailDialog dient hiervoor

### Sidebar "Lite" badge

In de sidebar renderer, check of de user op Starter zit. Als `featureKey: 'apiAccess'` enabled is maar `bol_com` niet, toon een kleine "Lite" badge naast "SellQo Connect". Dit vereist een kleine aanpassing in het sidebar component dat de nav items rendert.

### Bestanden

| Bestand | Actie |
|---|---|
| `src/components/landing/PricingSection.tsx` | Connect Lite/Full in feature bullets |
| `src/components/landing/FeaturesSection.tsx` | SellQo Connect branding in feature card |
| `src/components/landing/IntegrationsShowcaseSection.tsx` | SellQo Connect in section header |
| `src/components/admin/billing/PlanComparisonCards.tsx` | featureLabels hernoemen |
| `src/components/admin/billing/PlanFeatureDetailDialog.tsx` | Categorie + labels hernoemen |
| `src/components/admin/billing/PeppolUpgradeCard.tsx` | Copy update |
| `src/components/admin/sidebar/sidebarConfig.ts` | Title "Integraties" → "SellQo Connect" |
| `src/pages/admin/Marketplaces.tsx` | Plan-afhankelijke banner |
| `src/pages/admin/Settings.tsx` | Tab titel |
| `src/pages/Pricing.tsx` | featureLabels map |
| `src/types/notification.ts` | Category + label updates |

### Geen database wijzigingen nodig

