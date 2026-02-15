

# Thema Presets: Opslaan & Wisselen

## Wat het doet

Je kunt je huidige thema-aanpassingen (kleuren, fonts, layout) opslaan als een **preset** met een naam. Zo kun je meerdere eigen stijlen bewaren en er snel tussen wisselen, zonder dat je alles opnieuw hoeft in te stellen.

## Hoe het werkt

- Naast de "Opslaan" knop komt een **"Opslaan als Preset"** knop
- Je geeft de preset een naam (bijv. "Kerst thema", "Zomer stijl", "Donker design")
- Opgeslagen presets verschijnen als een horizontale lijst boven de Theme Gallery
- Klik op een preset om die instellingen direct te laden
- Je kunt presets verwijderen die je niet meer nodig hebt
- Bij het laden van een preset verschijnt een bevestigingsdialoog (net als bij theme-wissel)

## Technische Wijzigingen

| Onderdeel | Wijziging |
|-----------|-----------|
| **Nieuwe database tabel** | `tenant_theme_presets` met kolommen: id, tenant_id, name, settings (JSONB met alle kleuren/fonts/layout), created_at |
| **RLS policies** | Tenants kunnen alleen hun eigen presets lezen, aanmaken en verwijderen |
| **Nieuw component** | `ThemePresetManager.tsx` -- horizontale lijst van opgeslagen presets + "Opslaan als preset" dialoog |
| **`ThemeCustomizer.tsx`** | `ThemePresetManager` component toevoegen tussen de ThemeGalleryInline en de Accordion |
| **`useStorefront.ts`** | Queries en mutations toevoegen voor presets (fetch, create, delete, load) |

### Database structuur

```text
tenant_theme_presets
  id          UUID (PK, default gen_random_uuid())
  tenant_id   UUID (FK -> tenants.id, NOT NULL)
  name        TEXT (NOT NULL)
  settings    JSONB (NOT NULL) -- bevat: primary_color, secondary_color, accent_color, 
                                  background_color, text_color, heading_font, body_font,
                                  header_style, product_card_style, products_per_row, 
                                  show_breadcrumbs, show_wishlist, theme_id
  created_at  TIMESTAMPTZ (default now())
```

### UI Flow

1. Gebruiker past thema aan (kleuren, fonts, etc.)
2. Klikt op "Opslaan als Preset" -> dialoog met naamveld
3. Preset verschijnt in de lijst
4. Later: klik op een preset -> bevestigingsdialoog -> instellingen worden geladen in het formulier
5. Gebruiker kan preset verwijderen via een X-knopje

### Preset Manager Component

Het component toont een compacte horizontale rij met:
- Opgeslagen presets als klikbare chips (naam + kleurbolletjes)
- Een "+ Opslaan als Preset" knop aan het einde
- Bij hover op een preset: verwijder-knopje

