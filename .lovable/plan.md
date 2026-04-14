

# Fix Image Editor: betere resultaten + daadwerkelijk opslaan

## Probleem 1: Slechte bewerkingsresultaten
Het huidige model (`google/gemini-3-pro-image-preview`) is een generatief model dat de hele afbeelding hertekent. Bij "maak achtergrond zwart" verandert het ook het product zelf (gele jas → beige jas). 

**Oplossing**: De prompt engineering verbeteren zodat het model expliciet wordt geïnstrueerd het product **niet** te wijzigen. Specifiek:
- Bij `enhance`-type: prompt aanpassen met sterke instructie zoals "Do NOT modify the subject/product in any way. Only change the background."
- Bij `background_remove`: zelfde bescherming toevoegen
- Model upgraden naar `google/gemini-3.1-flash-image-preview` dat sneller is en beter met editing omgaat

**Bestand:** `supabase/functions/ai-generate-image/index.ts`
- Prompt templates aanpassen met expliciete "preserve subject" instructies
- Model wisselen naar `google/gemini-3.1-flash-image-preview`

## Probleem 2: Bewerkte afbeeldingen worden niet opgeslagen
In `MediaAssetsLibrary.tsx` doet de `onApply` callback niets met de nieuwe URL:
```tsx
onApply={(newUrl) => {
  toast.success('Afbeelding bewerkt');
  // newUrl wordt WEGGEGOOID!
}}
```

**Oplossing**: De bewerkte afbeelding opslaan afhankelijk van het asset-type:
- **Product-assets**: product_images record updaten met nieuwe URL
- **Upload-assets**: media_assets record updaten met nieuwe file_url
- **Categorie-assets**: categories record updaten met nieuwe image_url

**Bestand:** `src/components/admin/marketing/MediaAssetsLibrary.tsx`
- `onApply` implementeren zodat de nieuwe URL wordt teruggeschreven naar de juiste tabel op basis van `asset.source`
- Na opslaan: query invalideren zodat de lijst ververst wordt

## Bestanden
| Bestand | Actie |
|---------|-------|
| `supabase/functions/ai-generate-image/index.ts` | Prompt verbeteren + model upgraden |
| `src/components/admin/marketing/MediaAssetsLibrary.tsx` | `onApply` daadwerkelijk laten opslaan per asset-type |

