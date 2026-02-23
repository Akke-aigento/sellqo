
# Fix: Notificaties alleen na betaling versturen

## Probleem

De trigger `handle_order_notification` stuurt een "Nieuwe bestelling" notificatie bij elke `INSERT` op de `orders` tabel. Bij Stripe checkout wordt de order aangemaakt **voor** de betaling (met `payment_status: 'pending'`). Als de klant annuleert, is de notificatie al verstuurd.

## Oplossing

De trigger-functie aanpassen zodat de "Nieuwe bestelling" notificatie **alleen** verstuurd wordt wanneer:
1. **INSERT** met `payment_status = 'paid'` (directe bankoverschrijving die al betaald is, of andere direct-betaalde orders)
2. **UPDATE** waarbij `payment_status` verandert naar `'paid'` (na succesvolle Stripe betaling)

Dit betekent dat bij Stripe checkout:
- Order wordt aangemaakt met `payment_status: 'pending'` -- geen notificatie
- Klant annuleert -- geen notificatie (correct!)
- Klant betaalt succesvol, webhook update naar `'paid'` -- notificatie wordt verstuurd

## Technische details

### Database migratie (SQL)

De functie `handle_order_notification()` wordt aangepast:

```sql
CREATE OR REPLACE FUNCTION public.handle_order_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_title TEXT;
  v_message TEXT;
  v_type TEXT;
  v_priority TEXT;
  v_action_url TEXT;
BEGIN
  v_action_url := '/admin/orders/' || NEW.id;

  -- Nieuwe bestelling: alleen bij INSERT met payment_status='paid'
  -- OF bij UPDATE wanneer payment_status naar 'paid' verandert
  IF (TG_OP = 'INSERT' AND NEW.payment_status = 'paid')
     OR (TG_OP = 'UPDATE' 
         AND NEW.payment_status = 'paid' 
         AND OLD.payment_status IS DISTINCT FROM 'paid') THEN
    
    v_type := 'order_new';
    v_title := 'Nieuwe bestelling: ' || NEW.order_number;
    v_message := 'Bestelling ' || NEW.order_number 
                 || ' van EUR' || ROUND(NEW.total::numeric, 2) 
                 || ' is ontvangen';
    v_priority := 'medium';
    
    IF NEW.total > 500 THEN
      PERFORM public.send_notification(
        NEW.tenant_id, 'orders', 'order_high_value',
        'Grote bestelling ontvangen: ' || NEW.order_number,
        'Bestelling ' || NEW.order_number 
          || ' heeft een waarde van EUR' || ROUND(NEW.total::numeric, 2),
        'high', v_action_url,
        jsonb_build_object(
          'order_id', NEW.id, 
          'order_number', NEW.order_number, 
          'total', NEW.total
        )
      );
    END IF;
    
    PERFORM public.send_notification(
      NEW.tenant_id, 'orders', v_type, v_title, v_message,
      v_priority, v_action_url,
      jsonb_build_object(
        'order_id', NEW.id, 
        'order_number', NEW.order_number, 
        'total', NEW.total
      )
    );
    
  -- Bestaande status-notificaties (cancelled, shipped, delivered)
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'cancelled' THEN
        v_type := 'order_cancelled';
        v_title := 'Bestelling geannuleerd: ' || NEW.order_number;
        v_message := 'Bestelling ' || NEW.order_number || ' is geannuleerd';
        v_priority := 'high';
      WHEN 'shipped' THEN
        v_type := 'order_shipped';
        v_title := 'Bestelling verzonden: ' || NEW.order_number;
        v_message := 'Bestelling ' || NEW.order_number || ' is verzonden';
        v_priority := 'low';
      WHEN 'delivered' THEN
        v_type := 'order_delivered';
        v_title := 'Bestelling afgeleverd: ' || NEW.order_number;
        v_message := 'Bestelling ' || NEW.order_number 
                     || ' is succesvol afgeleverd';
        v_priority := 'low';
      ELSE
        RETURN NEW;
    END CASE;
    
    PERFORM public.send_notification(
      NEW.tenant_id, 'orders', v_type, v_title, v_message,
      v_priority, v_action_url,
      jsonb_build_object(
        'order_id', NEW.id, 
        'order_number', NEW.order_number, 
        'status', NEW.status, 
        'previous_status', OLD.status
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;
```

### Geen code-wijzigingen nodig
Alleen de database trigger-functie wordt aangepast. De edge functions en frontend blijven ongewijzigd.

### Impact
- Orders met `payment_status: 'pending'` genereren geen notificatie meer
- Zodra betaling succesvol is (status wordt `'paid'`), komt de notificatie alsnog binnen
- Bankoverschrijvingen met `payment_status: 'pending'` sturen ook pas een notificatie na bevestiging via "Markeer als betaald"
- Bestaande notificaties voor statuswijzigingen (geannuleerd, verzonden, afgeleverd) blijven ongewijzigd
