

## Fix: Dubbele order-notificaties door duplicate trigger

### Root cause

Er bestaan twee triggers op de `orders` tabel die **exact dezelfde functie** aanroepen:

| Trigger | Functie | Event |
|---|---|---|
| `trigger_order_notification` | `handle_order_notification()` | AFTER INSERT OR UPDATE |
| `on_order_notification` | `handle_order_notification()` | AFTER INSERT OR UPDATE |

Elke keer dat een order wordt aangemaakt of gewijzigd, wordt `handle_order_notification()` twee keer uitgevoerd. Dit verklaart waarom elke notificatie dubbel verschijnt (bijv. "#1130 verzonden" x2, "#1127 afgeleverd" x2) en er twee e-mails worden gestuurd.

### Fix

**Database migratie:**
- `DROP TRIGGER on_order_notification ON orders;` — de duplicate trigger verwijderen
- `trigger_order_notification` blijft behouden als de enige trigger

Eén SQL-statement, klaar.

### Bestanden
- Database migratie (1 regel)

