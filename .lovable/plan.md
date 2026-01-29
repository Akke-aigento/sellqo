
# Fix: "Welkom terug!" Dialog Verschijnt Direct na Tenant Creatie

## Probleem Diagnose

### Wat er gebeurt (uit de console logs):
1. Stap 3 voltooid → `createTenant()` succesvol
2. Toast verschijnt: "Winkel aangemaakt!"
3. `refreshTenants()` wordt aangeroepen
4. Dit triggert de `useEffect` dependency `tenants`
5. `checkOnboardingStatus()` draait opnieuw
6. De functie leest `onboarding_step: 4` uit database
7. `partialProgress = true` (want step > 1 en niet een nieuwe gebruiker)
8. `hasPartialProgress` wordt `true` → Dialog verschijnt!

### Root cause:
De `checkOnboardingStatus` functie maakt geen onderscheid tussen:
- Een **terugkerende gebruiker** die de app opnieuw opent na onderbreking
- Een **actieve sessie** die gewoon door de wizard aan het gaan is

Elke keer dat de `tenants` of `tenantsLoading` state verandert, wordt de check opnieuw uitgevoerd en reset het de "partial progress" flag.

## Oplossing

We moeten de `hasPartialProgress` flag alleen zetten bij de **initiële load**, niet bij elke re-check. Dit kan door een "already checked" vlag te introduceren.

### Aanpak:
1. Voeg een `hasInitiallyChecked` ref toe die bijhoudt of we al een keer gecheckt hebben
2. Zet `hasPartialProgress` alleen als `hasInitiallyChecked.current === false`
3. Na de eerste check: `hasInitiallyChecked.current = true`

Dit zorgt ervoor dat de resume dialog alleen verschijnt bij de allereerste load van de wizard, niet bij re-renders door tenant refresh of andere state changes.

## Technische Wijzigingen

### Bestand: `src/hooks/useOnboarding.ts`

**1. Voeg een ref toe om initial check te tracken:**
```typescript
const hasInitiallyChecked = useRef(false);
```

**2. Update `checkOnboardingStatus` om partial progress alleen bij eerste check te zetten:**
```typescript
// Track if returning user has partial progress (not brand new, step > 1)
// ONLY set this on initial load, not on subsequent re-checks
if (!hasInitiallyChecked.current) {
  const partialProgress = !isNewUser && savedStep > 1;
  setHasPartialProgress(partialProgress);
  hasInitiallyChecked.current = true;
}
```

**3. Reset de ref bij logout/restart (optioneel):**
Bij `restartOnboarding` kunnen we de ref resetten als de gebruiker expliciet opnieuw begint.

## Verwacht Resultaat

| Scenario | Huidig Gedrag | Nieuw Gedrag |
|----------|---------------|--------------|
| Pagina refresh bij stap 3 | Dialog verschijnt ✓ | Dialog verschijnt ✓ |
| Tenant aangemaakt → stap 4 | Dialog verschijnt ✗ | Geen dialog, doorgaan naar stap 4 ✓ |
| Terugkeren na browser sluiten | Dialog verschijnt ✓ | Dialog verschijnt ✓ |

## Bestanden die worden aangepast

| Bestand | Wijziging |
|---------|-----------|
| `src/hooks/useOnboarding.ts` | - Voeg `hasInitiallyChecked` useRef toe<br>- Zet `hasPartialProgress` alleen bij eerste check |
