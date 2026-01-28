
# Fix: Onboarding Resume Data Loss

## Probleem Analyse

Het probleem is **niet** RLS - het is **data verlies bij hervatten van onboarding**.

### Wat er gebeurt:
1. Gebruiker start onboarding, vult shopName/shopSlug in (stap 1)
2. Gebruiker gaat verder, maar sluit browser ergens bij stap 3
3. Bij terugkeer: `onboarding_step: 3` wordt geladen uit database
4. Wizard toont "Verder waar ik was (Stap 3 van 7)"
5. Gebruiker klikt → stap 3 = BusinessDetailsStep
6. Na invullen klikt gebruiker "Volgende"
7. `createTenant()` wordt aangeroepen
8. **MAAR: `shopName = ''` en `shopSlug = ''`** want die zijn nooit opgeslagen!
9. Backend function: "Missing name or slug" → 400 error

### Bewijs uit screenshot:
```
Error: create-tenant function failed (400): {"error":"Missing name or slug"}
```

Dit is géén auth/RLS probleem - de data is simpelweg leeg.

## Oplossing

### Aanpak 1: Persist onboarding data naar database (robuust)

Nieuwe kolom `onboarding_data` (JSONB) in `profiles` tabel die de wizard state opslaat:

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_data JSONB DEFAULT '{}';
```

Bij elke `updateData()` call → ook opslaan naar database.
Bij laden → data herstellen uit database.

### Aanpak 2: Validatie + forced restart (snelle fix)

Bij `createTenant()`:
- Check of `shopName` en `shopSlug` gevuld zijn
- Zo niet: forceer terug naar stap 1 met duidelijke melding

### Aanpak 3: Combinatie (aanbevolen)

1. **Korte termijn**: Validatie in `createTenant()` - als shopName/shopSlug leeg zijn, toon melding en forceer terug naar stap 1
2. **Lange termijn**: Persist data naar database

## Implementatie (Aanpak 3)

### Stap 1: Database migratie

Voeg `onboarding_data` kolom toe aan `profiles`:

```sql
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_data JSONB DEFAULT '{}';
```

### Stap 2: Update useOnboarding.ts

**Bij `checkOnboardingStatus`:**
- Lees `onboarding_data` uit profile
- Herstel `state.data` met de opgeslagen waarden

**Bij `updateData`:**
- Sla de hele `data` object op naar `profiles.onboarding_data`
- Debounce om te veel writes te voorkomen

**Bij `createTenant`:**
- Valideer dat `shopName` en `shopSlug` niet leeg zijn
- Als leeg: gooi duidelijke error en toon melding om terug te gaan naar stap 1

### Stap 3: Update OnboardingWizard.tsx

**In ResumeOnboardingDialog logic:**
- Als kritieke data ontbreekt (shopName/shopSlug), toon "Je vorige sessie kon niet worden hersteld, begin opnieuw"
- Forceer dan stap 1

## Bestanden die worden aangepast

| Bestand | Wijziging |
|---------|-----------|
| Database migratie | `onboarding_data JSONB` kolom toevoegen |
| `src/hooks/useOnboarding.ts` | - Laad data uit `onboarding_data` bij init<br>- Sla data op bij `updateData`<br>- Valideer vereiste velden in `createTenant` |
| `src/components/onboarding/OnboardingWizard.tsx` | Detecteer ontbrekende data en forceer restart |
| `src/components/onboarding/ResumeOnboardingDialog.tsx` | Toon melding als data niet kan worden hersteld |

## Verwacht Resultaat

1. **Nieuw gedrag bij hervatten:**
   - Als `shopName`/`shopSlug` opgeslagen zijn → hervat normaal
   - Als deze ontbreken → melding + automatisch naar stap 1

2. **Nieuw gedrag bij invullen:**
   - Data wordt real-time opgeslagen in database
   - Bij volgende sessie: data is er nog

3. **Foutafhandeling:**
   - `createTenant()` valideert input voordat er iets naar de server gaat
   - Duidelijke foutmelding: "Vul eerst je winkelnaam in"
