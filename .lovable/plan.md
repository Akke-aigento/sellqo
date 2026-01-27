
# Plan: Visual Editor Uitbreidingen

Dit plan beschrijft de implementatie van drie belangrijke features voor de Visual Editor: AI Copywriting, Undo/Redo, en Static Pages Visual Editor.

---

## Feature 1: AI Copywriting in Visual Editor

### Wat het doet
Een "✨ AI" knop naast elk tekstveld in de Visual Editor die automatisch professionele teksten genereert op basis van de context (sectie type, bestaande content, tenant branding).

### Gebruikerservaring
1. Gebruiker ziet een sparkle-icoon (✨) naast elk bewerkbaar tekstveld
2. Klik op de knop opent een kleine popover met opties:
   - "Genereer titel" / "Genereer subtitel" / "Genereer CTA"
   - "Herschrijf professioneler"
   - "Maak korter" / "Maak langer"
3. AI genereert tekst op basis van sectie context
4. Gegenereerde tekst wordt direct in het veld geplaatst
5. Gebruiker kan accepteren (klik erbuiten) of annuleren (Escape)

### Technische Aanpak

**Nieuw Component: `AICopyButton.tsx`**
```typescript
// Props: fieldType, currentValue, sectionType, onGenerate
// Toont sparkle icoon + popover met opties
// Roept edge function aan en toont loading state
```

**Nieuwe Edge Function: `ai-generate-storefront-copy`**
- Input: fieldType (title/subtitle/cta/button), sectionType (hero/newsletter/etc), currentValue, tenantContext
- Gebruikt Lovable AI Gateway (google/gemini-3-flash-preview)
- Output: gegenereerde tekst
- Verbruikt 1 AI credit per generatie

**Wijzigingen bestaande bestanden:**
| Bestand | Wijziging |
|---------|-----------|
| `InlineTextEditor.tsx` | Nieuwe prop `showAIButton`, render `AICopyButton` naast tekstveld |
| `EditableHeroSection.tsx` | Voeg `showAIButton` prop toe aan alle `InlineTextEditor` componenten |
| `EditableTextImageSection.tsx` | Idem |
| `EditableNewsletterSection.tsx` | Idem |

---

## Feature 2: Undo/Redo Functionaliteit

### Wat het doet
Ongedaan maken van wijzigingen in de Visual Editor met Ctrl+Z (undo) en Ctrl+Shift+Z (redo).

### Gebruikerservaring
1. Elke wijziging wordt opgeslagen in een history stack
2. Ctrl+Z maakt de laatste wijziging ongedaan
3. Ctrl+Shift+Z herstelt de ongedaan gemaakte wijziging
4. Visuele indicator toont aantal undo-stappen beschikbaar
5. Undo/Redo knoppen in de toolbar als alternatief

### Technische Aanpak

**Uitbreiding `VisualEditorContext.tsx`:**
```typescript
interface VisualEditorContextType {
  // Bestaand...
  
  // Nieuw: History management
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  pushHistory: (state: HistoryEntry) => void;
}

interface HistoryEntry {
  sectionId: string;
  previousState: Partial<HomepageSection>;
  newState: Partial<HomepageSection>;
  timestamp: number;
}
```

**History Stack Logica:**
- Maximum 50 entries in history
- Elke `updateSection` call pusht naar history via `pushHistory`
- Undo: past `previousState` toe en verplaatst entry naar redo stack
- Redo: past `newState` toe en verplaatst terug naar undo stack

**Keyboard Shortcuts:**
- Nieuwe hook: `useUndoRedo()` met `useEffect` voor keyboard events
- Luistert naar `keydown` events op document level
- Ctrl+Z → `undo()`, Ctrl+Shift+Z → `redo()`

**UI Aanpassingen:**
| Bestand | Wijziging |
|---------|-----------|
| `VisualEditorCanvas.tsx` | Undo/Redo knoppen in toolbar |
| `useStorefront.ts` | Wrapper rond `updateSection` om history te pushen |

---

## Feature 3: Static Pages Visual Editor

### Wat het doet
Dezelfde WYSIWYG ervaring als de Homepage Builder, maar voor statische pagina's zoals "Over Ons", "FAQ", "Contact", etc.

