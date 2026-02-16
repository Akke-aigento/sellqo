
# Facebook & Instagram toevoegen aan Nieuw Bericht dialoog

## Wat verandert er?

De ComposeDialog ondersteunt momenteel alleen Email en WhatsApp. We voegen **Facebook Messenger** en **Instagram DM** toe als kanaalopties.

## Wijzigingen

### Bestand: `src/components/admin/inbox/ComposeDialog.tsx`

1. **Channel type uitbreiden**: `'email' | 'whatsapp'` wordt `'email' | 'whatsapp' | 'facebook' | 'instagram'`

2. **Meta-verbindingen ophalen**: Een query naar `meta_messaging_connections` om te checken welke platformen actief zijn voor de tenant, en om de `page_id` op te halen die nodig is voor het versturen

3. **Kanaal-tabs uitbreiden**: Facebook en Instagram tabs tonen (met Facebook/Instagram iconen) wanneer er een actieve verbinding bestaat

4. **Ontvanger-veld aanpassen**: 
   - Bij Facebook/Instagram moet een bestaande klant geselecteerd worden (je kunt geen handmatig social ID invoeren)
   - De klant moet een `meta_sender_id` hebben (opgeslagen in eerdere conversaties)
   - Label wordt "Ontvanger (Facebook)" of "Ontvanger (Instagram)"

5. **Verzendlogica uitbreiden**: Bij Facebook/Instagram de bestaande `send-meta-message` edge function aanroepen met:
   - `tenant_id`, `platform` ('facebook'/'instagram'), `recipient_id` (meta_sender_id van de klant), `page_id` (uit de connection), `message`, `customer_id`

6. **Validatie aanpassen**: `canSend()` checkt bij social kanalen of er een klant met meta_sender_id is geselecteerd

7. **Toast/beschrijving aanpassen**: Kanaal-naam correct weergeven (Facebook/Instagram)

## Technische details

- Hergebruikt de bestaande `send-meta-message` edge function (dezelfde als de ReplyComposer)
- Haalt actieve verbindingen op via `supabase.from('meta_messaging_connections').select('*').eq('tenant_id', ...).eq('is_active', true)`
- Voor het ophalen van het `meta_sender_id` van een klant wordt gekeken naar eerdere berichten in `customer_messages` voor die klant
- Geen database-wijzigingen nodig
