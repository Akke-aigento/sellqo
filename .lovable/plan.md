## Doel
Peppol e-invoicing op de marketing/landingspagina markeren als **"Coming Soon"** in plaats van als beschikbare feature. Reden: feature is nog niet live, maar wel verplicht vanaf 2026 — moet duidelijk zijn dat het binnenkort komt.

## Wijzigingen per landing-component

### 1. `src/components/landing/IntegrationsShowcaseSection.tsx`
- **Regel 76**: `Peppol` chip status `'live'` → `'coming-soon'`, badge `'B2B'` → `'Coming Soon'`. Het bestaande `IntegrationChip`-component rendert coming-soon al gedimd (muted styling), dus visueel onderscheid is automatisch.

### 2. `src/components/landing/PricingSection.tsx`
- **Pro plan features (regel 67)**: `'Peppol e-invoicing'` → `'Peppol e-invoicing (coming soon)'`.
- **Add-on kaart "Peppol e-Invoicing" (regel 117–126)**: 
  - `urgencyBadge` aanpassen naar `'🔜 Coming Soon — Verplicht 2026'`.
  - `description` lichtjes aanpassen naar `'Binnenkort beschikbaar — verplicht vanaf 2026 in BE'`.

### 3. `src/components/landing/FeaturesSection.tsx`
- **Slimme Financiën kaart (regel 71–77)**: 
  - `description` aanpassen: `…credit notes en Peppol e-invoicing voor B2B (coming soon).`
  - `badge` van `'Peppol 2026'` → `'Peppol Coming Soon'`.

### 4. `src/components/landing/ComparisonSection.tsx`
- **Regel 36**: `Peppol e-invoicing` row — voor SellQo waarde wijzigen van `true` → `'partial'` zodat het in de vergelijkingstabel als gedeeltelijk/in ontwikkeling toont (consistent met "coming soon"). Alternatief: featurelabel naar `'Peppol e-invoicing (Q1 2026)'` houden met `true`. **Voorstel**: `'partial'` met label `'Peppol e-invoicing (coming soon)'`.

### 5. `src/components/landing/FaqSection.tsx`
- **Regel 41 (FAQ-antwoord)**: zinsdeel `automatische Peppol e-invoicing voor zakelijke klanten` → `automatische Peppol e-invoicing voor zakelijke klanten (binnenkort beschikbaar)`.
- **Regel 65 (Peppol FAQ)**: antwoord aanpassen naar iets als: *"Vanaf 2026 is elektronische facturatie via Peppol verplicht voor alle B2B transacties in België. SellQo's Peppol-integratie is in ontwikkeling en wordt vóór de deadline gelanceerd, zodat jij op tijd compliant bent."*

### 6. `src/components/landing/TestimonialsSection.tsx`
- **Regel 14**: testimonial die expliciet "De Peppol integratie alleen al is goud waard" zegt — herformuleren of vervangen om misleidend pre-launch claim te vermijden. **Voorstel**: vervangen door een andere kwaliteit van het platform (bijv. AI Business Coach of Unified Inbox), of testimonial verwijderen.

## Buiten scope
- Admin-pagina's (`PeppolSettings.tsx`, `PeppolUpgradeCard.tsx`, billing) blijven ongewijzigd — gebruiker vroeg specifiek de **marketingpagina**.
- Vertaalbestanden (`i18n/locales/*.json`) bevatten geen landing-page Peppol-strings, dus geen wijzigingen daar nodig.

## Resultaat
Bezoekers van de landingspagina zien overal duidelijk dat Peppol "coming soon" is — geen verkeerde verwachting bij signup, juridisch veilig, en behoudt urgentie rond de 2026-deadline.