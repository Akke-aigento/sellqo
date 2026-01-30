
# Plan: CID Referenties Verwijderen/Vervangen in Email Body

## Probleem

Bij inkomende e-mails worden inline afbeeldingen (zoals logo's in footers) verstuurd met Content-ID referenties. Deze verschijnen als `[cid:cc36a120-7edc-4350-b12f-cfe62080a20f]` in de message body wanneer:
1. De CID referentie niet wordt vervangen door een werkende afbeelding-URL
2. Of wanneer de afbeelding niet kan worden weergegeven

## Analyse

De huidige situatie:
- De `handle-inbound-email` edge function slaat de `content_id` op in attachment metadata
- De attachment binaries worden correct opgeslagen in Supabase Storage
- **Maar:** de `cid:...` referenties in de HTML body worden nooit vervangen
- De frontend toont de body als plain text, waardoor de `[cid:...]` tekst zichtbaar blijft

Voorbeeld uit database:
```
content_id: <cc36a120-7edc-4350-b12f-cfe62080a20f>
content_disposition: inline
storage_path: d03c63fe-48c6-4ff7-a30b-.../Outlook-dwvbnghs.png
```

## Oplossing

### Aanpak: Backend CID-vervanging + Frontend cleanup

**1. Edge Function: CID's vervangen door Storage URLs**

Na het uploaden van attachments naar storage, de body_html updaten:
- Voor elke inline attachment met een `content_id`
- Vervang `cid:...` referenties door de publieke storage URL
- Dit zorgt dat afbeeldingen correct worden weergegeven

**2. Frontend: Fallback cleanup voor oude/kapotte referenties**

In de `MessageBubble` component:
- Verwijder alle `[cid:...]` patronen die nog in de tekst staan
- Dit vangt edge cases op waar de backend vervanging niet werkte
- Regex: `/\[?cid:[^\]\s]+\]?/gi` → verwijderen

### Technische Details

**Edge Function Update (`handle-inbound-email`):**
```
Na processAttachments():
1. Query alle attachments met content_id voor dit bericht
2. Voor elke attachment:
   - Genereer public URL: supabase.storage.from('message-attachments').getPublicUrl(storage_path)
   - Vervang in body_html: cid:content_id → public_url
3. Update customer_messages met aangepaste body_html
```

**Frontend Cleanup (`MessageBubble.tsx`):**
```
In getBodyContent():
1. Na het strippen van HTML tags
2. Verwijder alle [cid:...] patronen met regex
3. Return cleaned text
```

## Bestanden te Wijzigen

| Bestand | Wijziging |
|---------|-----------|
| `supabase/functions/handle-inbound-email/index.ts` | CID-vervanging na attachment upload |
| `src/components/admin/inbox/MessageBubble.tsx` | Fallback cleanup van resterende CID tekst |

## Extra: Bestaande Berichten Repareren

Een repair script om bestaande berichten te updaten:
- Query alle berichten met `[cid:` in body_html
- Per bericht: zoek bijbehorende attachments met content_id
- Vervang CID's door storage URLs
- Dit kan als eenmalige edge function of SQL query

## Resultaat

| Scenario | Resultaat |
|----------|-----------|
| Nieuwe emails met inline afbeeldingen | Afbeeldingen tonen correct in HTML |
| Nieuwe emails waar afbeelding niet laadt | Geen `[cid:...]` tekst zichtbaar |
| Bestaande emails met CID tekst | Cleanup via frontend + repair script |
