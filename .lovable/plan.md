

# Dashboard Mockup Floating Effect Herstellen

## Geïdentificeerd Probleem

Op regel 93 in `HeroSection.tsx` staat nu:
```tsx
<div className="relative overflow-hidden">
```

Deze `overflow-hidden` was toegevoegd om horizontale scroll op mobile te voorkomen, maar het heeft een ongewenst neveneffect: de dashboard mockup en floating cards worden nu "afgeknipt" waardoor het geheel in een box lijkt te zitten.

**Gewenst gedrag:**
- Dashboard en floating cards "zweven" buiten hun container
- Geen horizontale scroll op de pagina

---

## Oplossing

### Aanpak: Selectieve overflow control

| Wijziging | Beschrijving |
|-----------|--------------|
| Verwijder `overflow-hidden` van dashboard wrapper | Laat mockup weer vrij floaten |
| Voeg `overflow-hidden` toe aan de `<section>` tag | Voorkomt horizontale scroll op paginaniveau (al aanwezig op regel 29!) |
| Pas floating card posities aan | Zorg dat ze binnen de viewport blijven op mobile |

De `<section>` heeft al `overflow-hidden` (regel 29), dus de parent div hoeft dit niet te dupliceren.

---

## Technische Wijzigingen

### Bestand: `src/components/landing/HeroSection.tsx`

**Regel 93 - Verwijder overflow-hidden:**
```tsx
// Oud:
<div className="relative overflow-hidden">

// Nieuw:
<div className="relative">
```

Dit zorgt ervoor dat:
1. De floating cards weer buiten de container kunnen "floaten"
2. De dashboard mockup niet meer afgeknipt wordt
3. De `section` overflow-hidden (regel 29) voorkomt nog steeds horizontale pagina-scroll

---

## Visueel Resultaat

```text
VOOR (huidige situatie):
┌───────────────────────────────┐
│  ┌─────────────────────┐      │
│  │   Dashboard Box     │      │  ← Afgekapt
│  │   (clipped)         │      │
│  └─────────────────────┘      │
└───────────────────────────────┘

NA (gewenste situatie):
        ┌─ Float ─┐
┌───────│─────────│─────────────┐
│  ┌────┴─────────┴────┐        │
│  │    Dashboard      │        │  ← Vrij floatend
│  │    (floating)     │   Float│
│  └───────────────────┴────────┤
└───────────────────────────────┘
```

---

## Verwacht Resultaat

Na deze eenvoudige wijziging:
- Dashboard mockup en floating cards zweven weer mooi
- Geen "box" effect meer zichtbaar
- Geen horizontale scroll (dankzij section-level overflow-hidden)
- Mobile layout blijft intact door de responsive scaling

