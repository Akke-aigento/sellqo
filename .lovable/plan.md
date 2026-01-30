
# Plan: Drie Fixes in Eén Keer

## 1. Database Fix - Priority Enum
De trigger functie gebruikt `priority: 'normal'` maar de enum `support_ticket_priority` ondersteunt alleen:
- `low`
- `medium`
- `high`
- `urgent`

We wijzigen `'normal'` naar `'medium'` (meest logische standaardwaarde).

## 2. Tabs Wisselen - Psychologie Approved
De tabvolgorde wordt aangepast zodat gebruikers eerst de "Direct" optie zien:

| Huidige volgorde | Nieuwe volgorde |
|------------------|-----------------|
| 1. Aanvraag      | 1. Direct       |
| 2. Direct        | 2. Aanvraag     |
| 3. Import        | 3. Import       |

Ook wordt de standaard tab gewijzigd van `'request'` naar `'instant'`.

## 3. Header - Bedrijfsnaam Bold
De tenant naam in de admin header wordt vetgedrukt door `font-semibold` toe te voegen.

## Wijzigingen

| Bestand | Wijziging |
|---------|-----------|
| Database migratie | `priority: 'normal'` → `priority: 'medium'` |
| `ShopifyConnectDialog.tsx` | Tabs herschikken + default tab naar `'instant'` |
| `AdminHeader.tsx` | `font-semibold` toevoegen aan tenant naam |

## Technische Details

### Database SQL Fix
```sql
-- In handle_shopify_request_notification functie:
priority: 'medium'  -- was: 'normal' (ongeldig)
```

### ShopifyConnectDialog.tsx
```tsx
// Default tab
const [activeTab, setActiveTab] = useState<ConnectionMethod>('instant');

// Tab volgorde: instant → request → import
```

### AdminHeader.tsx
```tsx
// Tenant naam bold maken
<span className="text-sm font-semibold text-muted-foreground">
```

## Na Implementatie
- Publish de app zodat de database fix ook naar Live gaat
- Test het koppelverzoek opnieuw op sellqo.app
