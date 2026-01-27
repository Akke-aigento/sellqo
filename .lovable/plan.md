
# Plan: Visual Content & Page Editor

## Overzicht

Dit plan introduceert een **in-context visual editor** waarmee merchants direct op de storefront preview kunnen klikken om content te bewerken. Dit is een significante upgrade ten opzichte van de huidige "bewerken via dialoog" aanpak.

---

## Huidige Situatie

De huidige storefront beheer bestaat uit:

| Component | Functie | Editing Methode |
|-----------|---------|-----------------|
| `HomepageBuilder` | Homepage secties beheren | Dialoog (SectionEditor) |
| `StorefrontPagesManager` | Statische pagina's (About, FAQ) | Dialoog met RichTextEditor |
| `LegalPagesManager` | Juridische pagina's | Dialoog (LegalPageEditor) |
| `ThemeCustomizer` | Kleuren, fonts, layout | Formulier velden |
| `PreviewPanel` | Live preview in iframe | Alleen bekijken, geen editing |

**Beperking**: Content bewerken vindt plaats in gescheiden dialoogvensters, niet direct in de preview.

---

## Voorgestelde Oplossing

Een **Visual Editor Mode** die:

1. De preview iframe vervangt door een interactieve editor
2. Click-to-edit functionaliteit biedt voor tekst, afbeeldingen en knoppen
3. Real-time updates toont zonder page refresh
4. Drag & drop voor secties behoudt

---

## Implementatie Strategie

### Fase 1: Interactieve Preview Panel

**Nieuwe `VisualEditorCanvas` component**:
- Rendert homepage secties **direct in React** (geen iframe)
- Voegt edit overlays toe aan elk bewerkbaar element
- Communiceert met `useStorefront` voor real-time saves

```text
+------------------------------------------+
|  [Desktop] [Tablet] [Mobile]   [Refresh] |
+------------------------------------------+
|                                          |
|  +------------------------------------+  |
|  |  HERO SECTION                [Edit]|  |
|  |  "Welkom bij onze shop"           |  |
|  |  [Klik om te bewerken]            |  |
|  +------------------------------------+  |
|                                          |
|  +------------------------------------+  |
|  |  FEATURED PRODUCTS         [Edit] |  |
|  |  [Product 1] [Product 2] ...      |  |
|  +------------------------------------+  |
|                                          |
+------------------------------------------+
```

### Fase 2: Inline Text Editing

**Voor tekstvelden** (titels, subtitels, knopteksten):
- Klik om te selecteren
- Contenteditable voor directe bewerking
- Auto-save na blur of na 2 seconden inactiviteit

**Component: `InlineTextEditor`**:
```typescript
interface InlineTextEditorProps {
  value: string;
  onSave: (newValue: string) => void;
  as?: 'h1' | 'h2' | 'p' | 'span';
  placeholder?: string;
}
```

### Fase 3: Image & Media Picker

**Voor afbeeldingsvelden** (hero images, sectie achtergronden):
- Klik op afbeelding opent media picker
- Upload naar Supabase Storage
- Preview direct bijgewerkt

**Component: `VisualMediaPicker`**:
- Integreert met bestaande Storage functionaliteit
- Toont recent geüploade afbeeldingen
- Ondersteunt drag & drop upload

### Fase 4: Section Management in Context

**Toolbar per sectie**:
```text
+------------------------------------------+
|  Hero Banner                             |
|  [Grip ↕] [Settings ⚙] [Hide 👁] [Delete]|
+------------------------------------------+
```

**Quick-edit panel** (slide-in van rechts):
- Verschijnt bij klik op Settings icoon
- Sectie-specifieke instellingen
- Kleiner dan huidige full-screen dialoog

---

## Nieuwe Bestanden

