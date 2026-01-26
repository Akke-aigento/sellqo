
# Plan: "Launch in 5 Minuten" Onboarding Wizard

## Overzicht

Een interactieve, stapsgewijze wizard die nieuwe merchants direct na registratie begeleidt naar hun eerste succesmoment: een volledig operationele webshop. De wizard combineert gamification (progress bar, confetti) met contextuele hulp (info-tooltips, pijltjes) om een soepele onboarding-ervaring te creëren.

## Kernprincipes

1. **Snelheid boven compleetheid** - Focus op de essentials om LIVE te gaan
2. **Visuele begeleiding** - Pijltjes, highlights en tooltips wijzen de weg
3. **Contextuele hulp** - (i) iconen met uitgebreide uitleg bij elk veld
4. **Voortgang is motiverend** - Progress bar en stap-indicator altijd zichtbaar
5. **Viering van succes** - Confetti bij completion + "Je bent LIVE!" moment

## Wizard Stappen

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ☕ Je bent sneller klaar dan een kop koffie zetten!                       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Stap 2 van 6   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ① Welkom    ② Bedrijf    ③ Logo    ④ Product    ⑤ Betalingen    ⑥ Live!  │
│     ✓          ●                                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Stap 1: Welkom & Winkelnaam (30 sec)
Doel: Eerste tenant aanmaken, enthousiasme opbouwen

**Velden:**
- Winkelnaam (verplicht)
- Winkel URL/slug (auto-generated)

**Info tooltips:**
- "Je winkelnaam verschijnt op facturen, e-mails en in je webshop header"
- "De URL is waar klanten je webshop bezoeken: sellqo.app/shop/jouw-winkel"

### Stap 2: Bedrijfsgegevens (2 min)
Doel: Minimale gegevens voor facturatie en compliance

**Velden:**
- Bedrijfsnaam / Eigenaar naam
- E-mailadres (pre-filled van account)
- Adres, Postcode, Stad
- Land (dropdown EU-landen)
- BTW-nummer (optioneel voor starters)
- KvK/KBO-nummer (optioneel)

**Info tooltips:**
- "Adresgegevens zijn verplicht op facturen volgens EU-wetgeving"
- "BTW-nummer: Vind je op je KvK-uittreksel of belastingaangifte"
- "Geen BTW-nummer? Geen probleem - je kunt dit later toevoegen"

### Stap 3: Logo Upload (30 sec)
Doel: Visuele identiteit

**Elementen:**
- Drag & drop zone met preview
- "Skip voor nu" optie (met placeholder logo)
- Aanbevolen formaat indicator

**Info tooltips:**
- "Je logo verschijnt op e-mails, facturen en je webshop"
- "Aanbevolen: 200x200px, PNG of JPG met transparante achtergrond"

### Stap 4: Eerste Product (1.5 min)
Doel: Productcatalogus starten met 1 item

**Velden:**
- Productnaam
- Prijs
- Korte beschrijving (optioneel)
- Productafbeelding (drag & drop)

**Info tooltips:**
- "Begin met je bestverkopende product"
- "Je kunt later eenvoudig meer producten toevoegen of importeren"
- "Geen afbeelding? Geen probleem - we tonen een placeholder"

**Visueel:**
- Live preview van hoe het product er uit zal zien in de webshop

### Stap 5: Betalingen Activeren (2 min)
Doel: Stripe Connect koppelen

**Flow:**
1. Land selecteren (pre-filled uit stap 2)
2. "Betalingen activeren" knop → Stripe onboarding popup
3. Wachten op terugkeer met success status
4. Of: "Later instellen" optie (shop werkt dan alleen met bankoverschrijving)

**Info tooltips:**
- "Via Stripe ontvang je betalingen via iDEAL, Bancontact, creditcard"
- "Stripe uitbetalingen komen automatisch op je bankrekening"
- "Geen Stripe? Klanten kunnen ook via bankoverschrijving betalen"

### Stap 6: LIVE! (Celebratie)
Doel: Succes vieren, volgende stappen tonen

**Elementen:**
- Confetti animatie
- "Je webshop is LIVE!" boodschap
- Direct link naar webshop
- Checklist met optionele vervolgstappen:
  - [ ] Meer producten toevoegen
  - [ ] Verzendmethoden instellen
  - [ ] Juridische pagina's aanmaken
  - [ ] Theme aanpassen

## Technische Architectuur

### Nieuwe Database Kolommen

```sql
-- profiles tabel uitbreiding
ALTER TABLE profiles
ADD COLUMN onboarding_completed BOOLEAN DEFAULT false,
ADD COLUMN onboarding_step INTEGER DEFAULT 0,
ADD COLUMN onboarding_skipped_at TIMESTAMPTZ DEFAULT NULL;
```

### Nieuwe Componenten

