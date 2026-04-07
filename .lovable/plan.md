

## SEO Dashboard verbeteren: sorteerbaar op score + "Verbeter SEO" actieknop

### Huidige situatie
De Product- en Categorie-tabellen tonen SEO-scores, maar:
- Je kunt niet sorteren op score (slechtste bovenaan)
- Er is geen visuele kleurindicatie per rij (rood/geel/groen)
- De actieknoppen zitten verstopt achter een `⋯` menu
- Er is geen directe "Verbeter SEO" knop bij slechte scores

### Wat er verandert

**1. Sorteerbare kolommen + standaard op score (laag→hoog)**
- Score-kolom wordt klikbaar om te sorteren
- Standaard: producten/categorieën met slechtste score bovenaan
- Niet-geanalyseerde items helemaal bovenaan

**2. Visuele score-indicatie per rij**
- Gekleurde score-badge: rood (<50), oranje (50-70), groen (70-90), donkergroen (90+)
- Rij-achtergrondkleur subtiel rood bij score <50

**3. Directe "Verbeter SEO" knop bij slechte scores**
- Bij producten/categorieën met score <70: een zichtbare knop "Optimaliseer" naast de score
- Klikt op de knop → opent een dropdown met alle genereer-opties (meta title, meta description, beschrijving)
- Bij score <50: knop in rood/destructive variant voor urgentie

**4. "Alles optimaliseren" knop bovenaan**
- Nieuwe knop: "Optimaliseer alle slechte scores" — selecteert automatisch alle items met score <70 en biedt bulk-generatie aan

### Bestanden

| Bestand | Actie |
|---|---|
| `src/components/admin/seo/SEOProductTable.tsx` | Sortering, kleur-badges, directe actieknop bij lage scores |
| `src/components/admin/seo/SEOCategoryTable.tsx` | Zelfde verbeteringen als ProductTable |

### Geen database wijzigingen nodig

