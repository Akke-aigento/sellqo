
# Registratie & Onboarding Flow - Complete Herziening

## Huidige Situatie Analyse

### Wat werkt WEL:
| Component | Status | Locatie |
|-----------|--------|---------|
| Auth pagina (login/registratie) | ✅ Werkt | `src/pages/Auth.tsx` |
| Onboarding Wizard UI | ✅ Werkt | `src/components/onboarding/OnboardingWizard.tsx` |
| 6-stappen flow | ✅ Werkt | Welcome → Business → Logo → Product → Payments → Launch |
| Skip/Resume mogelijkheid | ✅ Werkt | Via `profiles.onboarding_skipped_at` |
| Profiles tabel tracking | ✅ Werkt | `onboarding_completed`, `onboarding_step` velden |

### Wat ONTBREEKT (kritieke problemen):

| Probleem | Impact | Prioriteit |
|----------|--------|------------|
| **Geen 14-dagen trial enforcement** | Gebruikers kunnen onbeperkt blijven gebruiken zonder te betalen | KRITIEK |
| **Geen tenant_subscription aangemaakt** | Nieuwe tenants hebben geen subscription record met trial_end datum | KRITIEK |
| **Geen plan selectie in onboarding** | Gebruikers kiezen geen plan tijdens registratie | HOOG |
| **Geen trial expiry check** | Geen blokkade na 14 dagen trial | HOOG |
| **Onboarding opent niet automatisch voor nieuwe users** | Wizard toont alleen als er geen tenants zijn, niet bij eerste login | MEDIUM |

### Database Status:
```text
┌─────────────────────────────────────────────────────────────────┐
│  HUIDIGE SITUATIE                                                │
├─────────────────────────────────────────────────────────────────┤
│  - tenants tabel: WEL aanwezig                                  │
│  - tenant_subscriptions: heeft trial_end kolom                  │
│  - pricing_plans: 4 plannen (Free, Starter €29, Pro €79, Ent)   │
│  - MAAR: geen trigger die subscription aanmaakt bij new tenant  │
│  - MAAR: geen check op trial_end bij toegang                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Oplossingsplan

### Fase 1: Database & Backend (Kritiek)

#### 1.1 Database Trigger voor Auto-Subscription
Bij aanmaken van nieuwe tenant automatisch een subscription record aanmaken met:
- `plan_id = 'free'`
- `status = 'trialing'`
- `trial_end = NOW() + 14 days`

Dit vereist een nieuwe database trigger.

#### 1.2 Subscription Status Check Hook
Nieuwe hook `useTrialStatus` die:
- Checkt of subscription status = 'trialing' en trial_end < NOW()
- Retourneert `isTrialExpired`, `daysRemaining`, `isBlocked`

---

### Fase 2: Frontend Flows (Hoog)

#### 2.1 Nieuwe Onboarding Stap: Plan Selectie
Toevoegen van een "Kies je plan" stap aan de onboarding wizard:
- Toon de 4 pricing plans
- Default selectie op "Free" (14 dagen trial)
- Optioneel direct upgraden naar betaald plan
- Bij keuze: subscription record updaten met gekozen plan

**Nieuwe stap flow:**
```text
1. Welcome (winkelnaam)
2. Plan Selectie ← NIEUW
3. Business Details
4. Logo Upload
5. First Product
6. Payments (Stripe)
7. Launch
```

#### 2.2 Trial Banner Component
Nieuwe component `TrialBanner` die toont:
- "Je hebt nog X dagen gratis trial"
- Progressbar van trial periode
- "Upgrade nu" button
- Wordt oranje bij < 3 dagen, rood bij verlopen

#### 2.3 Trial Expired Blocker
Bij verlopen trial:
- Toon full-screen overlay
- "Je trial is verlopen"
- Alleen optie: plan kiezen of uitloggen
- Blokkeer toegang tot admin features

---

### Fase 3: Verbeterde Auth Flow

#### 3.1 Auth Page Verbetering
Na succesvolle registratie:
- Direct doorsturen naar onboarding (niet naar /admin)
- Welkomstscherm met "Welkom bij SellQo!" animatie
- Duidelijke call-to-action om onboarding te starten

#### 3.2 Onboarding Trigger Logic Verbeteren
Huidige logica controleert:
- `profiles.onboarding_completed = false`
- EN geen tenants met producten

Nieuwe logica moet ook:
- Forceren bij `profiles.created_at` binnen laatste 5 minuten
- Tonen bij eerste login na registratie

---

## Implementatie Details

### Bestanden die worden aangemaakt:

| Bestand | Doel |
|---------|------|
| `src/hooks/useTrialStatus.ts` | Hook voor trial status checking |
| `src/components/onboarding/steps/PlanSelectionStep.tsx` | Plan keuze stap |
| `src/components/admin/TrialBanner.tsx` | Trial status banner |
| `src/components/admin/TrialExpiredBlocker.tsx` | Blocker bij verlopen trial |

### Bestanden die worden aangepast:

| Bestand | Wijziging |
|---------|-----------|
| `src/hooks/useOnboarding.ts` | Toevoegen step 2 (plan selectie), TOTAL_STEPS naar 7 |
| `src/components/onboarding/OnboardingWizard.tsx` | Nieuwe stap renderen |
| `src/components/admin/AdminLayout.tsx` | TrialBanner + TrialExpiredBlocker integreren |
| `src/pages/Auth.tsx` | Redirect naar onboarding na registratie |

### Database Migratie:

```sql
-- Trigger om automatisch subscription aan te maken bij nieuwe tenant
CREATE OR REPLACE FUNCTION public.create_tenant_trial_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO tenant_subscriptions (
    tenant_id,
    plan_id,
    status,
    trial_end,
    billing_interval
  ) VALUES (
    NEW.id,
    'free',
    'trialing',
    (NOW() + INTERVAL '14 days')::timestamptz,
    'monthly'
  );
  RETURN NEW;
