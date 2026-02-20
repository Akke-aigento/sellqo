
# Fix: Email Notificaties Daadwerkelijk Versturen

## Probleem

De `send_notification()` database functie doet alleen een `INSERT INTO notifications` -- het roept nooit de `create-notification` edge function aan die verantwoordelijk is voor het versturen van emails via Resend. Daardoor worden er nooit emails gestuurd, ook al heeft een tenant `email_enabled: true` ingesteld.

## Oplossing

De `send_notification()` functie uitbreiden met een `pg_net.http_post()` call naar de `create-notification` edge function. Na de INSERT in de notifications tabel, wordt een HTTP POST gedaan naar de edge function die:
1. De `tenant_notification_settings` checkt of email ingeschakeld is
2. De tenant branding (logo, kleur) ophaalt
3. De email verstuurt via Resend

## Technische aanpak

### Database migratie: `send_notification()` functie updaten

De huidige functie:
```sql
-- Doet alleen INSERT, geen email
INSERT INTO notifications (...) VALUES (...);
```

Wordt:
```sql
-- INSERT + HTTP call naar edge function
INSERT INTO notifications (...) VALUES (...) RETURNING id INTO v_notification_id;

-- Check of email ingeschakeld is voor dit type
SELECT email_enabled INTO v_email_enabled
FROM tenant_notification_settings
WHERE tenant_id = p_tenant_id
  AND category = p_category
  AND notification_type = p_type;

-- Default: email voor high/urgent priorities
v_should_email := COALESCE(v_email_enabled, p_priority IN ('high', 'urgent'));

IF v_should_email THEN
  PERFORM net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/create-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')
    ),
    body := jsonb_build_object(
      'tenant_id', p_tenant_id,
      'category', p_category,
      'type', p_type,
      'title', p_title,
      'message', p_message,
      'priority', p_priority,
      'action_url', p_action_url,
      'data', p_metadata,
      'notification_id', v_notification_id,
      'skip_in_app', true  -- al aangemaakt via INSERT
    )
  );
END IF;
```

### Edge function: `create-notification` aanpassen

Kleine aanpassing om `skip_in_app` te ondersteunen: als de notificatie al in de database staat (via de trigger), sla de INSERT over en doe alleen de email check + verzending.

### Database settings configureren

De `pg_net` extension heeft de Supabase URL en anon key nodig als database settings. Dit wordt geconfigureerd via:

```sql
ALTER DATABASE postgres SET app.supabase_url = 'https://gczmfcabnoofnmfpzeop.supabase.co';
ALTER DATABASE postgres SET app.supabase_anon_key = 'eyJ...';
```

**Let op**: `ALTER DATABASE` is niet toegestaan in migraties. Dit wordt via een SQL insert/RPC geconfigureerd, of de URL/key worden direct in de functie hardcoded als constanten.

**Alternatieve aanpak** (veiliger): De URL en key worden opgeslagen in een interne config-tabel die de functie leest.

### Bestanden die wijzigen

| Bestand | Wijziging |
|---------|-----------|
| Nieuwe SQL migratie | Update `send_notification()` met `pg_net.http_post()` call |
| `supabase/functions/create-notification/index.ts` | Ondersteuning voor `skip_in_app` flag + `notification_id` |

### Alternatieve aanpak: Postgres trigger op notifications tabel

In plaats van de `send_notification()` functie aan te passen, kan er ook een **AFTER INSERT trigger op de notifications tabel** worden gemaakt die automatisch `pg_net.http_post()` aanroept. Dit is schoner omdat:
- Elke notificatie die via welke weg dan ook wordt aangemaakt, automatisch de email-check triggert
- De bestaande `send_notification()` functie niet hoeft te veranderen
- Toekomstige notificatie-aanmaak ook automatisch emails verstuurt

Dit is de aanbevolen aanpak.

```text
Flow:
Trigger (order/invoice/etc)
  -> send_notification()
    -> INSERT INTO notifications
      -> AFTER INSERT trigger op notifications
        -> pg_net.http_post() naar create-notification edge function
          -> Check tenant_notification_settings.email_enabled
          -> Als ja: verstuur email via Resend
          -> Update notifications.email_sent_at
```

### Config tabel voor Supabase URL/key

Een kleine `internal_config` tabel (of hergebruik van een bestaande settings tabel) om de Supabase URL en anon key op te slaan zodat `pg_net` de edge function kan aanroepen.

## Resultaat

- Alle bestaande notificatie-triggers (orders, facturen, klanten, abonnementen, marketing, etc.) krijgen automatisch email-functionaliteit
- Emails worden verstuurd op basis van de `tenant_notification_settings` tabel
- Tenant branding (logo, kleuren) wordt meegenomen in de email
- De `email_sent_at` timestamp wordt bijgewerkt na succesvolle verzending
