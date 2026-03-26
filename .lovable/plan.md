

## Prompt voor Vanxcel Custom Frontend: Bundels, BTW-nummer, Nieuwsbrief

### Overzicht
Er zijn 3 zaken die in het Vanxcel-project moeten worden toegevoegd/verbeterd:

1. **Bundel producten renderen op de productpagina**
2. **BTW-nummer + bedrijfsnaam bij registratie en account**
3. **Nieuwsbrief via de SellQo API i.p.v. externe redirect**

### Voorwaarde: SellQo API moet eerst bundel-data teruggeven

De `storefront-api` edge function (`getProduct()`) retourneert momenteel GEEN `bundle_items` bij bundelproducten. Dit moet **eerst in SellQo** worden toegevoegd voordat Vanxcel het kan renderen. Specifiek:

**In SellQo (dit project) — storefront-api aanpassen:**
- Na het ophalen van het product (rond regel 420), als `product.product_type === 'bundle'`:
  - Query `bundle_products` tabel voor dit product ID
  - Haal bijbehorende product-details op (naam, prijs, afbeeldingen, slug)
  - Bereken `individual_total`
  - Voeg `bundle_items` en `bundle_individual_total` toe aan de response

### Daarna: Prompt voor het Vanxcel project

---

**Prompt om te sturen naar het Vanxcel project:**

> ### 1. Bundel Product Weergave op Productpagina
>
> De SellQo API retourneert nu `bundle_items` en `bundle_individual_total` bij producten met `product_type === 'bundle'`. 
>
> **Types uitbreiden** (`src/integrations/sellqo/types.ts`):
> ```typescript
> export interface BundleItem {
>   product_id: string;
>   quantity: number;
>   is_required: boolean;
>   product: { id: string; name: string; price: number; images: string[] | null; slug: string; };
> }
> ```
> Voeg aan `Product` toe: `bundle_items?: BundleItem[]` en `bundle_individual_total?: number`.
>
> **Normalizer uitbreiden** (`normalizer.ts`): Map `raw.bundle_items` en `raw.bundle_individual_total` door naar het Product object.
>
> **Nieuw component** `src/components/BundleContents.tsx`: Maak een bundel-sectie die verschijnt wanneer `product.product_type === 'bundle'` en `product.bundle_items?.length > 0`. Toon:
> - Header met "In deze bundel (X producten)" + besparingspercentage badge
> - Per item: afbeelding (80×80), productnaam als klikbare link naar `/products/{slug}`, individuele prijs (doorgestreept), hoeveelheid badge als > 1
> - Footer met prijsvergelijking: totaal los vs. bundelprijs + besparing in euro's
> - "Voeg bundel toe aan winkelwagen" knop die alle bundel-items toevoegt aan de cart
>
> **ProductDetail.tsx aanpassen**: Render `<BundleContents>` onder de productafbeelding wanneer het een bundelproduct is.
>
> ### 2. BTW-nummer & Bedrijfsnaam bij Registratie en Account
>
> De `storefront-customer-api` ondersteunt al `company_name`, `vat_number`, en `newsletter_opt_in` bij zowel `register` als `update_profile`. Het BTW-nummer wordt automatisch gevalideerd via VIES.
>
> **Login.tsx — Registratieformulier uitbreiden:**
> - Voeg optionele velden toe: "Bedrijfsnaam" en "BTW-nummer" (met placeholder bijv. `BE0123456789`)
> - Voeg een checkbox toe: "Schrijf mij in voor de nieuwsbrief"
> - Stuur deze mee bij `register()`: `company_name`, `vat_number`, `newsletter_opt_in`
>
> **CustomerAuthContext.tsx uitbreiden:**
> - Voeg aan de `Customer` interface toe: `company_name?: string`, `vat_number?: string`, `vat_verified?: boolean`, `newsletter_opted_in?: boolean`
> - Pas `register()` aan om de extra velden door te geven
> - Pas `updateProfile()` aan om `company_name`, `vat_number`, `newsletter_opt_in` te ondersteunen
>
> **Account.tsx — Profiel tab uitbreiden:**
> - Toon "Bedrijfsnaam" veld (bewerkbaar)
> - Toon "BTW-nummer" veld (bewerkbaar) met een verified-badge als `vat_verified === true`
> - Toon "Nieuwsbrief" toggle (aan/uit) die `newsletter_opt_in` meestuurt bij opslaan
>
> ### 3. Nieuwsbrief via SellQo API
>
> De `Newsletter.tsx` component stuurt momenteel door naar een externe URL. Vervang dit door een API-call.
>
> **Newsletter.tsx aanpassen:**
> - Importeer de SellQo client/fetch
> - Bij submit: POST naar de storefront-api met action `newsletter_subscribe` en `{ email, source: 'website' }`
> - Toon een success-toast ("Bedankt voor je aanmelding!") of error-toast
> - Geen externe redirect meer

### Samenvatting wijzigingen

| Waar | Wat |
|---|---|
| **SellQo** `storefront-api/index.ts` | Bundle items toevoegen aan `getProduct()` response |
| **Vanxcel** `types.ts` | `BundleItem` interface + velden op `Product` |
| **Vanxcel** `normalizer.ts` | Bundle data doorvoeren |
| **Vanxcel** `BundleContents.tsx` | Nieuw component voor bundel-weergave |
| **Vanxcel** `ProductDetail.tsx` | Bundel-sectie renderen |
| **Vanxcel** `Login.tsx` | Bedrijfsnaam, BTW, nieuwsbrief checkbox |
| **Vanxcel** `CustomerAuthContext.tsx` | Extra velden in types + register/update |
| **Vanxcel** `Account.tsx` | Profiel: bedrijf, BTW, nieuwsbrief toggle |
| **Vanxcel** `Newsletter.tsx` | API-call i.p.v. externe redirect |

