# Plan: Permanente fix voor onboarding auth/RLS-probleem ✅ VOLTOOID

## Probleem
- `new row violates row-level security policy for table "tenants"` (403/42501)
- Oorzaak: corrupt/expired auth sessie in browser → `auth.uid()` is NULL → RLS faalt

## Geïmplementeerde oplossingen

### 1. ✅ Session Cleanup in AuthProvider (`src/hooks/useAuth.tsx`)
- Automatische detectie van stale auth tokens in localStorage
- Cleanup bij: SIGNED_OUT events, session errors, inconsistente states
- Nieuwe helper functies: `hasStaleAuthStorage()`, `clearAuthStorage()`

### 2. ✅ `ensureAuthenticated()` guard (`src/hooks/useAuth.tsx`)
- Nieuw export: `ensureAuthenticated(): Promise<boolean>`
- Valideert sessie vóór protected writes
- Probeert refresh als session invalid, force sign-out als dat faalt

### 3. ✅ Auth Guard in Onboarding (`src/hooks/useOnboarding.ts`)
- `createTenant()` roept nu eerst `ensureAuthenticated()` aan
- Bij RLS fout na retry → `sessionExpired: true` state
- `handleSessionExpiredRelogin()` voor recovery flow

### 4. ✅ Session Recovery Dialog (`src/components/auth/SessionExpiredDialog.tsx`)
- Modal met duidelijke boodschap: "Sessie verlopen"
- Één-klik "Opnieuw inloggen" knop
- Geïntegreerd in OnboardingWizard

## Test scenario's
- **A**: Fresh login → onboarding → stap 3 → tenant OK
- **B**: Corrupt session → dialog verschijnt → re-login → tenant OK
- **C**: Terugkomer partial onboarding → werkt of vraagt re-login

## Bestanden gewijzigd
- `src/hooks/useAuth.tsx` - session cleanup + ensureAuthenticated
- `src/hooks/useOnboarding.ts` - auth guard + session expired handling
- `src/components/auth/SessionExpiredDialog.tsx` - nieuw component
- `src/components/onboarding/OnboardingWizard.tsx` - dialog integratie
