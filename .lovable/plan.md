

## Ads module: actieknoppen mobiel-optimalisatie

### Probleem
Op alle Ads-schermen staan de header-actieknoppen horizontaal naast de titel. Op 390px vallen deze af — ze worden afgesneden of lopen buiten het scherm.

### Betrokken bestanden en fixes

| Bestand | Probleem | Fix |
|---------|----------|-----|
| `AdsBolcomCampaignDetail.tsx` | 3 knoppen (Sync, Pauzeren, Bewerken) naast titel — past niet | Header wrappen, knoppen onder titel op mobiel |
| `AdsBolcom.tsx` | Period selector + 3 knoppen naast titel | Zelfde wrap-aanpak |
| `AdsBolcomKeywords.tsx` | Period knoppen naast titel | Licht: `flex-wrap` toevoegen |
| `AdsBolcomSearchTerms.tsx` | Period knoppen naast titel | Idem |
| `Ads.tsx` | Period selector naast titel | Idem |
| `AdsAiRules.tsx` | Simpele header — past al | Geen wijziging |

### Aanpak per bestand

**1. AdsBolcomCampaignDetail.tsx (regel 148-173) — zwaarst getroffen**
- Header container: `flex items-center justify-between` → `flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4`
- Knoppen div: `flex gap-2` → `flex flex-wrap gap-2`
- Op mobiel: knoppen staan onder de titel, wrappen als nodig
- Knoptekst inkorten op mobiel: alleen iconen tonen onder sm-breakpoint via `hidden sm:inline` op de tekstlabels

**2. AdsBolcom.tsx (regel 126-151) — 4 knoppen**
- Zelfde wrapper-aanpak: `flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4`
- Knoppen groep: `flex flex-wrap items-center gap-2`
- "Ververs data" knop tekst inkorten of verbergen op mobiel
- "Synchroniseer" → alleen icoon op mobiel

**3. AdsBolcomKeywords.tsx (regel 59-76)**
- Outer div: voeg `flex-wrap gap-2` toe
- Period knoppen zijn compact genoeg maar moeten wel wrappen

**4. AdsBolcomSearchTerms.tsx (regel 96-113)**
- Identiek aan Keywords

**5. Ads.tsx (regel 101-117)**
- Period selector wrappen onder titel op mobiel
- `flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3`

### Patroon voor alle headers

```tsx
// Was:
<div className="flex items-center justify-between">
  <div>titel</div>
  <div className="flex gap-2">knoppen</div>
</div>

// Wordt:
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
  <div>titel</div>
  <div className="flex flex-wrap items-center gap-2">
    <Button>
      <Icon />
      <span className="hidden sm:inline">Lange tekst</span>
    </Button>
  </div>
</div>
```

### Geen database wijzigingen nodig

