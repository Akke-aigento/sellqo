## Doel
Echte SellQo-logo en oranje accentkleur toevoegen aan de gedeelde systeemmail-helper.

## Stappen

**1. Logo publiek beschikbaar maken**
- Kopieer `src/assets/logo-light.png` → `public/email-logo.png`
- Wordt geserveerd op `https://sellqo.lovable.app/email-logo.png`

**2. Update `supabase/functions/_shared/sellqoEmail.ts`**
- `BRAND` uitbreiden met `accent: "#ff7733"`
- Constante toevoegen: `const LOGO_URL = "https://sellqo.lovable.app/email-logo.png";`
- In header-cel: tekst-span "SellQo" vervangen door `<img src={LOGO_URL} alt="SellQo" style="height:40px;width:auto;display:block;border:0;outline:none;text-decoration:none;">`, binnen dezelfde `<a href="https://sellqo.app">` wrapper
- In `infoBoxHtml`: bestaande `<td>`-style aanvullen met `border-left:3px solid ${BRAND.accent}` — grijze border en padding ongewijzigd

## Niet aanpassen
- Copy, CTA-knop (blijft navy), footer
- Geen wijzigingen aan callers van de helper
