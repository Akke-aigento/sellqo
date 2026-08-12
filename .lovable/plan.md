# ONBOARD-DOUBLE-CREATE-1 — dubbele tenant-creatie op stap 3

## Analyse (met exacte regels)

### 1a. Knop in BusinessDetailsStep
`src/components/onboarding/steps/BusinessDetailsStep.tsx`
- regel 225-232: `<Button type="submit" disabled={!canContinue}>` binnen `<form onSubmit={handleSubmit}>` (regel 62).
- **Bevestigd**: de knop kent geen processing/loading-state; de component krijgt ook geen `isProcessing` prop (interface regel 15-20).
- Nuance: `OnboardingWizard.tsx` regel 319-326 vervangt de stapinhoud door een spinner zodra `isProcessing` true is. Discrete click-events flushen synchroon in React 18, dus een *tweede losse klik* ziet doorgaans al de spinner. Een dubbele submit blijft mogelijk bij een echte dubbel-event (dubbelklik/Enter+klik in dezelfde flush) of via een programmatische her-aanroep. Laag B is dus UX-hardening, niet de volledige verklaring.

### 1b. Guard in handleStepTransition
`src/components/onboarding/OnboardingWizard.tsx` regel 84-91: `case 3: if (!createdTenantId) { await createTenant(); ... }`.
- **Bevestigd**: `createdTenantId` komt uit hook-state (`setState` in `useOnboarding.ts` regel 654) en is dus pas na de re-render gevuld. Elke aanroep die start vóór die re-render passeert de guard.

### 1c. Re-entrancy in createTenant
`src/hooks/useOnboarding.ts` regel 377-700.
- **Bevestigd: geen in-flight guard.** De functie begint direct met de validatie + pre-flight slug-check (regel 388-401) en gaat door naar de edge function (regel 525).
- `hasCreatedTenantRef` (regel 105) wordt pas ná succes gezet (regel 630) en wordt alleen gelezen in `checkOnboardingStatus` (regel 114). Het blokkeert dus re-checks, **niet** een tweede gelijktijdige creatie. Bevestigd.
- Gevolg: bij twee gelijktijdige aanroepen slaagt aanroep 1 en botst aanroep 2 op de net aangemaakte slug → edge function 409 → `SlugConflictError` (`createTenantViaFunction.ts` regel 57-77) → `throw new Error('SLUG_CONFLICT')` (`useOnboarding.ts` regel 548) → dialog + "terug naar stap 1". Dit dekt het waargenomen console-patroon exact.

### 3. Retry-flow blijft werken
`OnboardingWizard.tsx` regel 247-253: `handleSlugAcceptAndRetry` roept `handleStepTransition(3)` pas na `setTimeout(..., 100)` aan, dus ná afronding van de eerdere `createTenant` (de `finally` heeft de ref dan vrijgegeven). De guard blokkeert deze legitieme retry niet.

### Andere steps
`WelcomeStep.tsx` regel 157-160 heeft hetzelfde patroon (`type="submit"`, alleen `!canContinue`), maar stap 1 doet geen server-mutatie in `handleStepTransition` (case 1 is leeg) — geen risico, laten we ongemoeid. `FirstProductStep` krijgt al `isLoading={isProcessing}` (regel 213).

## Fix — twee lagen

**Laag A (essentieel):** synchrone `useRef` in-flight guard in `createTenant`, gezet vóór élke await en vrijgegeven in een `finally` dat de hele body omsluit — dus vrijgegeven bij succes, `SLUG_CONFLICT`, `SESSION_EXPIRED`, `MISSING_SHOP_DATA` en elke andere error. Een tweede gelijktijdige aanroep returnt meteen `null` zonder slug-check of edge-function-call.

**Laag B (UX):** `isProcessing` doorgeven aan `BusinessDetailsStep` en de knop `disabled={!canContinue || isProcessing}` met spinner.

## Scope
Alleen `src/hooks/useOnboarding.ts`, `src/components/onboarding/OnboardingWizard.tsx`, `src/components/onboarding/steps/BusinessDetailsStep.tsx`. Geen RLS, geen migratie, geen edge function.

## Diffs

### src/hooks/useOnboarding.ts
```diff
   const hasCreatedTenantRef = useRef(false);
+  // ONBOARD-DOUBLE-CREATE-1 — synchrone in-flight guard: voorkomt dat een
+  // tweede submit tijdens een lopende creatie de slug van de eerste raakt.
+  const isCreatingTenantRef = useRef(false);
```
```diff
   const createTenant = useCallback(async () => {
     if (!user) return null;
+
+    if (isCreatingTenantRef.current) {
+      console.warn('[Onboarding] createTenant: al bezig — dubbele aanroep genegeerd');
+      return null;
+    }
+    isCreatingTenantRef.current = true;
+    try {
 
     // CRITICAL VALIDATION: Check if shopName and shopSlug are filled in
```
Sluit de bestaande body af (na de bestaande buitenste `try/catch`, vóór de dependency-array):
```diff
       throw error;
     }
+    } finally {
+      isCreatingTenantRef.current = false;
+    }
   }, [user, state.data, ...]);
```
De rest van de body schuift één indentatieniveau in; er verandert geen logica. Alle exit-paden (`return tenant`, `return null` bij SESSION_EXPIRED, throws) passeren de `finally`.

### src/components/onboarding/OnboardingWizard.tsx
```diff
           <BusinessDetailsStep
             data={data}
             updateData={updateData}
             onNext={() => handleStepTransition(3)}
             onPrev={prevStep}
+            isProcessing={isProcessing}
           />
```

### src/components/onboarding/steps/BusinessDetailsStep.tsx
```diff
-import { Building2, ArrowRight, ArrowLeft } from 'lucide-react';
+import { Building2, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
@@
   onNext: () => void;
   onPrev: () => void;
+  isProcessing?: boolean;
 }
@@
   onNext,
   onPrev,
+  isProcessing = false,
 }: BusinessDetailsStepProps) {
@@
   const handleSubmit = (e: React.FormEvent) => {
     e.preventDefault();
-    if (canContinue) {
+    if (canContinue && !isProcessing) {
       onNext();
     }
   };
@@
-        <Button type="button" variant="outline" onClick={onPrev} className="flex-1">
+        <Button type="button" variant="outline" onClick={onPrev} className="flex-1" disabled={isProcessing}>
@@
-        <Button type="submit" className="flex-1" disabled={!canContinue}>
-          Volgende stap
-          <ArrowRight className="ml-2 h-4 w-4" />
+        <Button type="submit" className="flex-1" disabled={!canContinue || isProcessing}>
+          {isProcessing ? (
+            <>
+              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
+              Winkel aanmaken...
+            </>
+          ) : (
+            <>
+              Volgende stap
+              <ArrowRight className="ml-2 h-4 w-4" />
+            </>
+          )}
         </Button>
```

## Verificatie
- Typecheck.
- Stap 3 met dubbelklik op "Volgende stap": console toont één `createTenant`-run, één edge-function POST, geen 409.
- Slug-conflict-retry: dialog → "Accepteer" → nieuwe poging draait wel door.