| Bestand | Beschrijving |
|---------|--------------|
| `src/components/admin/storefront/visual-editor/VisualEditorCanvas.tsx` | Hoofdcontainer voor visual editing |
| `src/components/admin/storefront/visual-editor/InlineTextEditor.tsx` | Click-to-edit tekstveld |
| `src/components/admin/storefront/visual-editor/VisualMediaPicker.tsx` | Afbeelding selector/uploader |
| `src/components/admin/storefront/visual-editor/EditableSection.tsx` | Wrapper voor elke sectie met edit controls |
| `src/components/admin/storefront/visual-editor/SectionToolbar.tsx` | Hover toolbar per sectie |
| `src/components/admin/storefront/visual-editor/QuickEditPanel.tsx` | Slide-in settings panel |
| `src/components/admin/storefront/visual-editor/sections/*.tsx` | Editable versies van Hero, TextImage, etc. |

---

## Aanpassingen Bestaande Bestanden

| Bestand | Wijziging |
|---------|-----------|
| `HomepageBuilder.tsx` | Toggle tussen "List View" en "Visual Editor" mode |
| `PreviewPanel.tsx` | Optionele "Edit Mode" prop voor interactieve preview |
| `useStorefront.ts` | Optimistic updates voor snellere UX |
| `Storefront.tsx` | Visual editor tab toevoegen |

---

## Database Wijzigingen

**Geen database wijzigingen nodig** - alle data structuren zijn al aanwezig in:
- `homepage_sections` (content, settings JSON)
- `storefront_pages` (content HTML)
- `tenant_theme_settings` (branding)

---

## Technische Details

### Communicatie Pattern

```text
VisualEditorCanvas
    |
    +-- EditableSection (per sectie)
    |       |
    |       +-- InlineTextEditor (voor title, subtitle)
    |       +-- VisualMediaPicker (voor images)
    |       +-- SectionToolbar (hover actions)
    |
    +-- QuickEditPanel (slide-in voor geavanceerde settings)
```

### Auto-Save Logica

```typescript
// Debounced save na 2 seconden
const debouncedSave = useDebouncedCallback((updates) => {
  updateSection.mutate(updates);
}, 2000);

// Optimistic update voor instant feedback
queryClient.setQueryData(
  ['homepage-sections', tenantId], 
  (old) => old.map(s => s.id === id ? { ...s, ...updates } : s)
);
```

### Edit Mode Detection

```typescript
// URL param of context voor edit mode
const { isEditMode } = useVisualEditor();

// Conditioneel renderen van edit controls
{isEditMode && <SectionToolbar ... />}
```

---

## UX Flow

1. Merchant gaat naar **Webshop > Homepage**
2. Klikt op **"Visual Editor"** toggle (nieuw)
3. Ziet live preview met edit overlays
4. **Hover** over sectie toont toolbar
5. **Klik** op tekst opent inline editor
6. **Klik** op afbeelding opent media picker
7. Wijzigingen worden **automatisch opgeslagen**
8. **Drag & drop** om secties te herschikken

---

## Prioriteit per Onderdeel

| Feature | Impact | Complexiteit | Prioriteit |
|---------|--------|--------------|------------|
| VisualEditorCanvas | Hoog | Medium | 1 |
| InlineTextEditor | Hoog | Laag | 2 |
| EditableSection + Toolbar | Hoog | Medium | 3 |
| VisualMediaPicker | Medium | Medium | 4 |
| QuickEditPanel | Medium | Laag | 5 |
| StaticPageVisualEditor | Medium | Medium | 6 |

---

## Toekomstige Uitbreidingen

- **AI Content Suggesties**: "Genereer hero tekst" knop
- **Undo/Redo**: History stack voor bewerkingen
- **Mobile Preview Editing**: Touch-friendly versie
- **Collaboration**: Realtime editing indicators
- **Templates**: Pre-built sectie layouts

---

## Samenvatting

Deze implementatie transformeert de storefront editor van een "configuratie-gebaseerd" systeem naar een **true WYSIWYG visual editor**, vergelijkbaar met Shopify's Online Store 2.0 of Squarespace's editing ervaring. De bestaande infrastructuur (useStorefront, RichTextEditor, PreviewPanel) wordt hergebruikt en uitgebreid.
