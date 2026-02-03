

# Plan: Bol.com Koppeling Instructies 1-op-1 Gelijk Maken aan Echte Bol.com Interface

## Huidige Situatie

De SellQo instructies kloppen niet met wat gebruikers daadwerkelijk zien op Bol.com:

| SellQo zegt | Bol.com toont |
|-------------|---------------|
| "Bol.com Partner Plaza" | Gewoon "bol." in header |
| `partnerplatform.bol.com` | `partner.bol.com/sdd/preferences/services/api` |
| "Ga naar Instellingen → API → Nieuwe API key aanmaken" | Directe pagina met "Client credentials voor de Retailer API" + "+ Aanmaken" knop |

## Wat Je Ziet op Bol.com (uit screenshots)

De pagina `partner.bol.com/sdd/preferences/services/api` toont:

```text
┌──────────────────────────────────────────────────────────────────┐
│ bol.    Artikelen  Bestellingen  Klantvragen  Financiën  etc.   │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Client credentials voor de Retailer API                         │
│  Met de client credentials kun je je authenticeren bij de        │
│  bol Retailer API. Als je wilt koppelen aan meerdere derde       │
│  partijen, dan dien je hier voor iedere derde partij aparte      │
│  client credentials aan te maken.                                │
│                                                                   │
│  ┌──────────────┐                                                │
│  │ + Aanmaken   │                                                │
│  └──────────────┘                                                │
│                                                                   │
│  Client credentials voor de Advertising API                      │
│  [...]                                                           │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

## Wijzigingen

### 1. ConnectMarketplaceDialog.tsx - Bol.com Instructies Updaten

**Locatie**: Regels 326-336

**Huidige code**:
```typescript
case 'bol_com':
  return {
    title: 'Bol.com Partner Plaza',
    url: 'https://partnerplatform.bol.com',
    steps: [
      'Log in op Bol.com Partner Plaza',
      'Ga naar Instellingen → API → Nieuwe API key aanmaken',
      'Kopieer je Client ID en Client Secret',
      'Plak deze hieronder en klik op "Verbind"',
    ],
  };
```

**Nieuwe code**:
```typescript
case 'bol_com':
  return {
    title: 'Bol.com Verkopersportaal',
    url: 'https://partner.bol.com/sdd/preferences/services/api',
    steps: [
      'Log in op je Bol.com verkopersaccount',
      'Je komt direct op de API credentials pagina',
      'Bij "Client credentials voor de Retailer API", klik op "+ Aanmaken"',
      'Geef de credentials een naam (bijv. "SellQo")',
      'Kopieer de Client ID en Client Secret',
      'Plak deze hieronder en klik op "Verbind"',
    ],
  };
```

**Belangrijke wijzigingen**:
- URL van `partnerplatform.bol.com` → `partner.bol.com/sdd/preferences/services/api` (directe link naar juiste pagina)
- "Partner Plaza" → "Verkopersportaal" (hoe Bol.com het noemt)
- "Ga naar Instellingen → API" → Niet meer nodig, directe link brengt je erheen
- "+ Aanmaken" knop expliciet benoemen (wat je echt ziet)
- Stap toegevoegd voor naam geven aan credentials

## Overzicht Vergelijking

### Oude Flow (verwarrend):
```text
1. Log in op Bol.com Partner Plaza ← Wat is Partner Plaza?
2. Ga naar Instellingen → API ← Waar is dat?
3. Nieuwe API key aanmaken ← Er staat "+ Aanmaken"
4. Kopieer je Client ID en Client Secret
```

### Nieuwe Flow (1-op-1 met Bol.com):
```text
1. Log in op je Bol.com verkopersaccount ← Duidelijk
2. Je komt direct op de API credentials pagina ← Door directe URL
3. Bij "Client credentials voor de Retailer API", klik op "+ Aanmaken" ← Exact wat je ziet
4. Geef de credentials een naam (bijv. "SellQo") ← Volgende stap
5. Kopieer de Client ID en Client Secret
6. Plak deze hieronder en klik op "Verbind"
```

## Technische Details

### Bestand te wijzigen:
- `src/components/admin/marketplace/ConnectMarketplaceDialog.tsx`

### Exacte wijziging:
Regels 326-336 aanpassen met de nieuwe instructies die exact overeenkomen met de Bol.com interface.

## Resultaat

- Gebruiker klikt op link → komt DIRECT op de juiste pagina
- Instructies beschrijven EXACT wat ze zien
- Geen verwarring over "Instellingen" menu's
- Dezelfde terminologie als Bol.com ("+ Aanmaken", "Client credentials voor de Retailer API")

