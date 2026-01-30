
# Plan: App URL en Redirect URL Toevoegen aan Shopify Setup

## Probleem
De huidige instructies voor het maken van een Custom App missen de verplichte URL configuratie:
- **App URL**: `https://sellqo.app`
- **Redirect URL**: `https://sellqo.app/api/shopify/callback`

Zonder deze URLs werkt de OAuth flow niet correct.

## Wijzigingen

### 1. ShopifySetupGuide.tsx
Voeg een nieuwe stap toe (wordt stap 4, huidige stap 4 en 5 schuiven naar 5 en 6):

| Stap | Titel | Inhoud |
|------|-------|--------|
| **4 (NIEUW)** | Configureer App URLs | App URL en Redirect URL instellen met kopieerbare waarden |

### 2. ShopifyInstantConnect.tsx
Voeg een extra instructiepunt toe na stap 4 (scopes) met de vereiste URLs in een kopieerbaar formaat.

## Nieuwe Instructie Stappen

```text
Huidige volgorde:
1. Ga naar Develop Apps
2. Maak een nieuwe App  
3. Configureer API Scopes
4. Installeer de App
5. Kopieer de Access Token

Nieuwe volgorde:
1. Ga naar Develop Apps
2. Maak een nieuwe App
3. Configureer API Scopes
4. Configureer App URLs ← NIEUW
5. Installeer de App (was 4)
6. Kopieer de Access Token (was 5)
```

## Technische Details

### Nieuwe stap in GUIDE_STEPS array:
```tsx
{
  step: 4,
  title: 'Configureer App URLs',
  description: 'Stel de vereiste URLs in voor de OAuth connectie',
  icon: Link2,
  details: [
    'Scroll naar "App URL" sectie',
    'Vul bij "App URL" in:',
    '• https://sellqo.app',
    'Vul bij "Allowed redirection URL(s)" in:',
    '• https://sellqo.app/api/shopify/callback',
    'Klik op "Save"',
  ],
}
```

### URLs box in ShopifyInstantConnect.tsx:
Na de scopes box komt een nieuwe box met de kopieerbare URLs:

```text
┌─────────────────────────────────────────────────────────────┐
│ Vereiste URLs:                                              │
│                                                             │
│ App URL:                                    [Kopieer]       │
│ https://sellqo.app                                          │
│                                                             │
│ Redirect URL:                               [Kopieer]       │
│ https://sellqo.app/api/shopify/callback                     │
└─────────────────────────────────────────────────────────────┘
```

## Bestanden

| Bestand | Actie |
|---------|-------|
| `src/components/admin/marketplace/shopify/ShopifySetupGuide.tsx` | Nieuwe stap 4 toevoegen, stappen hernummeren |
| `src/components/admin/marketplace/shopify/ShopifyInstantConnect.tsx` | URLs box toevoegen met kopieer functionaliteit |

## Resultaat
- Gebruikers zien duidelijk welke URLs ze moeten invullen
- Kopieer knoppen voor elke URL
- Stappen zijn correct genummerd
- Handleiding dialog bevat ook de URL configuratie stap