```text
src/components/onboarding/
├── OnboardingWizard.tsx          # Hoofdcontainer met state management
├── OnboardingProgress.tsx        # Progress bar + stap indicator
├── OnboardingTooltip.tsx         # (i) icoon met uitleg popover
├── OnboardingOverlay.tsx         # Volledige scherm overlay voor wizard
├── steps/
│   ├── WelcomeStep.tsx           # Stap 1: Winkelnaam
│   ├── BusinessDetailsStep.tsx   # Stap 2: Bedrijfsgegevens
│   ├── LogoUploadStep.tsx        # Stap 3: Logo
│   ├── FirstProductStep.tsx      # Stap 4: Eerste product
│   ├── PaymentsStep.tsx          # Stap 5: Stripe Connect
│   └── LaunchStep.tsx            # Stap 6: Celebratie
└── CelebrationConfetti.tsx       # Confetti animatie component
```

### State Management

```typescript
interface OnboardingState {
  currentStep: number;
  totalSteps: 6;
  stepsCompleted: boolean[];
  tenantData: {
    name?: string;
    slug?: string;
    address?: string;
    // etc.
  };
  productData: {
    name?: string;
    price?: number;
    // etc.
  };
  stripeConnected: boolean;
  canSkipToEnd: boolean;
}
```

### Trigger Logica

```typescript
// In AdminLayout.tsx of Dashboard.tsx
const { user } = useAuth();
const { currentTenant } = useTenant();

// Detecteer nieuwe gebruikers
const shouldShowOnboarding = useMemo(() => {
  if (!user) return false;
  if (profile?.onboarding_completed) return false;
  if (profile?.onboarding_skipped_at) return false;
  if (!currentTenant) return true; // Geen tenant = nieuwe gebruiker
  return !currentTenant.stripe_onboarding_complete && 
         (!products || products.length === 0);
}, [user, profile, currentTenant, products]);
```

### Confetti Implementatie

Gebruik `canvas-confetti` library (lightweight, geen React dependencies):

```typescript
import confetti from 'canvas-confetti';

const celebrateCompletion = () => {
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 }
  });
};
```

## UI/UX Ontwerp

### Progress Bar Component

