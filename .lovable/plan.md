
# Fix: Achterstevoren Typen in InlineTextEditor

## Probleem

Wanneer je tekst typt in de Visual Editor, verschijnen de karakters in omgekeerde volgorde. Dit komt doordat de cursor steeds naar het begin van het tekstveld springt na elke toetsaanslag.

## Root Cause

Het probleem zit in `InlineTextEditor.tsx` bij het gebruik van `contentEditable` met React's controlled state:

```typescript
// Huidige probleem:
const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
  setEditValue(e.currentTarget.textContent || '');  // <- Triggert re-render
};

// In de render:
<div contentEditable={isEditing}>
  {displayValue}  // <- Bij re-render wordt dit opnieuw gerenderd, cursor reset
</div>
```

Elke `setEditValue()` triggert een re-render, waardoor React de `displayValue` opnieuw rendert en de browser cursor positie verliest.

## Oplossing

Maak het `contentEditable` element **uncontrolled** tijdens het bewerken:

1. **Geen state updates tijdens typen** - Alleen opslaan bij blur/save
2. **Behoud de ref-waarde** - Lees `textContent` alleen bij save
3. **Initialiseer content bij edit start** - Zet initiele tekst via DOM

## Technische Wijzigingen

### Bestand: `src/components/admin/storefront/visual-editor/InlineTextEditor.tsx`

**Wijzigingen:**

1. Verwijder `handleInput` callback (geen state updates tijdens typen)
2. Bij `handleClick`, zet de initiele tekst in de ref
3. Bij `handleSave`, lees de tekst uit de ref
4. Auto-save blijft werken maar leest uit ref in plaats van state

```typescript
// NIEUWE aanpak:
const handleClick = () => {
  setIsEditing(true);
  // ... focus en selecteer tekst
};

// Geen handleInput meer - we updaten NIET de state tijdens typen!

const handleSave = useCallback(() => {
  const newValue = editorRef.current?.textContent || '';
  if (newValue !== value) {
    onSave(newValue);
  }
  setIsEditing(false);
}, [value, onSave]);

// Auto-save leest ook uit ref:
useEffect(() => {
  if (isEditing) {
    saveTimeoutRef.current = setTimeout(() => {
      const newValue = editorRef.current?.textContent || '';
      if (newValue !== value) {
        onSave(newValue);
      }
    }, 2000);
  }
  // ...
}, [isEditing, onSave, value]);

// In render: toon value prop, niet editValue state
<div contentEditable={isEditing}>
  {value || placeholder}
</div>
```

**Volledige oplossing:**

De `InlineTextEditor` wordt aangepast zodat:
- `editValue` state wordt verwijderd (niet meer nodig)
- `handleInput` wordt verwijderd (geen updates tijdens typen)
- `handleSave` leest de waarde rechtstreeks uit `editorRef.current.textContent`
- De debounced auto-save leest ook uit de ref
- De render toont `value` prop, niet de state

## Waarom Dit Werkt

| Probleem | Oplossing |
|----------|-----------|
| State update triggert re-render | Geen state updates tijdens typen |
| Re-render reset cursor positie | Geen re-renders tijdens typen |
| React controleert de DOM inhoud | Browser beheert de DOM tijdens editing |

Door `contentEditable` uncontrolled te maken, laat je de browser de cursor en tekstinvoer beheren zoals normaal. Je leest de waarde alleen bij het opslaan.

## Alternatieve Overwegingen

1. **Waarom geen cursor position restore?** - Dit is complex, error-prone, en werkt niet goed met selection ranges
2. **Waarom geen input element?** - We willen inline styling behouden (h1, h2, etc.)
3. **Waarom geen third-party library?** - Overkill voor simpele tekst editing

## Samenvatting

Het probleem is dat React's controlled state niet goed werkt met `contentEditable`. Door de state te verwijderen tijdens het bewerken en alleen de DOM ref te gebruiken, wordt het cursor probleem opgelost en typt de tekst in de juiste richting.
