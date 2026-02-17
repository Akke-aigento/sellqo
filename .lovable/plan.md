

# Compose Dialog upgraden + verzendprobleem fixen

## 1. Fix: Edge Function `send-customer-message` (kritiek)

Twee kolom-naam mismatches veroorzaken de 500-fout:

- **Select**: `address_line1` bestaat niet, moet `address` zijn
- **Insert**: `status` bestaat niet in `customer_messages`, moet `delivery_status` zijn

Wijzigingen in `supabase/functions/send-customer-message/index.ts`:
- Regel 59: `.select("name, owner_email, logo_url, primary_color, address_line1, ...")` wordt `address`
- Regel 171: `status: 'sending'` wordt `delivery_status: 'sending'`
- Regel 208: `status: 'failed'` wordt `delivery_status: 'failed'`
- Regel 218: `status: 'sent'` wordt `delivery_status: 'sent'`

## 2. CC/BCC velden toevoegen

In `ComposeDialog.tsx`:
- Twee nieuwe state variabelen: `cc` en `bcc` (strings, komma-gescheiden)
- Twee nieuwe Input-velden onder het ontvanger-veld, inklapbaar via een "CC/BCC" toggle link
- Meesturen in de body naar de Edge Function

In `send-customer-message/index.ts`:
- `cc` en `bcc` als optionele velden accepteren in de request
- Doorgeven aan `resend.emails.send({ cc: [...], bcc: [...] })`

## 3. Rich text editor (TipTap)

TipTap is al geinstalleerd in het project. Het simpele `<Textarea>` wordt vervangen door een TipTap editor met een toolbar:

- **Bold**, **Italic**, **Underline** (al geinstalleerd: `@tiptap/extension-underline`)
- **Links** (al geinstalleerd: `@tiptap/extension-link`)
- **Bullet list**, **Ordered list** (in starter-kit)

De HTML output van TipTap gaat direct als `body_html` naar de Edge Function.

## 4. Klant kiezen uit CRM (verbetering)

De klant-zoekfunctie bestaat al maar is niet heel zichtbaar. Verbeteringen:
- Bij selectie van een klant wordt automatisch het e-mailadres ingevuld
- Duidelijkere visuele feedback bij geselecteerde klant
- Toon klant-avatar/initialen bij selectie

## 5. Bijlages toevoegen

- "Bijlage toevoegen" knop met file input (max 10MB per bestand)
- Bestanden uploaden naar Supabase Storage bucket `message-attachments`
- Public URLs meesturen als `attachments` array naar de Edge Function
- Resend ondersteunt attachments via URL: `attachments: [{ filename, path: url }]`
- Visuele lijst van toegevoegde bijlages met verwijder-optie

Hiervoor is een nieuwe storage bucket nodig (`message-attachments`) met RLS policies.

## Technische details

### Database migratie
- Nieuwe storage bucket `message-attachments` aanmaken
- RLS policy: authenticated users met matching tenant_id kunnen uploaden/lezen

### Edge Function wijzigingen (`send-customer-message/index.ts`)
- Fix kolomnamen (`address`, `delivery_status`)
- Accepteer `cc`, `bcc`, `attachments` velden
- Geef door aan Resend API

### Frontend wijzigingen (`ComposeDialog.tsx`)
- TipTap editor ipv Textarea
- CC/BCC velden (inklapbaar)
- File upload component met drag & drop
- Klant-selectie verbetering

### Nieuwe component
- `src/components/admin/inbox/ComposeRichEditor.tsx` - TipTap wrapper met toolbar

