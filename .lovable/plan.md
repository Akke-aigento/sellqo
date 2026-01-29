
# Grondige Herziening Onboarding Flow

## Probleem Analyse

Er zijn meerdere structurele problemen die samen tot deze foutenstroom leiden:

### 1. Slug-Validatie Timing
De slug "vanxcel" wordt alleen gecontroleerd in **Stap 1** (WelcomeStep). Maar:
- Bij hervatten kan de gebruiker stap 1 overslaan
- De opgeslagen slug kan intussen door iemand anders zijn geclaimd
- Er is geen tweede check vóór tenant creatie

### 2. Owner Email Mismatch
De bestaande tenant "vanxcel" is gekoppeld aan:
```
owner_email: info@outlook.com
```

De ingelogde gebruiker is:
```
email: info@vanxcel.com
```

De `create-tenant` function zoekt naar bestaande tenant op `owner_email = info@vanxcel.com`, vindt niets, en probeert een nieuwe aan te maken met dezelfde slug → conflict.

### 3. Geen Slug-Conflict Afhandeling
De backend function gooit simpelweg een 500 error bij duplicate slug, zonder de mogelijkheid om:
- Een alternatieve slug voor te stellen
- De gebruiker te informeren wat er mis is
- Graceful recovery te bieden

## Oplossing: Robuuste Slug-Afhandeling

### Architectuur Wijzigingen

