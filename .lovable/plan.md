

# Plan: Onboarding Wizard Hervatten & Herstarten

## Overzicht

Uitbreiding van de onboarding wizard met mogelijkheden om:
1. De wizard te hervatten waar je gebleven was (na overslaan)
2. De wizard volledig opnieuw te starten (reset)

## Huidige Situatie

De wizard heeft al:
- "Overslaan" knop met bevestigingsdialoog
- Voortgang opslaan per stap (`onboarding_step` in profiles)
- Automatisch hervatten bij terugkeer

Wat ontbreekt:
- Optie in instellingen om overgeslagen wizard te hervatten
- Optie om de wizard volledig te resetten (opnieuw beginnen)

## Nieuwe Functionaliteit

### 1. Onboarding Card in Account Settings

Een nieuwe sectie in `AccountSettings.tsx` die toont:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  🚀  Setup Wizard                                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Status: Overgeslagen op stap 3 van 6                                       │
│                                                                             │
│  Je hebt de setup wizard eerder overgeslagen. Je kunt deze                 │
│  op elk moment hervatten of opnieuw beginnen.                              │
│                                                                             │
│  ┌─────────────────────┐    ┌──────────────────────────┐                   │
│  │ ▶ Wizard hervatten  │    │ ↺ Opnieuw beginnen       │                   │
│  └─────────────────────┘    └──────────────────────────┘                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

Of als de wizard al voltooid is:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  ✅  Setup Wizard                                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Status: Voltooid                                                          │
│                                                                             │
│  Je hebt de setup wizard succesvol afgerond!                               │
│  Je kunt deze opnieuw doorlopen als je wilt.                               │
│                                                                             │
│                        ┌──────────────────────────┐                        │
│                        │ ↺ Opnieuw beginnen       │                        │
│                        └──────────────────────────┘                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2. Nieuwe Hook Functies

Uitbreiding van `useOnboarding.ts`:

```typescript
// Herstart de wizard (reset naar stap 1)
const restartOnboarding = useCallback(async () => {
  if (user) {
    await supabase
      .from('profiles')
      .update({ 
        onboarding_completed: false,
        onboarding_step: 1,
        onboarding_skipped_at: null,
      })
      .eq('id', user.id);
  }
  
  setState(prev => ({ 
    ...prev, 
    currentStep: 1, 
    isOpen: true,
    data: initialData, // Reset alle data
  }));
}, [user]);

// Hervat de wizard waar je gebleven was
const resumeOnboarding = useCallback(async () => {
  if (user) {
    await supabase
      .from('profiles')
      .update({ onboarding_skipped_at: null })
      .eq('id', user.id);
  }
  
  // isOpen wordt true, currentStep behoudt de opgeslagen waarde
  setState(prev => ({ ...prev, isOpen: true }));
}, [user]);
```

### 3. Onboarding Status Hook

Een aparte hook voor het ophalen van de onboarding status (voor gebruik in settings):

```typescript
// Nieuwe functie in useOnboarding
const getOnboardingStatus = useCallback(async () => {
  if (!user) return null;
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed, onboarding_step, onboarding_skipped_at')
    .eq('id', user.id)
    .single();
    
  return {
    isCompleted: profile?.onboarding_completed || false,
    wasSkipped: !!profile?.onboarding_skipped_at,
    currentStep: profile?.onboarding_step || 1,
    skippedAt: profile?.onboarding_skipped_at,
  };
}, [user]);
```

## Bestandswijzigingen

| Bestand | Actie | Beschrijving |
|---------|-------|--------------|
| `src/hooks/useOnboarding.ts` | Update | Voeg `restartOnboarding`, `resumeOnboarding` toe |
| `src/components/admin/settings/AccountSettings.tsx` | Update | Voeg Onboarding Status Card toe |
| `src/components/onboarding/OnboardingStatusCard.tsx` | Nieuw | Standalone component voor settings |

## UI/UX Details

### Hervatten vs Opnieuw Beginnen

- **Hervatten**: Verwijdert `onboarding_skipped_at`, wizard gaat verder waar je was
- **Opnieuw beginnen**: Reset `onboarding_step` naar 1, verwijdert skip/completed status, begint bij stap 1

### Bevestigingsdialoog voor "Opnieuw beginnen"

```text
┌──────────────────────────────────────────────────────────────────┐
│  Wizard opnieuw starten?                                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Je gaat de setup wizard opnieuw doorlopen vanaf het begin.     │
│  Je bestaande winkel en producten blijven behouden.             │
│                                                                  │
│             ┌─────────────┐    ┌──────────────────────┐         │
│             │  Annuleren  │    │  Ja, opnieuw starten │         │
│             └─────────────┘    └──────────────────────┘         │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Implementatie Flow

1. **Update `useOnboarding.ts`**
   - Voeg `restartOnboarding` functie toe
   - Voeg `resumeOnboarding` functie toe
   - Voeg status ophalen functie toe
   - Export nieuwe functies

2. **Maak `OnboardingStatusCard.tsx`**
   - Haal onboarding status op
   - Toon juiste UI op basis van status
   - Knoppen voor hervatten/herstarten
   - Bevestigingsdialoog voor reset

3. **Update `AccountSettings.tsx`**
   - Import OnboardingStatusCard
   - Voeg toe na de profile card

## Resultaat

Na implementatie kunnen gebruikers:
- De wizard op elk moment hervatten vanuit instellingen
- De wizard volledig opnieuw doorlopen als ze willen
- Duidelijk zien wat hun huidige onboarding status is
- Zonder zorgen de wizard wegklikken (weten dat ze terug kunnen)

