
# Fix: Team Uitnodigingen - Enum Casting in send_notification Functie

## Wat Er Misgaat

De `send_notification` database functie accepteert text parameters, maar de `notifications` tabel heeft enum kolommen:
- `category` verwacht type `notification_category` (enum)
- `priority` verwacht type `notification_priority` (enum)

Wanneer de `handle_team_invitation_notification` trigger de `send_notification` functie aanroept met `'team'` en `'low'` als text, faalt de INSERT omdat Postgres niet automatisch text naar enum converteert.

**Foutmelding:**
```
column "category" is of type notification_category but expression is of type text
```

## De Oplossing

Update de `send_notification` functie om expliciet te casten naar de enum types:

### Huidige INSERT (faalt):
```sql
INSERT INTO public.notifications (category, priority, ...)
VALUES (p_category, p_priority, ...);
```

### Nieuwe INSERT (werkt):
```sql
INSERT INTO public.notifications (category, priority, ...)
VALUES (p_category::notification_category, p_priority::notification_priority, ...);
```

## Technische Details

We voeren een database migratie uit die:
1. De `send_notification` functie vervangt met een versie die expliciete casts bevat
2. De functie-signatuur blijft hetzelfde (backwards compatible)
3. Alle bestaande aanroepen vanuit triggers werken automatisch

## Beschikbare Enum Waarden

| Enum Type | Geldige Waarden |
|-----------|-----------------|
| notification_category | orders, invoices, payments, customers, products, quotes, subscriptions, marketing, team, system, ai_coach |
| notification_priority | low, medium, high, urgent |

## Verwacht Resultaat

Na deze fix:
- Team uitnodigingen kunnen verstuurd worden (geen 400 error meer)
- Notificaties worden correct opgeslagen in de database
- De trigger `handle_team_invitation_notification` werkt volledig
