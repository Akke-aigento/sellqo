
# Vertaal Hub — per-veld selectie in bulk-dialog

## Probleem
De bulk-dialog vertaalt nu altijd álle vertaalbare velden van een entity (bij producten: naam, beschrijving, korte beschrijving, meta-titel, meta-beschrijving). Je kan niet kiezen om bv. enkel SEO-velden of enkel de beschrijving te (her)vertalen. Dat is duur én niet altijd gewenst (vaak wil je naam ongemoeid laten).

## Gewenst gedrag
Vierde sectie in de bulk-dialog: **Welke velden?**
- Multi-select chips per veld van het gekozen entity-type (uit `ENTITY_TRANSLATABLE_FIELDS`).
- Quick-presets: "Alles", "Alleen SEO" (meta_title + meta_description), "Alleen content" (name + description + short_description).
- Default = alle velden aangevinkt (huidige gedrag blijft de standaard).
- Kost-preview rekent live met `geselecteerde velden` i.p.v. alle velden.
- "Start" disabled als geen veld geselecteerd.

## Wijzigingen

### `supabase/functions/ai-translate-content/index.ts`
- Nieuwe optionele payload `fields?: string[]`.
- Als meegegeven: filter `FIELD_CONFIGS[type]` op die lijst vóór het opbouwen van `entityFields` (zowel single- als bulk-pad).
- Credits-berekening en `missing`-skip-logica werken automatisch correct door de gefilterde fields.

### `src/hooks/useTranslations.ts`
- `startBulkTranslation` payload uitbreiden met `fields?: TranslatableField[]` en doorgeven aan edge function.
- `missingByLang` per entity uitsplitsen naar `missingByLangByField` (map `lang -> Set<field>`) zodat de UI per (taal × veld) kan tellen voor accurate `missing`-mode preview. Bestaande `missingByLang` blijft voor backwards-compat.

### `src/pages/admin/TranslationHub.tsx`
- Nieuwe sectie "Velden" in de bulk-dialog met toggle-badges per veld (labels uit `FIELD_LABELS`) en 3 preset-knoppen (Alles / Alleen SEO / Alleen content).
- State `selectedFields: TranslatableField[]` reset bij wijziging van `selectedEntityType`.
- Kost-formule: `items × selectedFields.length × selectedLanguages.length` (mode `all`), of som van `missingByLangByField[lang][field]` over selectie (mode `missing`).
- Disabled-state uitbreiden: ook als `selectedFields.length === 0`.
- Mutatie-call krijgt `fields: selectedFields`.

## Buiten scope
- Per-veld overrides per entity (bv. "vertaal beschrijving van product X maar naam van product Y") — overkill, niet gevraagd.
- Field-level lock UI in de tabel zelf — bestaat al via `is_locked` per translation-row.

## Open vraag
Default veld-selectie: **alle velden aangevinkt** (huidige gedrag) of liever **alleen content-velden** (name + description + short_description) zodat SEO een bewuste extra keuze is? Ik ga voor "alle aangevinkt" tenzij je anders zegt.
