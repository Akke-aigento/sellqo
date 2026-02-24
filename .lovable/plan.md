

## Cadeaukaart koop-flow: Admin layout opschonen + Storefront aankoopervaring

### Overzicht

Er zijn drie grote problemen:
1. **Admin productpagina** toont irrelevante velden (prijzen, voorraad, SKU, varianten, verzending) wanneer het producttype "Cadeaukaart" is
2. **Storefront productpagina** toont een standaard productpagina met EUR 0,00 en "toevoegen aan winkelwagen" in plaats van een cadeaukaart-koopflow
3. **Ontwerpen** zijn niet bereikbaar/beheerbaar vanuit het productformulier

---

### Deel 1: Admin ProductForm opschonen voor cadeaukaarten

**Bestand: `src/pages/admin/ProductForm.tsx`**

Wanneer `productType === 'gift_card'`, de volgende secties verbergen:
- **Prijzen** card (verkoopprijs, vergelijkingsprijs, inkoopprijs) -- niet relevant, de klant kiest zelf het bedrag
- **Voorraad & Identificatie** card (SKU, barcode, voorraad bijhouden, verzending vereist)
- **Variant opties** en **Varianten** cards
- **Technische specificaties**
- **Gewicht/verzending** velden

Wat WEL zichtbaar blijft:
- Product type selector
- Product informatie (naam, slug, beschrijving)
- Cadeaukaart configuratie card (bedragen, vrij bedrag, ontwerp, geldigheid)
- Afbeeldingen sidebar
- Organisatie (categorieeen, tags)
- Status (actief, uitgelicht)
- SEO

Toevoegen aan de Cadeaukaart configuratie card:
- Een "Ontwerpen beheren" link-knop die naar `/admin/promotions/gift-card-designs` navigeert zodat het duidelijk is waar ontwerpen aangemaakt worden

---

### Deel 2: Storefront cadeaukaart productpagina

**Nieuw bestand: `src/components/storefront/GiftCardPurchaseForm.tsx`**

Een component dat de standaard "add to cart" blok vervangt met een stapsgewijze cadeaukaart-koopflow:

**Stap 1 - Bedrag kiezen:**
- Grid van vaste bedragen als klikbare knoppen (uit `gift_card_denominations`)
- Optioneel vrij bedragveld (als `gift_card_allow_custom` actief is) met min/max validatie
- Geselecteerd bedrag duidelijk getoond

**Stap 2 - Ontvanger gegevens:**
- Naam ontvanger
- E-mailadres ontvanger
- Persoonlijk bericht (optioneel, textarea)
- Verzenddatum kiezen (vandaag of een toekomstige datum via date picker)

**Stap 3 - Bevestiging & toevoegen aan winkelwagen:**
- Samenvatting van keuzes (bedrag, ontvanger, bericht, verzenddatum)
- "Toevoegen aan winkelwagen" knop

**Bestand: `src/pages/storefront/ShopProductDetail.tsx`**

- Detecteer of het product `product_type === 'gift_card'` is
- Vervang het standaard add-to-cart blok (quantity selector, winkelwagen knop) door de `GiftCardPurchaseForm` component
- Verberg irrelevante elementen: voorraadstatus, SKU, quantity selector, viewers count

---

### Deel 3: Cart & Checkout integratie

**Bestand: `src/context/CartContext.tsx`**

- Cart item interface uitbreiden met optionele cadeaukaart-metadata:

```text
giftCard?: {
  recipientName: string;
  recipientEmail: string;
  personalMessage?: string;
  sendDate?: string;    // ISO date
  designId?: string;
}
```

**Bestand: `src/components/storefront/CartDrawer.tsx`**

- Bij cadeaukaart items: toon een label "Cadeaukaart" met de ontvanger naam/email
- Geen quantity aanpassing mogelijk (altijd 1)

---

### Deel 4: Automatische cadeaukaart code generatie bij bestelling

**Bestand: `supabase/functions/process-gift-card-order/index.ts`** (nieuw)

Een edge function die na een succesvolle bestelling:
1. Een gift_card record aanmaakt via `generate_gift_card_code` RPC
2. Een purchase transaction aanmaakt
3. De email verstuurt (of schedult als verzenddatum in de toekomst ligt)
4. De gift_card_id koppelt aan de order

**Bestand: `src/pages/storefront/ShopCheckout.tsx`**

- Na succesvolle betaling: als de order cadeaukaart-items bevat, de `process-gift-card-order` edge function aanroepen

---

### Deel 5: Database uitbreiding

Kleine toevoegingen aan de checkout flow:
- `orders` of `order_items` tabel uitbreiden met een `gift_card_metadata` JSONB kolom om de ontvanger info, bericht, en verzenddatum op te slaan per item
- Koppeling `gift_cards.order_id` wordt gevuld bij verwerking

---

### Technische details

Bestanden die gewijzigd worden:
1. `src/pages/admin/ProductForm.tsx` -- secties conditioneel verbergen bij gift_card type
2. `src/pages/storefront/ShopProductDetail.tsx` -- gift card variant van de productpagina
3. `src/components/storefront/GiftCardPurchaseForm.tsx` -- nieuw component
4. `src/context/CartContext.tsx` -- giftCard metadata in cart items
5. `src/components/storefront/CartDrawer.tsx` -- cadeaukaart weergave in drawer
6. `src/pages/storefront/ShopCheckout.tsx` -- gift card verwerking na betaling
7. `supabase/functions/process-gift-card-order/index.ts` -- automatische code generatie

Database migratie:
- `order_items` kolom `gift_card_metadata` (jsonb, nullable)

### Resultaat
- Admin ziet alleen relevante velden bij cadeaukaart producten
- Klanten krijgen een begeleide koopervaring: bedrag kiezen, ontvanger invullen, bericht toevoegen
- Na betaling wordt automatisch een cadeaukaartcode aangemaakt en per mail verstuurd
- De ontvanger krijgt een mooie email met code en bedrag
- Ontwerpen zijn bereikbaar vanuit het productformulier via een duidelijke link