```text
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│  Stap 3 van 6                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ ██████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
│   ①──────②──────③──────④──────⑤──────⑥                           │
│   ✓       ✓       ●                                               │
│  Welkom  Bedrijf  Logo   Product  Betaling  Live                  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Info Tooltip Component

```text
┌─────────────────────────────────────────────┐
│                                             │
│  BTW-nummer                                 │
│  ┌─────────────────────────────────────┐   │
│  │ NL123456789B01                  ⓘ   │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────────┐
│  │ ⓘ BTW-nummer                            │
│  │                                          │
│  │ Je BTW-nummer vind je op:               │
│  │ • Je KvK-uittreksel                     │
│  │ • Je belastingaangifte                  │
│  │ • Mijn Belastingdienst portaal          │
│  │                                          │
│  │ Formaat: NL + 9 cijfers + B + 2 cijfers │
│  │ Voorbeeld: NL123456789B01               │
│  │                                          │
│  │ Nog geen BTW-nummer? Geen probleem!     │
│  │ Je kunt dit later toevoegen.            │
│  └─────────────────────────────────────────┘
│                                             │
└─────────────────────────────────────────────┘
```

### Step Card Layout

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│           ☕ Je bent sneller klaar dan een kop koffie zetten!              │
│                                                                             │
│           [Progress Bar: ██████████████░░░░░░░░░░░ 50%]                    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                     │   │
│  │    📦  Voeg je eerste product toe                                  │   │
│  │                                                                     │   │
│  │    Begin met je populairste product. Je kunt later                 │   │
│  │    eenvoudig meer producten toevoegen.                             │   │
│  │                                                                     │   │
│  │    ┌─────────────────────────────────────────────────────────┐     │   │
│  │    │                                                         │     │   │
│  │    │  Productnaam *                                     ⓘ   │     │   │
│  │    │  ┌──────────────────────────────────────────────────┐  │     │   │
│  │    │  │ Handgemaakte kaars - Vanille                     │  │     │   │
│  │    │  └──────────────────────────────────────────────────┘  │     │   │
│  │    │                                                         │     │   │
│  │    │  Prijs *                                           ⓘ   │     │   │
│  │    │  ┌────────────────┐                                    │     │   │
│  │    │  │ € 24.95        │                                    │     │   │
│  │    │  └────────────────┘                                    │     │   │
│  │    │                                                         │     │   │
│  │    │  Productafbeelding                                 ⓘ   │     │   │
│  │    │  ┌──────────────────────────────────────────────────┐  │     │   │
│  │    │  │                                                  │  │     │   │
│  │    │  │     📷 Sleep afbeelding hierheen                 │  │     │   │
│  │    │  │        of klik om te uploaden                    │  │     │   │
│  │    │  │                                                  │  │     │   │
│  │    │  └──────────────────────────────────────────────────┘  │     │   │
│  │    │                                                         │     │   │
│  │    └─────────────────────────────────────────────────────────┘     │   │
│  │                                                                     │   │
│  │    ┌─────────────┐      ┌─────────────────────────────────────┐    │   │
│  │    │ ← Vorige    │      │                   Volgende stap →   │    │   │
│  │    └─────────────┘      └─────────────────────────────────────┘    │   │
│  │                                                                     │   │
│  │                   Overslaan voor nu                                │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Live Celebration Screen

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                          🎉  🎊  🎉  🎊  🎉                                 │
│                                                                             │
│                    ┌──────────────────────────┐                            │
│                    │                          │                            │
│                    │     🚀                   │                            │
│                    │                          │                            │
│                    └──────────────────────────┘                            │
│                                                                             │
│                     Je webshop is LIVE!                                    │
│                                                                             │
│        Gefeliciteerd! Je bent nu klaar om je eerste orders                 │
│        te ontvangen. Deel je winkel met de wereld!                         │
│                                                                             │
│        ┌──────────────────────────────────────────────────────┐            │
│        │ 🔗 sellqo.app/shop/jouw-winkel           [Kopiëren]  │            │
│        └──────────────────────────────────────────────────────┘            │
│                                                                             │
│                   ┌───────────────────────────────┐                        │
│                   │  Bekijk je webshop →          │                        │
│                   └───────────────────────────────┘                        │
│                                                                             │
│        ────────────────────────────────────────────────────                │
│                                                                             │
│        💡 Volgende stappen (optioneel):                                    │
│                                                                             │
│        ☐ Meer producten toevoegen                                          │
│        ☐ Verzendmethoden instellen                                         │
│        ☐ Theme en kleuren aanpassen                                        │
│        ☐ Juridische pagina's genereren                                     │
│                                                                             │
│                   ┌───────────────────────────────┐                        │
│                   │  Ga naar Dashboard            │                        │
│                   └───────────────────────────────┘                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Bestandsoverzicht

| Bestand | Actie | Beschrijving |
|---------|-------|--------------|
| `src/components/onboarding/OnboardingWizard.tsx` | Nieuw | Hoofdcomponent met wizard state |
| `src/components/onboarding/OnboardingProgress.tsx` | Nieuw | Progress bar + step indicator |
| `src/components/onboarding/OnboardingTooltip.tsx` | Nieuw | Info (i) tooltip component |
| `src/components/onboarding/OnboardingOverlay.tsx` | Nieuw | Full-screen overlay wrapper |
| `src/components/onboarding/steps/WelcomeStep.tsx` | Nieuw | Stap 1: Winkelnaam |
| `src/components/onboarding/steps/BusinessDetailsStep.tsx` | Nieuw | Stap 2: Bedrijfsgegevens |
| `src/components/onboarding/steps/LogoUploadStep.tsx` | Nieuw | Stap 3: Logo upload |
| `src/components/onboarding/steps/FirstProductStep.tsx` | Nieuw | Stap 4: Eerste product |
| `src/components/onboarding/steps/PaymentsStep.tsx` | Nieuw | Stap 5: Stripe Connect |
| `src/components/onboarding/steps/LaunchStep.tsx` | Nieuw | Stap 6: Celebratie |
| `src/components/onboarding/CelebrationConfetti.tsx` | Nieuw | Confetti animatie |
| `src/hooks/useOnboarding.ts` | Nieuw | Onboarding state & persistence |
| `src/pages/admin/Dashboard.tsx` | Update | Trigger voor wizard weergave |
| `src/components/admin/AdminLayout.tsx` | Update | Onboarding overlay integratie |
| Database migration | Nieuw | profiles tabel kolommen |

## Dependency

Nieuwe npm package nodig:

```bash
npm install canvas-confetti
npm install @types/canvas-confetti --save-dev
```

## Implementatie Volgorde

1. **Database migratie** - Voeg onboarding kolommen toe aan profiles
2. **useOnboarding hook** - State management & persistence
3. **OnboardingProgress** - Progress bar component
4. **OnboardingTooltip** - Info tooltip component  
5. **Stap componenten** - Alle 6 stappen
6. **OnboardingWizard** - Hoofdcontainer die alles combineert
7. **Confetti** - Celebratie animatie
8. **Dashboard integratie** - Trigger logica voor nieuwe gebruikers
9. **Testing & polish** - Edge cases en responsiveness

## Resultaat

Na implementatie:
- Nieuwe merchants doorlopen een gestructureerde setup in ~5 minuten
- Elke stap heeft contextuele hulp via (i) tooltips
- Voortgang is altijd zichtbaar en motiverend
- Bij afronding: confetti + directe link naar hun webshop
- Optionele stappen kunnen worden overgeslagen
- Wizard status wordt opgeslagen en hervat bij terugkeer
