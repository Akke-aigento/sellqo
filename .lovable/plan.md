

# Nieuw gesprek starten vanuit de Inbox

## Wat ontbreekt er?

De inbox toont alleen bestaande conversaties en biedt een reply-composer. Er is geen "Nieuw bericht" knop om zelf een gesprek te starten met een klant.

## Wat gaan we doen?

Een **"Nieuw bericht"** knop toevoegen bovenaan de inbox die een compose-dialoog opent. Hiermee kun je:

- Een klant zoeken of handmatig een e-mailadres invoeren
- Een onderwerp en bericht typen
- Het kanaal kiezen (email / WhatsApp)
- Het bericht wordt opgeslagen als conversatie in de inbox

## Wijzigingen

### 1. Nieuw bestand: `src/components/admin/inbox/ComposeDialog.tsx`

Een dialoog met:
- **Ontvanger-veld**: Zoek een bestaande klant (autocomplete uit `customers` tabel) of typ een e-mailadres handmatig
- **Kanaal-keuze**: Email (standaard) of WhatsApp (als beschikbaar)
- **Onderwerp**: Alleen bij email
- **Berichtveld**: Textarea voor het bericht
- **Verzendknop**: Roept de bestaande `send-customer-message` edge function aan voor email, of `send-whatsapp-message` voor WhatsApp
- Na verzending wordt het nieuwe gesprek zichtbaar in de inbox

### 2. Bestand: `src/pages/admin/Messages.tsx`

- Een **"Nieuw bericht"** knop (met Plus/PenSquare icoon) toevoegen naast de paginatitel of bovenaan de conversatielijst
- De `ComposeDialog` openen bij klik
- Na succesvol verzenden: conversatielijst verversen en het nieuwe gesprek selecteren

### 3. Bestand: `src/components/admin/inbox/InboxFilters.tsx`

- Optioneel: de compose-knop hier plaatsen als compacte actieknop naast de zoekbalk

## Technische details

- De klant-zoekfunctie gebruikt de bestaande `useCustomers` hook
- Voor email-verzending wordt `send-customer-message` hergebruikt (dezelfde edge function als de ReplyComposer)
- Voor WhatsApp wordt `send-whatsapp-message` hergebruikt
- Het bericht wordt automatisch opgeslagen in `customer_messages` door de edge functions, waardoor het direct in de inbox verschijnt
- Geen database-wijzigingen nodig

