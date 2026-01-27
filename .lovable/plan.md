

# Mobile Horizontal Overflow Fix + Desktop Float Behouden

## Probleemanalyse

De huidige situatie veroorzaakt een conflict:

| Vereiste | Desktop | Mobile |
|----------|---------|--------|
| Floating cards | Mogen buiten container vallen ✅ | Moeten binnen viewport blijven |
| Dashboard mockup | Volledige breedte | Schaalt met `scale-[0.85]` maar overflow niet beperkt |
| Section overflow-hidden | Effectief | **Werkt niet** omdat inhoud bredere breedte forceert |

**Root cause:** De `scale()` transform behoudt de oorspronkelijke box-dimensies in de layout. Een element van 600px breed geschaald naar 85% neemt nog steeds 600px ruimte in, alleen visueel kleiner.

---

## Oplossing: Responsive Overflow Control

### Strategie

1. **Desktop (lg+):** Geen overflow restriction - floating effect behouden
2. **Mobile/Tablet (<lg):** Strikte overflow control via wrapper

### Technische Aanpak

Voeg een wrapper toe rond de dashboard mockup sectie die:
- Op mobile `overflow-hidden` heeft
- Op desktop `overflow-visible` heeft (of geen restriction)

---

## Technische Wijzigingen

### Bestand: `src/components/landing/HeroSection.tsx`

**Regel 92-93 - Voeg responsive overflow toe:**

```tsx
// Oud:
<div className="relative">

// Nieuw:
<div className="relative overflow-hidden lg:overflow-visible">
```

Dit zorgt ervoor dat:
- Mobile/tablet: `overflow-hidden` voorkomt horizontale scroll
- Desktop: `overflow-visible` laat floating cards buiten container zweven

### Alternatief (als floating cards op mobile niet nodig zijn):

De floating cards zijn al `hidden md:flex`, dus ze worden alleen op md+ getoond. We kunnen de overflow breakpoint daarop afstemmen:

```tsx
<div className="relative overflow-hidden md:overflow-visible">
```

---

## Visueel Resultaat

```text
MOBILE (<768px):
┌─────────────────────────┐
│  Hero Text              │
│                         │
│  ┌───────────────────┐  │
│  │   Dashboard       │  │ ← Netjes binnen viewport
│  │   (scaled 85%)    │  │
│  └───────────────────┘  │
│                         │
│  [Floating cards: HIDDEN]
└─────────────────────────┘

DESKTOP (≥1024px):
         ← Float buiten box
┌────────┬────────────────────────────┐
│ Text   │  ┌──────────────────┐      │
│ Content│  │   Dashboard      │ Float│
│        │  │   (full size)    ├──────┤
│        │  └──────────────────┘      │
│        │              ↑ Float       │
└────────┴────────────────────────────┘
```

---

## Verwacht Resultaat

Na deze wijziging:
1. **Mobile:** Geen horizontale scroll meer - content blijft binnen viewport
2. **Tablet:** Idem - overflow beperkt
3. **Desktop:** Floating effect volledig behouden - cards zweven buiten container
4. **Floating cards:** Alleen zichtbaar op md+ (al zo geconfigureerd)