```text
┌─────────────────────────────────────────────────────────────────┐
│                    TENANT CREATION FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Stap 1: Welkom]                                               │
│       ↓                                                         │
│  checkSlugAvailable() → toon ✓ of ✗                            │
│       ↓                                                         │
│  [Stap 2-3: Plan + Gegevens]                                    │
│       ↓                                                         │
│  [Stap 3 → createTenant]                                        │
│       ↓                                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ PRE-FLIGHT CHECKS (nieuw)                               │   │
│  │ 1. Valideer sessie                                       │   │
│  │ 2. Check of slug nog beschikbaar is                      │   │
│  │ 3. Indien niet: toon SlugConflictDialog                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│       ↓                                                         │
│  [Backend: create-tenant]                                       │
│  - Genereer unieke slug indien conflict                         │
│  - Retourneer suggestie in response                             │
│       ↓                                                         │
│  [Succes of Conflict Dialog]                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Technische Wijzigingen

#### 1. Backend: Auto-Slug Resolutie in `create-tenant` Edge Function

```typescript
// Nieuwe functie: findAvailableSlug
async function findAvailableSlug(supabase, baseSlug: string): Promise<string> {
  // Check of baseslug vrij is
  const { data: existing } = await supabase
    .from("tenants")
    .select("slug")
    .eq("slug", baseSlug)
    .limit(1);
  
  if (!existing || existing.length === 0) {
    return baseSlug; // Vrij!
  }
  
  // Probeer varianten: slug-2, slug-3, etc.
  for (let i = 2; i <= 10; i++) {
    const candidate = `${baseSlug}-${i}`;
    const { data: check } = await supabase
      .from("tenants")
      .select("slug")
      .eq("slug", candidate)
      .limit(1);
    if (!check || check.length === 0) {
      return candidate;
    }
  }
  
  // Fallback: slug + random suffix
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return `${baseSlug}-${randomSuffix}`;
}
```

Bij duplicate key:
- Detecteer de fout
- Genereer een beschikbare slug
- **Retourneer dit als voorstel** (status 409 Conflict)

#### 2. Frontend: SlugConflictDialog Component

Nieuw component: `src/components/onboarding/SlugConflictDialog.tsx`

```typescript
interface SlugConflictDialogProps {
  open: boolean;
  originalSlug: string;
  suggestedSlug: string;
  onAccept: (newSlug: string) => void;
  onGoToStep1: () => void;
}
```

Toont:
- "De URL 'vanxcel' is helaas al in gebruik."
- "We stellen voor: **vanxcel-2**"
- [Accepteer] [Zelf kiezen]

#### 3. Frontend: Pre-flight Slug Check in `createTenant`

Vóór het aanroepen van de backend:
1. Check opnieuw of de slug beschikbaar is
2. Indien niet: toon SlugConflictDialog
3. Wacht op gebruikerskeuze voordat we verder gaan

```typescript
// In createTenant, vóór de API call:
const slugStillAvailable = await checkSlugAvailable(shopSlug);
if (!slugStillAvailable) {
  const suggestedSlug = await findAlternativeSlug(shopSlug);
  setState(prev => ({ 
    ...prev, 
    slugConflict: { 
      original: shopSlug, 
      suggested: suggestedSlug 
    } 
  }));
  return null; // Stop hier, wacht op dialog
}
```

#### 4. Data Integriteit: Valideer Opgeslagen Slug bij Resume

Bij hervatten vanuit `onboarding_data`:
1. Check of de opgeslagen shopName/shopSlug nog geldig zijn
2. Indien de slug niet meer beschikbaar is: markeer als "conflict"
3. Forceer terug naar stap 1 OF toon conflict dialog direct

### Bestanden die worden aangepast

| Bestand | Wijziging |
|---------|-----------|
| `supabase/functions/create-tenant/index.ts` | - `findAvailableSlug()` helper<br>- Bij duplicate key: return 409 met suggestie<br>- Verbeterde error response |
| `src/components/onboarding/SlugConflictDialog.tsx` | **NIEUW** - Dialog voor slug conflict afhandeling |
| `src/hooks/useOnboarding.ts` | - `slugConflict` state<br>- Pre-flight slug check in `createTenant`<br>- `findAlternativeSlug()` helper<br>- Slug validatie bij resume |
| `src/components/onboarding/OnboardingWizard.tsx` | - Render SlugConflictDialog<br>- Handler voor accept/reject |
| `src/components/onboarding/steps/WelcomeStep.tsx` | - Kleine UX verbetering: toon conflict state |

### Verwacht Gedrag na Implementatie

| Scenario | Gedrag |
|----------|--------|
| Nieuwe gebruiker, unieke slug | Normale flow, geen wijzigingen |
| Nieuwe gebruiker, slug in gebruik | Stap 1 toont "In gebruik", kan niet doorgaan |
| Hervattende gebruiker, slug nu in gebruik | Dialog: "vanxcel is nu bezet. Wil je vanxcel-2 gebruiken?" |
| Hervattende gebruiker, accepteert voorstel | Slug wordt bijgewerkt, tenant wordt aangemaakt |
| Hervattende gebruiker, wil zelf kiezen | Terug naar stap 1 om handmatig te wijzigen |
| Backend slug conflict (race condition) | 409 response met suggestie → frontend toont dialog |

### Flow Diagram bij Conflict

```text
                    ┌─────────────────┐
                    │ createTenant()  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Pre-flight check│
                    │ Slug available? │
                    └────────┬────────┘
                             │
            ┌────────────────┴────────────────┐
            │ JA                              │ NEE
            ▼                                 ▼
    ┌───────────────┐                ┌───────────────────┐
    │ Proceed to    │                │ Find alternative  │
    │ backend call  │                │ slug              │
    └───────┬───────┘                └─────────┬─────────┘
            │                                  │
            │                         ┌────────▼────────┐
            │                         │ Show Dialog:    │
            │                         │ "Use vanxcel-2?"│
            │                         └────────┬────────┘
            │                                  │
            │               ┌──────────────────┴──────────────────┐
            │               │ ACCEPT                              │ ZELF KIEZEN
            │               ▼                                     ▼
            │       ┌───────────────┐                    ┌─────────────────┐
            │       │ Update slug   │                    │ goToStep(1)     │
            │       │ in state      │                    │ Reset wizard    │
            │       └───────┬───────┘                    └─────────────────┘
            │               │
            └───────────────┼───────────────┐
                            ▼               │
                    ┌───────────────┐       │
                    │ Backend call  │◄──────┘
                    │ create-tenant │
                    └───────┬───────┘
                            │
                   ┌────────▼────────┐
                   │ Succes!         │
                   │ Naar stap 4     │
                   └─────────────────┘
```

### Veiligheidsoverwegingen

1. **Backend blijft authoritative**: De edge function doet altijd de finale check
2. **Race conditions**: Als twee gebruikers tegelijk dezelfde slug proberen, krijgt de tweede een 409 met suggestie
3. **Geen data verlies**: Bij conflict worden alle andere ingevulde gegevens behouden
4. **Duidelijke communicatie**: Gebruiker weet precies wat er gebeurt en heeft controle

### Samenvatting

Deze herziening pakt drie kernproblemen aan:
1. **Slug-validatie bij hervatten** → Pre-flight check + conflict dialog
2. **Graceful conflict handling** → 409 response met alternatief voorstel
3. **Gebruikerscontrole** → Accepteer voorstel of kies zelf

Dit voorkomt de huidige "duplicate key" 500 errors en geeft de gebruiker een duidelijke weg vooruit.
