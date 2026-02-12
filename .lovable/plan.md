
# Fix: Visuele opmaak in Rich Text Editors

## Probleem
De TipTap rich text editors gebruiken Tailwind's `prose` CSS-klassen voor het weergeven van koppen, lijsten, citaten, etc. Het `@tailwindcss/typography` pakket is wel geinstalleerd, maar **niet geactiveerd** in de Tailwind configuratie. Hierdoor worden alle opmaakstijlen genegeerd en ziet alles er hetzelfde uit als gewone tekst.

## Oorzaak
In `tailwind.config.ts` ontbreekt de typography plugin in de `plugins` array. Er staat nu alleen:
```
plugins: [require("tailwindcss-animate")]
```

## Oplossing
Een eenregelige wijziging in `tailwind.config.ts`:

### `tailwind.config.ts` (regel 118)
Voeg `require("@tailwindcss/typography")` toe aan de plugins array:
```
plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")]
```

Dit lost het probleem op voor **alle** rich text editors in het project:
- Categoriebeschrijving
- Productbeschrijving
- Storefront visuele editor
- Alle andere plekken die `prose` klassen gebruiken

Na deze wijziging worden koppen (H2, H3, H4), lijsten, citaten, links en andere opmaak direct visueel zichtbaar in de editors.
