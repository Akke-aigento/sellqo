## Diagnose

**1. "Fout bij aanmaken — invalid input syntax for type uuid: """**

In `CampaignDialog.tsx` (`handleSubmit`, regel ~381) doet de payload:
```ts
const payload = { ...data, preset_key: ..., segment_id: ..., ... }
```
`...data` bevat ook `template_id: ''` (en potentieel `automation_id: ''`, `ab_variant_of: ''`) als lege string. Alleen `segment_id` en `preset_key` worden actief naar `null` gemapt. Postgres ziet `""` voor een uuid-kolom en gooit de 400.

**Fix:** normaliseer álle uuid-velden naar `null` als ze leeg zijn:
- `template_id`
- `segment_id` (al gedaan)
- `automation_id`
- `ab_variant_of`

**2. Voorbeeld toont altijd NL-content**

`previewHtml` (regel ~398) leest altijd `form.watch('html_content')` = de NL-hoofdkolom. Bij switchen naar tab EN/FR/DE wordt `translations.<lang>.html_content` geschreven, maar de preview leest die niet.

**Fix:** preview bron laten afhangen van `activeLangTab`:
- `nl` → `form.watch('html_content')`
- overig → `form.watch(\`translations.${activeLangTab}.html_content\`)` met fallback naar NL

Idem voor `richContent` in visual-mode: switch de bron per tab (of expliciet de NL-preview tonen bij tab-NL). Voor nu: alleen HTML-modus preview per tab fixen, want dat is waar de gebruiker klaagt. Visual editor werkt al per tab.

## Wijzigingen

**Bestand:** `src/components/admin/marketing/CampaignDialog.tsx`

1. In `handleSubmit`, na de payload-opbouw, uuid-velden expliciet normaliseren:
   ```ts
   template_id: data.template_id || null,
   automation_id: (data as any).automation_id || null,
   ab_variant_of: (data as any).ab_variant_of || null,
   ```
2. `previewHtml` aanpassen zodat de bron per `activeLangTab` gekozen wordt:
   ```ts
   const activeHtml = activeLangTab === 'nl'
     ? form.watch('html_content')
     : (form.watch(`translations.${activeLangTab}.html_content` as any) 
        || form.watch('html_content'));
   const previewHtml = wrapInEmailTemplate(
     applyPreviewVariables(
       editorMode === 'visual' ? richContent : (activeHtml || ''),
       brand,
     ),
   );
   ```

Geen DB-migratie, geen edge-function wijziging. Types blijven ongewijzigd.

## Buiten scope

- Per-taal visual editor state (nu wordt `richContent` gedeeld). Als NL-visual + EN-HTML gemengd worden gebruikt kan verwarring blijven; kan later.
- Preview van preview_text / subject per taal in de mail-preview render.
