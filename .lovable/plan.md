

## Fix: Limieten worden niet afgedwongen + verkeerde weergave bij overschrijding

### Problemen

1. **"Je nadert je limiet" terwijl je AL over de limiet bent** — De usage percentage wordt afgekapt op 100% (`Math.min(..., 100)`), en het bericht maakt geen onderscheid tussen "bijna vol" (≥80%) en "overschreden" (>100%).

2. **`enforceLimit()` wordt NERGENS aangeroepen** — De functie bestaat in `useUsageLimits.ts` maar geen enkele create-flow (producten, klanten, etc.) checkt of de limiet is bereikt. Tenants kunnen onbeperkt items aanmaken.

3. **Geen visueel onderscheid over-limiet** — Progress bar is alleen amber bij ≥80%, nooit rood bij >100%. Tekst toont "55 / 25" maar zegt "je nadert je limiet".

### Oplossing

**1. Usage percentage niet meer afkappen + over-limiet styling**

In `useTenantSubscription.ts`: verwijder `Math.min(..., 100)` zodat percentage >100% kan zijn.

In `Billing.tsx`:
- ≥80% en <100%: amber (huidige gedrag) + tekst "Je nadert je limiet"
- ≥100%: **rood** + tekst "Je hebt je limiet overschreden"  
- Progress bar: `bg-destructive` bij ≥100%

**2. Enforce limits bij het aanmaken van items**

Voeg `enforceLimit` checks toe aan de **create-flows** van:

| Entiteit | Bestand | Waar |
|---|---|---|
| Producten | `src/pages/admin/ProductForm.tsx` | `onSubmit` — voor `createProduct.mutateAsync()` (alleen bij `!isEditing`) |
| Klanten | `src/pages/admin/Customers.tsx` | `createCustomer.mutate()` — wrap in limiet-check |
| Team | Teamleden invite flow | Bij het uitnodigen van een nieuw teamlid |

Bij overschrijding: toon een toast met "Limiet bereikt" + blokkeer de actie (return early). Bestaande items worden **niet verwijderd**, alleen nieuwe aanmaak wordt geblokkeerd.

**3. Trials: soepelere handhaving**

Tijdens trial-periode (`status === 'trialing'`): toon een **waarschuwing** maar sta de actie nog toe (soft limit). Na trial of bij betaalde plannen: **hard block**.

Dit zorgt ervoor dat trial-gebruikers de waarde van het platform kunnen ervaren, maar na de trial worden ze gedwongen te upgraden als ze over de limiet zitten.

**4. Verbeterde `enforceLimit` met context**

Pas `useUsageLimits.ts` aan:
- Voeg `isOverLimit(limitType)` toe als synchrone check (gebruikt cached usage data uit `useTenantSubscription`)
- Maak `enforceLimit` slimmer: retourneer `{ allowed: boolean, isTrialing: boolean, current: number, limit: number }` zodat de UI betere feedback kan geven
- Bij trial: toon waarschuwings-toast maar return `allowed: true`
- Bij actief betaald plan: toon error-toast en return `allowed: false`

**5. "Nieuw product" knop visueel blokkeren**

In `Products.tsx`: als `usage.products.percentage >= 100` en niet trialing, disable de "Nieuw product" knop met tooltip "Limiet bereikt — upgrade je plan".

### Bestanden

| Bestand | Actie |
|---|---|
| `src/hooks/useTenantSubscription.ts` | Percentage niet afkappen op 100% |
| `src/hooks/useUsageLimits.ts` | `isOverLimit` sync check + trial-aware enforcement |
| `src/pages/admin/Billing.tsx` | Rood bij >100%, betere tekst, progress bar styling |
| `src/pages/admin/ProductForm.tsx` | `enforceLimit('products')` bij create |
| `src/pages/admin/Customers.tsx` | `enforceLimit('customers')` bij create |
| `src/pages/admin/Products.tsx` | "Nieuw product" knop disablen bij over-limiet |

### Geen database wijzigingen nodig

