## Probleem

In de "Alle"-tab van `/admin/orders/invoices` (gecombineerd overzicht) ontbreken de rij-acties. De Facturen-tab en de Creditnota's-tab tonen wél een `ActionsMenu` met PDF-download, UBL, Peppol-mark-sent, e-mail opnieuw versturen en (voor facturen) creditnota aanmaken. In de gecombineerde view zie je nu alleen een compacte "creditnota aanmaken"-knop op factuur-rijen en een "open creditnota's tab"-knop op CN-rijen.

## Oplossing

Alleen `src/pages/admin/Invoices.tsx` aanpassen — geen wijzigingen aan backend, hooks of de twee andere tabs.

### 1. `Combined` type uitbreiden

Voeg `pdfUrl?: string | null`, `ublUrl?: string | null`, `peppolStatus?: string | null`, `language?: string | null` toe en vul ze vanuit `invoices` en `creditNotes` in de `useMemo`. Zo heeft de actiekolom alles wat nodig is zonder extra lookup.

### 2. Acties-handlers voor credit notes hergebruiken

`CreditNotesTable` bevat al lokale `handleDownloadPdf` (lazy genereren als `pdf_url` ontbreekt) en `handleResendEmail` voor CN's. Voor de gecombineerde view extraheren we deze niet — we voegen kleine lokale handlers toe in `Invoices.tsx`:
- `handleCnDownloadPdf(cnId, existingUrl, language)` → opent direct of roept `generate-credit-note` via `invokeWithErrorBody` aan.
- `handleCnResend(cnId, language)` → roept `send-credit-note-email` aan.

Beide met `useToast` voor feedback en `queryClient.invalidateQueries(['credit-notes'])` na succes. Geeft consistente UX met de Creditnota's-tab.

### 3. Acties-kolom in de "Alle"-tab

Vervang de huidige `actions`-render door een `ActionsMenu` per type:

**Voor `kind === 'invoice'`:**
- Download PDF (als `pdf_url`)
- Download UBL/XML (als `ubl_url`)
- Peppol markeren als verzonden (als `peppol_status === 'pending'`)
- E-mail opnieuw versturen (`resendInvoice.mutate`)
- Creditnota aanmaken → opent de bestaande `CreateCreditNoteFromInvoiceButton` (blijft naast het menu staan voor snelle toegang, in compact-modus)

**Voor `kind === 'creditnote'`:**
- Download PDF (lazy genereren indien nodig)
- Download UBL/XML (als beschikbaar)
- E-mail opnieuw versturen
- Open originele factuur (scrollt/navigeert naar Facturen-tab — eenvoudig: `setTab('invoices')` + optioneel search invullen met factuurnummer)
- "Open in Creditnota's tab" verhuist naar het menu (de losse `ExternalLink`-knop vervalt)

Layout: één `ActionsMenu` rechts; voor invoices ernaast nog de compacte `CreateCreditNoteFromInvoiceButton` (consistent met Facturen-tab). Voor CN's alleen het menu.

### 4. Mobile-card render in dezelfde tab

Identiek bijwerken: vervang de huidige inline knoppen door dezelfde `ActionsMenu` rechtsboven in de card, met dezelfde items per type. CreateCreditNote-knop blijft als compacte secundaire knop onderaan voor invoices.

## Niet in scope

- Geen wijzigingen aan Facturen-tab, Creditnota's-tab, sidebar, of edge functions.
- Geen nieuwe hooks of refactor van `CreditNotesTable` (zou een grotere wijziging zijn dan nodig).

## Verificatie

- 1280px: in "Alle"-tab toont elke rij een 3-puntjes menu met alle relevante acties; factuur-rijen hebben ook de compacte "creditnota aanmaken"-knop ernaast.
- 1185px (huidige viewport): zelfde acties, tabel switcht naar cards (container-aware fix uit vorige iteratie) — acties zichtbaar in card-header.
- PDF/UBL/e-mail acties werken identiek aan Facturen/Creditnota's-tab.
