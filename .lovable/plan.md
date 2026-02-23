

# Fix: Notificaties alleen na betaling versturen

## Probleem

De eerder goedgekeurde migratie is **niet daadwerkelijk uitgevoerd** in de database. De huidige `handle_order_notification()` functie stuurt nog steeds een notificatie bij elke `INSERT` op de `orders` tabel, zonder te controleren of `payment_status = 'paid'` is.

## Oplossing

De database migratie alsnog uitvoeren. Dit omvat twee wijzigingen:

### 1. Functie aanpassen
De `handle_order_notification()` functie wordt vervangen zodat de "Nieuwe bestelling" notificatie **alleen** wordt verstuurd wanneer:
- **INSERT** met `payment_status = 'paid'`
- **UPDATE** waarbij `payment_status` verandert naar `'paid'`

### 2. Trigger aanpassen
De bestaande trigger `on_order_notification` wordt verwijderd en opnieuw aangemaakt zodat deze ook op `UPDATE` events triggert (nodig om de payment_status wijziging op te vangen).

## Technische details

Een enkele SQL-migratie met:

```sql
-- Stap 1: Functie vervangen
CREATE OR REPLACE FUNCTION public.handle_order_notification()
-- Bevat de nieuwe logica met payment_status check

-- Stap 2: Trigger opnieuw aanmaken voor INSERT OR UPDATE
DROP TRIGGER IF EXISTS on_order_notification ON public.orders;
CREATE TRIGGER on_order_notification
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_order_notification();
```

### Geen frontend/edge function wijzigingen nodig
Alleen de database trigger-functie en trigger worden aangepast.

### Verwacht resultaat
- Checkout aanmaken zonder te betalen: geen notificatie
- Checkout annuleren: geen notificatie
- Succesvolle betaling (webhook update naar `paid`): notificatie wordt verstuurd
- "Markeer als betaald" bij bankoverschrijving: notificatie wordt verstuurd

