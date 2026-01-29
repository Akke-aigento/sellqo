
# Implementatieplan: Scroll-to-Top en Productstap Overslaan

## Overzicht
Dit plan implementeert twee UX-verbeteringen:
1. **Scroll-to-top bij navigatie** - Zorgt dat de pagina altijd bovenaan begint bij het navigeren
2. **Product stap overslaanbaar maken** - Net als de Logo en Payments stappen, kan de Product stap ook worden overgeslagen

---

## Deel 1: Scroll-to-Top Component

### Probleem
Bij navigatie tussen pagina's (admin, marketing, onboarding) behoudt de browser de huidige scrollpositie. Dit zorgt ervoor dat gebruikers midden op een pagina terechtkomen in plaats van bovenaan.

### Oplossing
Een `ScrollToTop` component maken die automatisch naar boven scrollt bij elke route-wijziging.

### Wijzigingen

**Nieuw bestand: `src/components/ScrollToTop.tsx`**
```typescript
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Component that scrolls to the top of the page on route change.
 * Should be placed inside BrowserRouter.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
```

**Wijziging in `src/App.tsx`**
De `ScrollToTop` component toevoegen direct na de `BrowserRouter` opening tag:

```typescript
import { ScrollToTop } from '@/components/ScrollToTop';

// In de return:
<BrowserRouter>
  <ScrollToTop />
  <Routes>
    {/* ... bestaande routes */}
  </Routes>
</BrowserRouter>
```

---

## Deel 2: Product Stap Overslaanbaar Maken

### Probleem
De productstap (stap 5) vereist nu dat gebruikers een productnaam en prijs invullen voordat ze verder kunnen. De Logo-stap en Payments-stap zijn al wel overslaanbaar.

### Huidige situatie
In `FirstProductStep.tsx` (lijn 75):
```typescript
const canContinue = data.productName.trim().length >= 2 && data.productPrice > 0;
```

### Oplossing
De button-tekst en `canContinue` logica aanpassen zodat:
- De stap altijd kan worden overgeslagen (net als Logo en Payments)
- Als er wel productdata is ingevuld, wordt het product aangemaakt
- De button-tekst verandert van "Volgende stap" naar "Overslaan voor nu" als er geen product is ingevuld

### Wijzigingen

**Bestand: `src/components/onboarding/steps/FirstProductStep.tsx`**

1. **Verwijder de `canContinue` validatie als blocker** (lijn 75-82):
```typescript
// Bepaal of product data is ingevuld (voor button tekst en API call)
const hasProductData = data.productName.trim().length >= 2 && data.productPrice > 0;

const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  onNext(); // Altijd doorgaan, ongeacht productdata
};
```

2. **Wijzig de submit button** (lijn 252-268):
```typescript
<Button
  type="submit"
  className="flex-1"
  disabled={isLoading}
>
  {isLoading ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Bezig...
    </>
  ) : hasProductData ? (
    <>
      Volgende stap
      <ArrowRight className="ml-2 h-4 w-4" />
    </>
  ) : (
    <>
      Overslaan voor nu
      <ArrowRight className="ml-2 h-4 w-4" />
    </>
  )}
</Button>
```

**Bestand: `src/components/onboarding/OnboardingWizard.tsx`**

3. **Wijzig de handleStepTransition voor stap 5** (lijn 96-105):
```typescript
case 5:
  // After product step, create the product ONLY if data is filled in
  if (data.productName?.trim() && data.productPrice > 0) {
    await createFirstProduct();
    toast({
      title: 'Product toegevoegd!',
      description: `${data.productName} is toegevoegd aan je catalogus.`,
    });
  }
  // Geen error als product leeg is - stap is optioneel
  break;
```

---

## Samenvatting Wijzigingen

| Bestand | Type | Beschrijving |
|---------|------|--------------|
| `src/components/ScrollToTop.tsx` | Nieuw | Component voor scroll-to-top bij navigatie |
| `src/App.tsx` | Wijziging | ScrollToTop component toevoegen |
| `src/components/onboarding/steps/FirstProductStep.tsx` | Wijziging | Product stap overslaanbaar maken |
| `src/components/onboarding/OnboardingWizard.tsx` | Wijziging | Optionele product creatie logica |

---

## Technische Details

### Waarom een aparte ScrollToTop component?
- React Router v6 heeft geen ingebouwde scroll restoration
- Deze aanpak is standaard en werkt betrouwbaar
- Het component is herbruikbaar en eenvoudig te testen

### Waarom de product stap niet verplicht maken?
- Consistent met Logo en Payments stappen (ook optioneel)
- Vermindert wrijving in de onboarding flow
- Gebruikers kunnen later altijd producten toevoegen
- De screenshot toont dat dit de verwachte UX is