### Gebruikerservaring
1. In de pagina's tabel, klik op "Bewerken" opent visuele editor (niet de huidige dialog)
2. Editor toont de pagina met inline editing voor alle content
3. Ondersteunt verschillende block types:
   - Rich text blokken
   - Afbeelding + tekst blokken
   - FAQ accordions
   - Contact formulieren
   - Video embeds
4. Drag & drop om blokken te herschikken
5. Zelfde responsive preview (desktop/tablet/mobile)

### Technische Aanpak

**Database Wijziging:**
De `storefront_pages` tabel heeft al een `content` veld (text). We structureren dit als JSON met blokken:

```typescript
interface PageBlock {
  id: string;
  type: 'richtext' | 'image_text' | 'faq' | 'contact_form' | 'video';
  content: Record<string, unknown>;
  settings: Record<string, unknown>;
  sort_order: number;
}
```

**Nieuwe Componenten:**

| Component | Doel |
|-----------|------|
| `StaticPageEditor.tsx` | Container voor de visuele page editor |
| `PageBlockRenderer.tsx` | Rendert block type met juiste editable component |
| `EditableRichTextBlock.tsx` | TipTap editor voor rich text |
| `EditableFaqBlock.tsx` | Bewerkbare FAQ accordions |
| `PageBlockToolbar.tsx` | Drag handle + visibility + delete voor blocks |

**Wijzigingen bestaande bestanden:**

| Bestand | Wijziging |
|---------|-----------|
| `StorefrontPagesManager.tsx` | "Bewerken" knop opent `StaticPageEditor` in full-screen mode |
| `useStorefront.ts` | Nieuwe functies voor page block CRUD |
| `storefront.ts` (types) | Nieuwe types voor PageBlock |

**Hergebruik van bestaande componenten:**
- `InlineTextEditor` - voor titels en korte teksten
- `VisualMediaPicker` - voor afbeeldingen
- `RichTextEditor` - voor uitgebreide tekst (met TipTap)
- Drag & drop setup van `VisualEditorCanvas`

---

## Implementatie Volgorde

```text
Fase 1: AI Copywriting (snelste waarde)
├── Edge function: ai-generate-storefront-copy
├── Component: AICopyButton
└── Integratie in InlineTextEditor

Fase 2: Undo/Redo
├── Uitbreiding VisualEditorContext
├── History hook
└── Toolbar knoppen

Fase 3: Static Pages Editor
├── Database migratie (content structuur)
├── StaticPageEditor component
├── Block type components
└── Integratie in StorefrontPagesManager
```

---

## Bestanden Overzicht

### Nieuwe bestanden
- `src/components/admin/storefront/visual-editor/AICopyButton.tsx`
- `src/components/admin/storefront/visual-editor/hooks/useUndoRedo.ts`
- `src/components/admin/storefront/visual-editor/StaticPageEditor.tsx`
- `src/components/admin/storefront/visual-editor/blocks/PageBlockRenderer.tsx`
- `src/components/admin/storefront/visual-editor/blocks/EditableRichTextBlock.tsx`
- `src/components/admin/storefront/visual-editor/blocks/EditableFaqBlock.tsx`
- `supabase/functions/ai-generate-storefront-copy/index.ts`

### Aangepaste bestanden
- `src/components/admin/storefront/visual-editor/InlineTextEditor.tsx`
- `src/components/admin/storefront/visual-editor/VisualEditorContext.tsx`
- `src/components/admin/storefront/visual-editor/VisualEditorCanvas.tsx`
- `src/components/admin/storefront/visual-editor/sections/EditableHeroSection.tsx`
- `src/components/admin/storefront/visual-editor/sections/EditableTextImageSection.tsx`
- `src/components/admin/storefront/visual-editor/sections/EditableNewsletterSection.tsx`
- `src/components/admin/storefront/StorefrontPagesManager.tsx`
- `src/hooks/useStorefront.ts`
- `src/types/storefront.ts`
- `supabase/config.toml` (nieuwe edge function registratie)

---

## AI Credits Verbruik

| Feature | Credits per actie |
|---------|-------------------|
| Genereer titel | 1 credit |
| Genereer subtitel | 1 credit |
| Genereer CTA | 1 credit |
| Herschrijf tekst | 1 credit |

Totaal maandelijks budget afhankelijk van tenant's abonnement.
