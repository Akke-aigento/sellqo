
## Promoties-overzichtspagina: geblokkeerde modules tonen als "Upgrade"

### Probleem
De Promotions overview-pagina toont alle 10 modules als klikbare kaarten, ongeacht het abonnement. Items die in de sidebar wél geblokkeerd zijn (Bundels, BOGO, Staffelkorting, Loyaliteit, Cadeaubonnen), zijn hier gewoon toegankelijk. Er is geen visuele indicatie dat deze features premium zijn.

### Oplossing

**1. `featureKey` toevoegen aan `promotionModules`**

Koppel dezelfde featureKeys als de sidebar:

| Module | featureKey |
|---|---|
| Bundels | `promo_bundles` |
| Staffelkortingen | `promo_volume` |
| BOGO Acties | `promo_bogo` |
| Loyaliteitsprogramma | `loyalty_program` |
| Cadeaukaarten | `promo_giftcards` |

**2. Feature-check met bestaande hooks**

Importeer `useTenantPageOverrides` (voor `isFeatureGranted`), `useSubscription`, en de admin view state. Dezelfde logica als sidebar en settings:

```text
isModuleLocked(module):
  if no featureKey → not locked
  if platform admin + admin view → not locked
  if featureKey in granted_features → not locked
  if subscription has feature → not locked
  else → locked
```

**3. Visuele weergave voor geblokkeerde modules**

- Kaart krijgt een subtiele grijze overlay / `opacity-60`
- "Beheren" knop wordt vervangen door "Upgrade" knop (amber/oranje stijl) met Lock-icoon
- De "Upgrade" knop linkt naar `/admin/billing` (of opent upgrade flow)
- Badge "Premium" verschijnt in plaats van de actief/totaal teller

**4. Stats bovenaan filteren**

De totalen (Actieve Promoties, etc.) tellen alleen modules mee waar de tenant toegang toe heeft, zodat de cijfers kloppen met wat ze daadwerkelijk kunnen gebruiken.

### Bestanden

| Bestand | Actie |
|---|---|
| `src/pages/admin/Promotions.tsx` | featureKey per module, lock-check, upgrade UI voor geblokkeerde kaarten |

### Geen database wijzigingen nodig
