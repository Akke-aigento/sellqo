

## Automatische opruiming van onbetaalde orders

### Conclusie: huidige flow is correct

Bij bankoverschrijvingen **moet** de order direct aangemaakt worden. Er is geen webhook zoals bij Stripe — je kunt niet automatisch detecteren of er betaald is. De order vooraf aanmaken is noodzakelijk zodat:
- De admin weet welke betalingen binnenkomen
- De klant een bestelnummer heeft
- Niets verloren gaat als de browser dichtgaat

### Wat we wél kunnen doen: automatisch verlopen

Orders met status `pending` die na X dagen niet betaald zijn, automatisch markeren als `expired`. Dit voorkomt dat het dashboard vol staat met spookorders.

### Implementatie

**1. Nieuw veld op orders (migration)**
```sql
-- Voeg een vervaldatum toe aan orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS expires_at timestamptz;
```

Bij het aanmaken van een bank_transfer order in `checkoutComplete`: `expires_at = now() + interval '7 days'`.

**2. Database functie voor cleanup**
```sql
CREATE OR REPLACE FUNCTION expire_unpaid_orders()
RETURNS integer AS $$
DECLARE affected integer;
BEGIN
  UPDATE orders 
  SET status = 'cancelled', payment_status = 'expired'
  WHERE payment_status = 'pending' 
    AND expires_at < now()
    AND status != 'cancelled';
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**3. Cron job via pg_cron (of een scheduled edge function)**

Draait dagelijks en ruimt verlopen orders op. Stock wordt weer vrijgegeven.

**4. Visuele indicator in admin dashboard**

Orders die bijna verlopen tonen een waarschuwingsbadge ("Verloopt over 2 dagen").

### Bestanden

| Bestand | Actie |
|---|---|
| Database migration | `expires_at` kolom + `expire_unpaid_orders` functie |
| `supabase/functions/storefront-api/index.ts` | `expires_at` instellen bij bank_transfer checkout |
| Admin orders overzicht (optioneel) | Verloop-indicator tonen |

### Alternatief: handmatig opruimen

Als je liever geen automatische expiry wilt, kunnen we ook een "Verwijder onbetaalde orders" knop toevoegen in het admin dashboard waarmee je zelf opruimt.

