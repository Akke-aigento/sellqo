

# Header & Footer Tablet Layout Optimalisatie

## Huidige Situatie

### Header (LandingNavbar.tsx)
- Breakpoint `md:` (768px) schakelt van hamburger naar desktop navigatie
- Op tablet (768-1024px) past de volledige navigatie + CTA buttons soms krap

### Footer (LandingFooter.tsx)
- Grid: `md:grid-cols-2 lg:grid-cols-4`
- Bottom bar: `flex-col md:flex-row` - op tablet komen 3 elementen naast elkaar
- Logo breedte: `width={400}` - te groot voor tablet

---

## Oplossingen

### 1. LandingNavbar - Hamburger Menu Tot Tablet

**Wijzigingen:**
| Element | Oud | Nieuw |
|---------|-----|-------|
| Desktop nav | `hidden md:flex` | `hidden lg:flex` |
| Desktop CTA | `hidden md:flex` | `hidden lg:flex` |
| Hamburger knop | `md:hidden` | `lg:hidden` |
| Mobile menu | `md:hidden` | `lg:hidden` |

Dit zorgt ervoor dat het hamburger menu zichtbaar blijft tot 1024px (tablet landscape).

---

### 2. LandingFooter - Betere Tablet Layout

**Grid aanpassingen:**
| Element | Oud | Nieuw |
|---------|-----|-------|
| Main grid | `md:grid-cols-2 lg:grid-cols-4` | `sm:grid-cols-2 lg:grid-cols-4` |
| Logo width | `width={400}` | Responsive: `w-full max-w-[200px] md:max-w-[280px]` |

**Bottom bar aanpassingen:**
| Element | Oud | Nieuw |
|---------|-----|-------|
| Container | `flex-col md:flex-row` | `flex-col lg:flex-row` |
| Legal links | `flex-wrap justify-center gap-6` | `flex-wrap justify-center gap-4 md:gap-6` |
| Language selector | Inline separators | Compacter op tablet |

Op tablet (768-1024px) stapelt de bottom bar nu verticaal voor betere leesbaarheid.

---

## Technische Details

### Bestand 1: `src/components/landing/LandingNavbar.tsx`
- Regel 52: `hidden md:flex` → `hidden lg:flex`
- Regel 65: `hidden md:flex` → `hidden lg:flex`
- Regel 80: `md:hidden` → `lg:hidden`
- Regel 91: `md:hidden` → `lg:hidden`

### Bestand 2: `src/components/landing/LandingFooter.tsx`
- Regel 53: Grid aanpassen naar `sm:grid-cols-2 lg:grid-cols-4`
- Regel 56: Logo responsive width
- Regel 145: Bottom bar `flex-col lg:flex-row`
- Regel 150: Legal links gap aanpassen
- Optioneel: Taalselector compacter maken

---

## Visueel Resultaat

```text
TABLET (768-1024px):

HEADER:
┌─────────────────────────────────────┐
│ [Logo]              [☰ Hamburger]   │
└─────────────────────────────────────┘

FOOTER GRID:
┌────────────────┬────────────────────┐
│ Brand + Social │ Product Links      │
├────────────────┼────────────────────┤
│ Bedrijf Links  │ Support Links      │
└────────────────┴────────────────────┘

FOOTER BOTTOM:
┌─────────────────────────────────────┐
│        © 2025 SellQo BV             │
│   Privacy | Terms | Cookies         │
│      🇳🇱 | 🇬🇧 | 🇫🇷 | 🇩🇪              │
└─────────────────────────────────────┘
```

---

## Verwacht Resultaat

1. **Header:** Hamburger menu blijft zichtbaar op tablet tot 1024px
2. **Footer grid:** 2 kolommen op tablet, netjes gepositioneerd
3. **Footer bottom:** Gestapeld op tablet, naast elkaar op desktop
4. **Logo:** Schaalt mee met schermgrootte

