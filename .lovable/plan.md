

## Bundel Productpagina: Visueel Verbeterde Productlijst

### Huidige situatie
De `BundleContentsSection` component bestaat al en toont de bundel-items met klikbare links. Maar het design is minimalistisch — kleine thumbnails (48px), weinig visuele hiërarchie, en het ziet er niet anders uit dan een simpele lijst.

### Wat we verbeteren

**`src/components/storefront/BundleContentsSection.tsx`** — volledig redesign:

1. **Grotere productkaarten** per item met:
   - Grotere afbeelding (80×80px)
   - Productnaam als duidelijke klikbare link met hover-effect en pijltje/chevron
   - Individuele prijs (doorgestreept) naast de naam
   - Hoeveelheid badge als die > 1 is
   - Optioneel/verplicht indicator

2. **Duidelijke visuele scheiding** tussen de bundel-sectie en de rest:
   - Sectie-header met icoon + titel "In deze bundel ({x} producten)"
   - Subtiele kaartjes per product met lichte achtergrond en border
   - Hover-state op elke kaart (schaduw/border kleurverandering) om clickability te benadrukken

3. **Besparingsindicator prominenter**:
   - Bovenaan de sectie een groene banner met besparing
   - Per product: individuele prijs doorgestreept

4. **Onderaan**: totaal individuele prijs vs. bundelprijs vergelijking

### Technische aanpak
- Enkel `BundleContentsSection.tsx` wordt aangepast
- Props blijven identiek (geen wijziging in ShopProductDetail nodig)
- Links gebruiken bestaand pad: `/shop/{tenantSlug}/product/{product.slug}`
- Tailwind classes voor alle styling

