
# Onboarding Reset Bug Fix

## Probleem
Wanneer een gebruiker halverwege de onboarding stopt en later terugkomt (via "Gratis proberen" of "Inloggen"), wordt hij direct in het midden van de oude flow geplaatst (bijv. stap 3 van 7). Dit is verwarrend en biedt geen optie om opnieuw te beginnen.

## Oorzaak
- De `onboarding_step` wordt opgeslagen in de database per gebruiker
- Bij terugkomst herstelt `useOnboarding` de oude stap
- Er is geen UI-element om de onboarding te resetten
- De bestaande `restartOnboarding()` functie wordt nergens aangeroepen

## Oplossing
Wanneer een gebruiker terugkeert naar een onvoltooide onboarding (stap > 1), toon een welkomstscherm met keuze:
1. **"Verder waar ik was"** → Hervat op opgeslagen stap
2. **"Opnieuw beginnen"** → Reset naar stap 1

---

## Technische Details

### Bestand: `src/components/onboarding/OnboardingWizard.tsx`
**Wijzigingen:**
- Nieuwe state toevoegen: `showResumeDialog` 
- Bij eerste render checken of `currentStep > 1` en gebruiker nog niet gekozen heeft
- Dialog component toevoegen met twee keuzes:
  - "Verder gaan" → sluit dialog, ga door met huidige stap
  - "Opnieuw beginnen" → call `restartOnboarding()`, reset state

### Bestand: `src/hooks/useOnboarding.ts`
**Wijzigingen:**
- Extra return value `hasPartialProgress: boolean` toevoegen
- Dit wordt `true` als `onboarding_step > 1` bij het laden

### Nieuwe Component: `src/components/onboarding/ResumeOnboardingDialog.tsx`
**Functionaliteit:**
- Welkomstbericht: "We zien dat je al begonnen was met het instellen van je winkel"
- Twee knoppen:
  - "Verder waar ik was (Stap X van 7)"
  - "Opnieuw beginnen"
- Styling consistent met de rest van de wizard

---

## Verwacht Gedrag Na Fix
1. **Nieuwe gebruiker** → Start bij stap 1 (geen dialog)
2. **Terugkerende gebruiker met incomplete onboarding** → Ziet keuze-dialog
3. **Terugkerende gebruiker kiest "Verder"** → Gaat naar opgeslagen stap
4. **Terugkerende gebruiker kiest "Opnieuw beginnen"** → Reset naar stap 1, alle data wordt gewist
5. **Gebruiker met voltooide onboarding** → Ziet geen wizard (huidige gedrag)

---

## Stappenplan Implementatie
1. Update `useOnboarding.ts` met `hasPartialProgress` indicator
2. Maak nieuwe `ResumeOnboardingDialog.tsx` component
3. Update `OnboardingWizard.tsx` om dialog te tonen bij partial progress
4. Test de flow end-to-end op zowel Preview als Live
