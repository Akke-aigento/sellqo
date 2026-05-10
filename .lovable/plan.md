## Probleem-diagnose

De geüploade PDF bevestigt het cropping-probleem:

- **Page size**: 419.53 × 595pt (A5 portrait)
- **Eigenlijke label-inhoud**: alleen de bovenste **~280pt** (ongeveer A6-hoogte)
- **Onderste helft**: volledig wit
- **Resultaat op printer**: A6/4×6 thermal printer rolt half pagina weg, of A4-printer print het label klein in de hoek

De huidige `cropToLabel` ziet "page ≤ A5" en houdt het zoals het is — daarom blijft de witte helft staan. Bol levert internationale (bpost World Business) labels op A5-canvas, maar de echte label-content is A6-formaat in de top-left.

Verder: gebruikers werken met verschillende printers (thermal 4×6, A6 sticker, A4 papier, Brother 62mm) en in fulfillment-omgevingen kiest elke medewerker zijn eigen printer.

## Aanpak

### 1. Cropping fix — content-detectie ipv vaste A5-aanname

In `supabase/functions/create-bol-vvb-label/index.ts` → functie `cropToLabel`:

- Vervang vaste A5-fallback door **content-area detectie**: scan met `pdf-lib` waar de daadwerkelijke tekst/elementen staan en crop strak om het ingevulde gebied (met kleine marge).
- Fallback per gekozen output-formaat als detectie faalt:
  - `a6` → 298 × 419pt (top-left)
  - `4x6_thermal` → 288 × 432pt (4×6 inch)
  - `a5` → 419 × 595pt (huidige a5 fallback)
  - `a4_original` → geen crop
  - `brother_62mm` → 175 × 350pt (62mm continuous roll)

### 2. Datamodel — meerdere formaten + per-user default

**Per tenant** (uitbreiden `marketplace_connections.settings`):
```ts
vvbLabelFormats?: Array<'a6' | '4x6_thermal' | 'a5' | 'a4_original' | 'brother_62mm'>
vvbLabelFormatDefault?: <één van bovenstaande>  // tenant-fallback
```
Migratie van bestaande `vvbLabelFormat` → in nieuwe array zetten zodat niets breekt.

**Per user** (nieuwe tabel `user_label_preferences`):
```
user_id  uuid (FK auth.users)
tenant_id uuid
preferred_format text
updated_at timestamptz
```
- RLS: gebruiker mag alleen eigen rij lezen/schrijven binnen tenant.
- Werkt automatisch ook voor warehouse/fulfillment users (gewoon hun eigen `user_id`).

### 3. Edge function uitbreiden

`create-bol-vvb-label` accepteert optioneel `label_format` in body. Resolutie-volgorde:
1. Body `label_format` (uit dropdown bij printen)
2. User preference (`user_label_preferences.preferred_format`)
3. Tenant default (`vvbLabelFormatDefault`)
4. Eerste in `vvbLabelFormats` array
5. Hard fallback `a6`

Format wordt doorgegeven aan `cropToLabel(pdfBytes, format)`.

### 4. UI — Settings

`src/components/admin/marketplace/BolVVBSettings.tsx`:
- Vervang RadioGroup door **multi-select checkboxes** voor toegestane formaten.
- Voeg dropdown "Standaard formaat" toe (gevuld vanuit selectie).

`src/components/admin/settings/LabelPrinterSettings.tsx` (bestaat al):
- Persisteer keuze naar `user_label_preferences` (nu nog alleen lokale state).
- Toon alleen formaten die de tenant heeft toegestaan.

### 5. UI — Print dropdown

Op de plek waar VVB-print getriggerd wordt (orderdetail / fulfillment workspace):
- Splitknop "Print label" + chevron-dropdown met de toegestane formaten.
- Pre-selectie = user-pref → tenant-default.
- Geselecteerd formaat wordt meegestuurd als `label_format` in de invoke.

### 6. Verificatie

- Recrop van #1140/#1141/#1142 met nieuwe `a6` content-detectie → PDF heeft géén witte onderhelft meer.
- Schakelen tussen `a6`/`4x6_thermal`/`a5` in dropdown → upload genereert verschillende bestandsnamen (`-a6.pdf`, `-4x6.pdf` enz.), label-content blijft compleet.
- Test met fulfillment-user account: dropdown laat alleen tenant-toegestane formaten zien, eigen default wordt vooraf geselecteerd.

## Niet aangeraakt

- Bol API-calls / token flow / VVB-creation logica.
- Andere shipping providers (Sendcloud/MyParcel — die hebben eigen flow).
- Auth-pattern (`authenticateRequest(req, order.tenant_id)` blijft).
