
## Fix: upgrade faalt nog steeds + rode "Upgrade nu" knop is inderdaad fantoom

### Wat ik heb vastgesteld
Er zijn momenteel 3 aparte problemen:

1. **Checkout crasht in de backend**
   - De logs van `create-platform-checkout` tonen:
   - `"Received unknown parameter: automatic_payment_methods"`
   - Daardoor geeft de functie een 500 terug nog vóór er een checkout-url wordt aangemaakt.

2. **De verkeerde tenant wordt gebruikt**
   - In de live logs werd bij jouw klik niet **Mancini Milano** gebruikt, maar **SellQo**.
   - Oorzaak: `create-platform-checkout` kiest nog steeds de eerste `tenant_id` uit `user_roles` in plaats van de **geselecteerde tenant** in de UI.
   - Voor platform admins is dat foutgevoelig.

3. **De rode upgrade-knop in de usage-card doet niets**
   - In `Billing.tsx` staat die knop zonder `onClick`.
   - Dus ja: die knop is momenteel gewoon een **fantoomknop**.

### Oplossing
**1. Checkout-function repareren**
- Verwijder de Stripe-parameter `automatic_payment_methods` uit `create-platform-checkout`.
- Behoud verder de subscription checkout flow zoals nu.

**2. Altijd de geselecteerde tenant meesturen**
- Vanuit de frontend de actieve `currentTenant.id` meesturen naar:
  - `create-platform-checkout`
  - `platform-customer-portal`
- In de backend eerst `tenant_id` uit de request body gebruiken.
- Daarna valideren dat de huidige gebruiker toegang heeft tot die tenant via `user_roles`.
- Alleen als er géén `tenant_id` is meegegeven nog een fallback-query gebruiken.

**3. Fantoom upgrade-knoppen koppelen aan echte actie**
- De rode/amber upgrade CTA in `Billing.tsx` laten verwijzen naar dezelfde logica als de plan-kaarten:
  - **trial/free zonder Stripe subscription** → checkout starten
  - **bestaande Stripe subscription** → plan-switch preview openen
- Zo krijgt elke upgradeknop eindelijk echt gedrag.

**4. Betekenis geven aan de rode knop**
- In plaats van “zomaar een knop” een logische upgrade-target bepalen:
  - kies het **laagste plan dat de huidige overschrijding opvangt**
  - voorbeeld: 55 producten op Free → Starter is genoeg
- Als geen enkel standaardplan genoeg is → stuur naar Enterprise/contact.

### Bestanden
| Bestand | Actie |
|---|---|
| `src/hooks/useTenantSubscription.ts` | `tenant_id` meesturen bij checkout en customer portal |
| `src/pages/admin/Billing.tsx` | rode/amber upgradeknoppen echte handler geven + aanbevolen upgrade-target gebruiken |
| `supabase/functions/create-platform-checkout/index.ts` | Stripe parameter fixen + `tenant_id` uit body gebruiken + access check |
| `supabase/functions/platform-customer-portal/index.ts` | `tenant_id` uit body gebruiken + access check |

### Technische details
- De huidige 500 komt concreet uit `create-platform-checkout`, niet uit de plan cards zelf.
- De edge logs tonen expliciet dat checkout nu voor de verkeerde tenant resolveert.
- De phantom knop zit hier:
  - `src/pages/admin/Billing.tsx`
  - usage warning met `<Button ...>Upgrade nu</Button>` zonder click handler.
- Er zijn **geen databasewijzigingen** nodig.

### Resultaat na deze fix
- Upgrade werkt opnieuw voor de geselecteerde tenant
- Platform admins openen checkout/portal voor de juiste klant
- De rode knop doet eindelijk iets logisch
- De knop wordt ook inhoudelijk correct: niet “upgrade ergens”, maar “upgrade naar het eerstvolgende plan dat dit oplost”
