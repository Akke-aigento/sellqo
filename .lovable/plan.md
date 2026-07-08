## Fixes voor `SubscriptionFormDialog`

**Probleem 1 — Geen € bij prijs**
Het `unit_price` invoerveld is een kaal number-input. In de screenshot staat "05" naast het aantal, zonder valuta-hint → verwarrend.

**Fix:** € als prefix binnen het inputveld tonen (icon links, padding-left op de Input). Puur visueel, waarde blijft numeriek.

**Probleem 2 — "Opslaan" reageert niet**
In `handleSubmit`:
```ts
if (!customerId || !name || lines.some(l => !l.description)) return;
```
Bij een lege omschrijving/klant/naam wordt de submit stilletjes afgebroken zonder feedback. In de screenshot is de omschrijving leeg → knop lijkt kapot.

**Fix:**
- Vervang de silent return door een `toast.error` met een duidelijke melding per ontbrekend veld (klant / naam / omschrijving).
- Verplichte velden markeren met een `*` in het label voor duidelijkheid.
- Ook een fallback try/catch rond `mutateAsync` zodat backend-errors zichtbaar worden (nu vangt de mutation hook dat wel af via toast, dus lage prioriteit — alleen als er nog iets misgaat).

### Scope
Alleen `src/components/admin/SubscriptionFormDialog.tsx`. Geen schema-, hook- of edge-function-wijzigingen.