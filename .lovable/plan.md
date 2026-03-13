

## Plan: "Genereer Juridische Pagina's" knop met AI-generatie

### Wat wordt gebouwd

Een "Genereer pagina's" knop in de LegalPagesManager die via AI (Lovable AI) juridische pagina's genereert op basis van de ingevulde tenant-gegevens. Ontbrekende vereiste gegevens worden eerst getoond als foutmelding.

### Vereiste tenant-gegevens per paginatype

| Paginatype | Vereiste velden |
|---|---|
| **Alle pagina's** | `name`, `owner_email`, `address`, `city`, `postal_code`, `country` |
| Privacy / Cookie | + `btw_number` of `kvk_number` |
| Algemene Voorwaarden | + `iban` (voor betalingsinfo) |
| Retourbeleid | (basis is voldoende) |
| Verzendbeleid | (basis is voldoende) |
| Contactgegevens | + `phone` |
| Juridische Kennisgeving | + `kvk_number`, `btw_number` |

### Technische aanpak

**1. Edge function: `generate-legal-pages`**
- Ontvangt `tenant_id` en optioneel een lijst van `page_types` om te genereren
- Haalt tenant-gegevens op uit de `tenants` tabel
- Valideert of de vereiste velden ingevuld zijn per paginatype
- Retourneert foutmelding met ontbrekende velden als die er zijn
- Roept Lovable AI aan (bijv. `google/gemini-2.5-flash`) met een prompt die de bedrijfsgegevens bevat en vraagt om juridische pagina's in het Nederlands (primair) en Engels
- Slaat gegenereerde content op in `legal_pages` tabel (`content_nl`, `content_en`, `title_nl`, `title_en`, `is_auto_generated = true`)

**2. UI aanpassingen in `LegalPagesManager.tsx`**
- Nieuwe "Genereer met AI" knop toevoegen (met Sparkles icoon)
- Bij klik: roept edge function aan
- Bij ontbrekende gegevens: toont alert met lijst van ontbrekende velden en link naar instellingen
- Bij succes: herlaadt de pagina's en toont success toast
- Loading state tijdens generatie (kan even duren)

**3. Validatielogica**
- Functie `checkRequiredTenantFields()` die per paginatype controleert of de benodigde tenant-velden zijn ingevuld
- Geeft een object terug met `{ canGenerate: boolean, missingFields: string[] }`
- Wordt zowel client-side (voor directe feedback) als server-side (in edge function) gecontroleerd

### Bestanden die worden aangemaakt/gewijzigd

- **Nieuw**: `supabase/functions/generate-legal-pages/index.ts` — Edge function met AI-generatie
- **Wijzigen**: `src/components/admin/storefront/LegalPagesManager.tsx` — Knop + validatie UI toevoegen
- **Wijzigen**: `supabase/config.toml` — Functie registreren (verify_jwt = false)