END;
$$;

-- Trigger koppelen aan tenants tabel
CREATE TRIGGER on_tenant_created_create_subscription
  AFTER INSERT ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION create_tenant_trial_subscription();
```

---

## Verwachte Eindresultaat

### Nieuwe User Journey:

```text
1. Landing page → "Start Gratis" button
   ↓
2. Registratie (email + wachtwoord)
   ↓
3. Onboarding Wizard opent automatisch
   ├── Stap 1: Welkom + Winkelnaam
   ├── Stap 2: Kies je plan (Free trial default)
   ├── Stap 3: Bedrijfsgegevens
   ├── Stap 4: Logo upload (optioneel)
   ├── Stap 5: Eerste product
   ├── Stap 6: Stripe koppeling (optioneel)
   └── Stap 7: Klaar! 🎉
   ↓
4. Dashboard met Trial Banner
   "Je hebt nog 14 dagen gratis trial"
   ↓
5. Bij trial verlopen → Upgrade blocker
```

### Trial Status Gedrag:

| Dagen over | Banner kleur | Actie |
|------------|--------------|-------|
| 14-4 | Groen | Subtiele reminder |
| 3-1 | Oranje | Prominente waarschuwing |
| 0 | Rood | Full-screen blocker |

---

## Geschatte Tijdsinvestering

| Fase | Taken | Tijd |
|------|-------|------|
| Fase 1 | Database trigger + useTrialStatus hook | ~45 min |
| Fase 2.1 | Plan Selection Step | ~30 min |
| Fase 2.2 | Trial Banner Component | ~20 min |
| Fase 2.3 | Trial Expired Blocker | ~30 min |
| Fase 3 | Auth flow verbeteringen | ~20 min |
| Testing & fixes | Integratie testen | ~30 min |
| **Totaal** | | **~3 uur** |
