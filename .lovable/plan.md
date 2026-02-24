

## Cadeaukaart ontwerpen: Ingebouwde templates met dynamische data

### Overzicht

In plaats van een aparte pagina waar tenants ontwerpen uploaden (die nu 404 geeft), bouwen we een systeem van **ingebouwde SellQo-templates** die automatisch gevuld worden met de juiste gegevens (naam, bedrag, code, bericht, winkelnaam). Dit werkt op twee niveaus:

1. **Admin** kiest een standaard template (visuele preview inline in het productformulier)
2. **Klant** kan bij aankoop zelf een template kiezen uit de actieve ontwerpen (nieuw stap in de koopflow)

---

### De templates

Zes ingebouwde visuele templates, elk met een eigen kleurstijl en sfeer:

| Template ID | Naam | Stijl |
|---|---|---|
| `elegant` | Elegant | Donkere achtergrond, goudkleurige accenten |
| `modern` | Modern | Strak wit, primaire kleur van de winkel |
| `festive` | Feestelijk | Warme kleuren, confetti-achtige accenten |
| `botanical` | Botanisch | Zachte groentinten, organische vormen |
| `minimal` | Minimalistisch | Zwart-wit, typografisch |
| `gradient` | Kleurrijk | Gradient achtergrond op basis van merkkleur |

Elke template is een React component (`GiftCardTemplatePreview`) die de volgende placeholders dynamisch rendert:
- Winkelnaam (uit tenant settings)
- Bedrag
- Ontvangernaam
- Persoonlijk bericht
- Cadeaukaartcode
- Geldigheidsdatum

---

### Wijzigingen

#### 1. Nieuw bestand: `src/components/shared/GiftCardTemplates.tsx`

Definieert de template-configuraties en een visuele preview-component:

- Array `giftCardTemplates` met id, naam, beschrijving, kleuren
- Component `GiftCardTemplatePreview` die een mini-kaartweergave rendert als visuele selector
- Component `GiftCardTemplateRenderer` die de volledige kaart rendert met dynamische data (voor e-mail en storefront preview)

#### 2. Admin ProductForm (`src/pages/admin/ProductForm.tsx`)

- **Verwijder** de broken link naar `/admin/promotions/gift-card-designs`
- **Vervang** de `gift_card_design_id` dropdown door een visueel template-grid
  - 3 kolommen met clickbare kaartpreviews
  - Geselecteerde template met een duidelijke rand/check
  - Het veld `gift_card_design_id` slaat nu een template-ID op (string zoals `elegant`, `modern`, etc.) in plaats van een UUID
- De tenant kiest hier het **standaard** template; klanten kunnen een ander kiezen

#### 3. Storefront GiftCardPurchaseForm (`src/components/storefront/GiftCardPurchaseForm.tsx`)

Voeg een **ontwerpkeuze** toe aan stap 1 (samengevoegd met bedragkeuze), of als aparte substap:

- Na het kiezen van het bedrag verschijnt een grid van beschikbare templates
- Elke template toont een mini-preview met het gekozen bedrag erin
- Standaard is het template dat de tenant in de admin heeft ingesteld voorgeselecteerd
- De gekozen template-ID wordt meegestuurd als `designId` in de cart metadata

De stap-indicator wordt:
1. **Bedrag en ontwerp** (samengevoegd)
2. **Ontvanger**
3. **Bevestiging** (nu ook met een preview van de gekozen template)

#### 4. Edge Function (`supabase/functions/process-gift-card-order/index.ts`)

- Het `design_id` veld bevat nu een template-ID string (bijv. `elegant`)
- Bij het genereren van de e-mail wordt de template-stijl gebruikt om een mooie HTML e-mail te renderen met de juiste kleuren, layout en dynamische data

#### 5. Opruimen

- De route naar `GiftCardDesigns` pagina hoeft niet aangemaakt te worden (die was nooit geregistreerd)
- De `gift_card_designs` tabel en bijbehorende hooks (`useGiftCardDesigns`) blijven bestaan maar worden niet meer actief gebruikt voor de koopflow; ze kunnen later dienen voor custom tenant-uploads als premium feature
- De `GiftCardDesignDialog` component wordt niet gewijzigd (blijft beschikbaar voor eventueel later gebruik)

---

### Technische details

**GiftCardTemplatePreview component:**
- Puur CSS-gebaseerd (geen afbeeldingen nodig)
- Gebruikt CSS gradients, borders en typografie om unieke stijlen te creeren
- Schaalt mee met de merkkleur van de tenant via de `themeSettings.primary_color` of brand_color
- Responsief: past zich aan in zowel admin als storefront contexten

**Data flow:**
```text
Admin kiest template "elegant" 
  -> product.gift_card_design_id = "elegant"
Klant koopt cadeaukaart, kiest "festive"
  -> cart.giftCard.designId = "festive" (override)
Checkout -> order_items.gift_card_metadata.designId = "festive"
Edge function -> rendert e-mail met "festive" template + dynamische data
```

**Bestanden die gewijzigd/aangemaakt worden:**

| Bestand | Actie |
|---|---|
| `src/components/shared/GiftCardTemplates.tsx` | Nieuw - template definities en preview components |
| `src/pages/admin/ProductForm.tsx` | Wijzig - visueel template-grid i.p.v. dropdown + broken link verwijderen |
| `src/components/storefront/GiftCardPurchaseForm.tsx` | Wijzig - ontwerpkeuze toevoegen aan stap 1 |
| `supabase/functions/process-gift-card-order/index.ts` | Wijzig - template-gebaseerde e-mail rendering |

### Resultaat
- Geen 404 meer: de broken link verdwijnt en wordt vervangen door een inline template picker
- Tenants kiezen uit professionele, vooraf ontworpen templates zonder iets te hoeven uploaden
- Klanten zien een visueel aantrekkelijke ontwerpkeuze bij aankoop met live preview van het bedrag
- E-mails worden automatisch gegenereerd met het gekozen template en alle dynamische gegevens
- Templates passen zich aan de merkkleur van de winkel aan voor een consistente uitstraling
