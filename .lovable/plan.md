
# Theme Gallery & Live Preview Verbeteren

## Probleem 1: Theme Gallery afgekapt

De ThemeGalleryInline gebruikt `flex-1 min-w-[160px]` waardoor de derde kaart (Modern) wordt afgekapt. Er is geen duidelijk signaal dat er meer content is of kan komen.

### Oplossing
- Verander kaarten naar vaste breedte (`w-[180px] shrink-0`) in plaats van `flex-1 min-w-[160px]`
- Voeg `scrollbar-thin` styling toe zodat de horizontale scroll duidelijk zichtbaar is
- Voeg een subtiele fade-gradient toe aan de rechterrand als visueel scroll-signaal

## Probleem 2: Live Preview komt niet overeen met webshop

De huidige LiveThemePreview toont een statische mock (hardcoded hero + 4 nep-producten). De echte webshop rendert dynamische homepage-secties uit de database: Hero Banner, Tekst + Afbeelding, Featured Products, Newsletter, Testimonials, Video, Collection, External Reviews.

### Oplossing
De LiveThemePreview wordt uitgebreid met een optionele `homepageSections` prop. Wanneer secties beschikbaar zijn, worden ze als herkenbare miniatuur-blokken gerenderd:

| Sectie type | Mini-weergave |
|---|---|
| hero | Groot gekleurd vlak met titel + CTA knop |
| text_image | Twee kolommen: tekst links, grijs vlak rechts |
| featured_products | Mini product grid (bestaande mock) |
| collection | Grid met categorie labels |
| newsletter | Centered input + knop |
| testimonials | Quote-blok met aanhalingstekens |
| video | Grijs vlak met play-icoon |
| external_reviews | Sterren + quote |

Wanneer er geen secties geconfigureerd zijn, valt de preview terug naar de huidige mock als fallback.

De ThemeCustomizer haalt de homepage-secties op via `usePublicStorefront` en geeft ze door aan LiveThemePreview.

## Technische Wijzigingen

| Bestand | Wijziging |
|---|---|
| `src/components/admin/storefront/ThemeGalleryInline.tsx` | Vaste kaartbreedte, fade-gradient indicator bij overflow |
| `src/components/admin/storefront/LiveThemePreview.tsx` | Nieuwe `homepageSections` prop, mini-section renderers per type, fallback naar huidige mock |
| `src/components/admin/storefront/ThemeCustomizer.tsx` | Import `usePublicStorefront`, haal `homepageSections` op, geef door aan LiveThemePreview |
