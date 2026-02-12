

# Fix: Scrollen in AI Assistent popover

## Probleem
De `ScrollArea` van Radix werkt niet met alleen een `max-h` CSS class op het root element. De interne Viewport (`h-full w-full`) heeft een concrete hoogte nodig om scrollgedrag te activeren. Hierdoor kun je bij lange teksten niet scrollen.

## Oplossing
De ScrollArea krijgt een expliciete `style={{ maxHeight: '65vh' }}` en `overflow-hidden` zodat de Radix Viewport correct de hoogte berekent en scrollgedrag inschakelt.

---

## Technische Details

### Wijziging in `AIFieldAssistant.tsx`

De `ScrollArea` op regel 197 wordt aangepast:

**Van:**
```tsx
<ScrollArea className="max-h-[65vh]">
```

**Naar:**
```tsx
<div className="max-h-[65vh] overflow-hidden">
  <ScrollArea className="h-full max-h-[65vh]" style={{ maxHeight: '65vh' }}>
```

Concreet: een wrapper div met vaste `max-h` en `overflow-hidden` wordt om de ScrollArea geplaatst, en de ScrollArea krijgt een inline style zodat Radix de hoogte correct kan resolven voor scrollgedrag.

| Wat | Hoe |
|---|---|
| Bestand | `src/components/admin/ai/AIFieldAssistant.tsx` |
| Regel | ~197 |
| Fix | Wrapper div + inline style voor max-height op ScrollArea |

