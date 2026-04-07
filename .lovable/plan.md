

## Upgrade-flow verbeteren: plan-keuze dialog + feature-details popup

### Wat er nu misgaat
1. **"Upgrade nu" knop** gaat direct naar checkout voor het eerstvolgende plan — geen keuze mogelijk
2. **"+6 meer..." tekst** is niet klikbaar — dood element
3. **Layout** kan visueel mooier en overzichtelijker

### Oplossing

**1. "Upgrade nu" knop → opent plan-keuze dialog**

In plaats van direct `createCheckout` aan te roepen, scrolt de pagina smooth naar de "Wissel van Plan" sectie. Dit geeft de gebruiker de keuze uit alle plannen inclusief downgrade-opties. Simpel, geen extra dialog nodig — de kaarten staan er al.

**2. Feature-details popup (nieuw component)**

Nieuw component `PlanFeatureDetailDialog.tsx`:
- Triggered door klik op "+X meer..." in de plan cards
- Modale dialog in SellQo-stijl met:
  - Plan naam + prijs bovenaan
  - Volledige lijst van alle features met ✓/✗ iconen
  - Limieten overzicht (producten, orders, klanten, team)
  - Groepering per categorie (Basis, AI Tools, Integraties, Promoties, etc.)
  - Upgrade/Downgrade knop onderaan

**3. "+X meer..." klikbaar maken**

In `PlanComparisonCards.tsx`:
- De "+X meer..." tekst wordt een `<button>` met hover-styling
- Klik opent de `PlanFeatureDetailDialog` voor dat specifieke plan
- Geldt voor zowel "gained" als "lost" lijsten

**4. Layout-verbeteringen plan cards**

- Cards krijgen subtiele hover-animatie (scale + shadow)
- Populair-badge krijgt gradient achtergrond
- Feature-lijst: consistente spacing, betere kleur-accenten
- Prijzen prominenter met SellQo teal accent

### Feature-categorieën in de detail-popup

```text
┌─────────────────────────────────────────┐
│  ⭐ Starter — € 29/mnd                 │
├─────────────────────────────────────────┤
│  BASIS                                  │
│  ✓ 250 Producten                        │
│  ✓ 500 Orders/mnd                       │
│  ✓ 1.000 Klanten                        │
│  ✓ 3 Teamleden                          │
│                                         │
│  WEBSHOP & TOOLS                        │
│  ✓ Webshop Builder                      │
│  ✓ Visual Editor                        │
│  ✓ API toegang                          │
│  ✓ Webhooks                             │
│  ✗ POS Kassa                            │
│                                         │
│  AI TOOLS                               │
│  ✓ AI Marketing                         │
│  ✓ AI Copywriting                       │
│  ✗ AI SEO                               │
│  ✗ AI Business Coach                    │
│  ...                                    │
│                                         │
│  [    Upgrade naar Starter    ]          │
└─────────────────────────────────────────┘
```

### Bestanden

| Bestand | Actie |
|---|---|
| `src/components/admin/billing/PlanFeatureDetailDialog.tsx` | Nieuw: volledige feature-popup per plan |
| `src/components/admin/billing/PlanComparisonCards.tsx` | "+X meer..." klikbaar, hover-animaties, dialog-integratie |
| `src/pages/admin/Billing.tsx` | "Upgrade nu" knop scrollt naar plan-sectie i.p.v. direct checkout |

### Geen database wijzigingen nodig

