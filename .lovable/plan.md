
## Logo integratie in cadeaukaart-ontwerpen + downloadbare productfoto

### Overzicht

Twee verbeteringen:
1. **Tenant logo** tonen op alle cadeaukaart-templates (zowel preview, storefront als e-mail)
2. **Download-knop** in de admin om het gerenderde ontwerp als PNG op te slaan, zodat het als productfoto of categorie-afbeelding gebruikt kan worden

---

### Deel 1: Logo toevoegen aan templates

**Bestand: `src/components/shared/GiftCardTemplates.tsx`**

- Nieuwe prop `logoUrl?: string` toevoegen aan zowel `GiftCardTemplatePreview` als `GiftCardTemplateRenderer`
- In de templates het logo renderen boven of naast de winkelnaam:
  - Bij compact (preview): klein logo (24x24px) naast de winkelnaam
  - Bij full renderer: groter logo (40-48px) boven de winkelnaam
  - Logo krijgt `object-contain` styling en een lichte achtergrond/padding bij donkere templates (elegant, gradient, festive) voor contrast
  - Als er geen logo is, wordt alleen de winkelnaam getoond (huidige gedrag)

**Bestand: `supabase/functions/send-gift-card-email/index.ts`**

- Het tenant logo (`tenant.logo_url`) opnemen in de e-mail HTML als `<img>` tag in de header van de kaart, boven de winkelnaam
- Fallback: als er geen logo is, alleen tekst tonen

---

### Deel 2: Logo doorlussen naar componenten

**Bestand: `src/pages/admin/ProductForm.tsx`**

- `currentTenant?.logo_url` doorsturen naar de `GiftCardTemplatePreview` componenten in het admin template-grid

**Bestand: `src/components/storefront/GiftCardPurchaseForm.tsx`**

- Nieuwe prop `logoUrl` accepteren (of uit themeSettings halen: `themeSettings?.logo_url`)
- Doorsturen naar `GiftCardTemplatePreview` en `GiftCardTemplateRenderer`

**Bestand: `src/pages/storefront/ShopProductDetail.tsx`**

- `tenant?.logo_url` meegeven aan de `GiftCardPurchaseForm` (of via themeSettings)

---

### Deel 3: Downloadbaar als productfoto (admin)

**Bestand: `src/pages/admin/ProductForm.tsx`**

- Onder het template-grid een "Download als afbeelding" knop toevoegen
- Deze knop rendert het geselecteerde template op een verborgen `<canvas>` via `html2canvas` (of een vergelijkbare aanpak met een hidden div + `html-to-image`)
- De gegenereerde PNG kan als productfoto worden gedownload of direct geupload naar de product-images

Technische aanpak (zonder extra dependency):
- Een verborgen `div` (ref) renderen met de `GiftCardTemplateRenderer` op vaste afmetingen (bijv. 800x500px)
- De bestaande `canvas-confetti` package bevat geen html-to-image logica, dus we gebruiken de **native** `html2canvas` aanpak:
  - Installeer `html-to-image` (lichtgewicht, ~5KB) OF gebruik een pure Canvas API benadering
  - `html-to-image` is het eenvoudigst: `toPng(element)` geeft een data-URL die als bestand opgeslagen kan worden

**Flow:**
1. Admin klikt "Download als productfoto"
2. Hidden div wordt gerenderd met het volledige template (logo + winkelnaam + voorbeeld bedrag)
3. `toPng()` converteert naar PNG data URL
4. Bestand wordt gedownload via een `<a>` tag met `download` attribuut
5. Optioneel: knop "Instellen als productfoto" uploadt de PNG direct naar de product-images bucket

---

### Samenvatting wijzigingen

| Bestand | Wijziging |
|---|---|
| `src/components/shared/GiftCardTemplates.tsx` | `logoUrl` prop toevoegen aan Preview en Renderer, logo weergeven |
| `src/pages/admin/ProductForm.tsx` | Logo doorsturen, download-knop + hidden render div toevoegen |
| `src/components/storefront/GiftCardPurchaseForm.tsx` | Logo prop accepteren en doorsturen |
| `src/pages/storefront/ShopProductDetail.tsx` | `tenant?.logo_url` meegeven |
| `supabase/functions/send-gift-card-email/index.ts` | Logo in e-mail header opnemen |
| `package.json` | `html-to-image` dependency toevoegen |

### Resultaat
- Elk cadeaukaart-ontwerp toont het logo van de winkel, zowel in previews, storefront als in de e-mail
- Admins kunnen het ontwerp downloaden als PNG om te gebruiken als productfoto of categorie-afbeelding
- Het gedownloade ontwerp bevat het logo, de winkelnaam en een voorbeeldbedrag -- klaar om overal te gebruiken
