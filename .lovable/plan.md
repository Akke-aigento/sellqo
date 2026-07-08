## Probleem
Nu wordt de machtigingslink alleen in een toast getoond (die na 5s verdwijnt) en de `navigator.clipboard.writeText()` faalt geluidloos in sommige contexten (bv. non-HTTPS, iframe-preview, focus-verlies). Resultaat: link is niet te kopiëren.

## Oplossing: MandateLinkDialog
Vervang de toast door een blijvende dialog die verschijnt zodra `create-mandate-setup` een URL teruggeeft.

### Inhoud dialog
- Titel: "Machtigingslink aangemaakt"
- Korte uitleg: "Stuur deze eenmalige link naar de klant. Na goedkeuring worden abonnementsfacturen automatisch geïncasseerd."
- **Read-only `<Input>` met de volledige URL**, auto-`select()` op focus (dubbelklik = alles geselecteerd).
- Primaire knop **"Kopieer link"** met:
  - `navigator.clipboard.writeText(url)` (async)
  - Fallback: `inputRef.current.select(); document.execCommand('copy')` als clipboard-API faalt/gooit.
  - Visuele bevestiging: icoon wisselt naar ✓ + label "Gekopieerd" gedurende 2s.
- Secundaire knop **"Open link"** (`window.open(url, '_blank')`) voor snelle test.
- Secundaire knop **"Mail naar klant"** (optioneel, `mailto:{email}?subject=...&body={url}`) — alleen als customer.email bekend is.
- QR-code (via bestaande `qrcode`-lib al in project?) — nice-to-have, mobiel scannen. Alleen toevoegen als lib al aanwezig; anders overslaan.
- Sluitknop.

### Wijzigingen in code
1. **Nieuw component** `src/components/admin/MandateLinkDialog.tsx`
   - Props: `open`, `onOpenChange`, `url`, `customerEmail?`, `customerName?`.
   - Gebruikt shadcn `Dialog`, `Input`, `Button`.
2. **`src/pages/admin/Subscriptions.tsx`**
   - Extra state: `mandateDialog: { url: string; email?: string; name?: string } | null`.
   - `handleCreateMandateLink`: na success de dialog openen i.p.v. toast. Toast blijft alleen voor errors.
   - Verwijder de niet-werkende auto-clipboard-write; kopiëren gebeurt nu via user-gesture in de dialog (dat is bovendien vereist door browsers).
   - Render `<MandateLinkDialog … />` onderaan de pagina.
3. **i18n** (`src/i18n/locales/{nl,en,fr,de}.json`)
   - Nieuwe keys onder `subscriptions.mandate.dialog`: `title`, `description`, `copy`, `copied`, `open`, `email`, `close`.

### Waarom dit werkt
- URL blijft zichtbaar tot de gebruiker de dialog sluit → altijd te kopiëren.
- Kopieer-actie draait binnen een user-gesture (klik op knop) → clipboard-API werkt in alle moderne browsers; execCommand-fallback dekt oudere/preview-contexten.
- Geen backend-wijzigingen, geen edge-function redeploy nodig.

## Buiten scope
- E-mailen van de link via een edge function (nu alleen `mailto:` in de client).
- SMS/WhatsApp-versturen.
- QR-code (alleen als `qrcode`-dep al aanwezig).

Akkoord? Dan implementeer ik dit in build mode.