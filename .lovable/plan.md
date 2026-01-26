

# Fix: Badges Widget Zichtbaar Maken op Dashboard

## Probleem

De **Badges & Milestones widget** is wel geregistreerd in de widget definities, maar **ontbreekt in alle layout presets**. Hierdoor wordt de widget nooit getoond, ook al staat hij niet in `hiddenWidgets`.

### Huidige situatie
```typescript
// dashboardWidgets bevat de badge definitie (OK)
{ id: 'badges', title: 'Badges & Milestones', ... }

// MAAR de default layout preset mist 'badges':
widgetOrder: [
  'shop-health',
  'today-widget',
  'stats-grid',
  // ... andere widgets
  'low-stock',
  // ❌ 'badges' ontbreekt hier!
]
```

## Oplossing

### 1. Layout Presets Updaten

Voeg `'badges'` toe aan de `widgetOrder` van alle relevante layout presets:

| Preset | Actie |
|--------|-------|
| default | Toevoegen aan einde |
| compact | Toevoegen (leuke motivatie voor kleine view) |
| analytics | Toevoegen (past bij stats focus) |
| pos | Toevoegen |
| ecommerce | Toevoegen |

### 2. Bestandswijzigingen

| Bestand | Wijziging |
|---------|-----------|
| `src/config/dashboardWidgets.ts` | `'badges'` toevoegen aan alle `widgetOrder` arrays in layout presets |

### 3. Code Aanpassing

```typescript
// Voorbeeld voor default preset:
{
  id: 'default',
  name: 'Standaard',
  description: 'Compleet overzicht met alle widgets',
  icon: LayoutDashboard,
  widgetOrder: [
    'shop-health',
    'today-widget',
    'stats-grid',
    'quick-actions',
    'recent-orders',
    'badges',        // ← NIEUW: na recent-orders
    'ai-marketing',
    'pos-overview',
    'marketplace',
    'low-stock',
  ],
  hiddenWidgets: [],
},
```

### 4. Bestaande Gebruikers

Gebruikers die al eerder hun dashboard hebben gepersonaliseerd hebben een opgeslagen `widget_order` in de database. Voor hen werkt de fix alleen als:
- Ze hun dashboard resetten via "Personaliseren" → "Standaard"
- Of handmatig de Badges widget aanzetten via "Personaliseren"

Dit is gewenst gedrag - we willen hun custom configuratie niet overschrijven.

## Resultaat

Na deze fix:
- Nieuwe gebruikers zien de Badges widget direct op hun dashboard
- De widget verschijnt in alle layout presets op een logische plek
- Bestaande gebruikers kunnen de widget activeren via Personaliseren

