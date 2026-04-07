
## Fix: Downgrade kaarten pills dezelfde stijl als upgrade kaarten

### Probleem
De "Je verliest" pills op downgrade-kaarten gebruiken nog rode achtergronden (`bg-red-50 border-red-200`), terwijl de upgrade "Je krijgt erbij" pills al zijn omgezet naar grijze achtergrond met gekleurde tekst (`bg-muted border-border`). De limit-changes bij downgrades gebruiken ook nog rode achtergronden.

### Wijziging

**Bestand: `src/components/admin/billing/PlanComparisonCards.tsx`**

- **"Je verliest" pills** (regels 310-313, 319): `bg-red-50 border-red-200` → `bg-muted border-border` (zelfde als upgrade pills, tekst blijft `text-red-700`)
- **"+X meer" button** (regels 316-321): idem, `bg-red-50 border-red-200 hover:bg-red-100` → `bg-muted border-border hover:bg-muted/80`
- **Limit changes bij downgrade** (regels 334-335): `bg-muted` is al goed voor beide, geen wijziging nodig

Resultaat: alle pills hebben een neutrale grijze achtergrond, met groene of rode tekst als enige kleuraccent — consistent voor zowel upgrade als downgrade kaarten.

### Geen database wijzigingen nodig
