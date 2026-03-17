

## Analyse: 2 Problemen Gevonden

### Probleem 1: POS Sessies staan allemaal "open"

**Oorzaak:** Er staan 7 sessies op status `open` in de database, allemaal voor dezelfde terminal. Het probleem is dat bij het openen van een nieuwe sessie **niet gecontroleerd wordt of er al een open sessie bestaat**. Elke keer dat je "Kassa Openen" klikt, wordt er een nieuwe open sessie aangemaakt zonder de vorige te sluiten.

De `activeSessionQuery` gebruikt `.maybeSingle()` — bij meerdere open sessies voor dezelfde terminal geeft dit een fout of een willekeurig resultaat, waardoor het sluiten niet meer werkt.

**Oplossing:**
1. **`usePOSSessions.openSession`**: Voeg een check toe die bestaande open sessies voor die terminal eerst sluit (of weigert een nieuwe te openen)
2. **Eenmalige cleanup**: Sluit alle oude open sessies behalve de meest recente via een database-actie
3. **Database constraint**: Voeg een partial unique index toe op `pos_sessions(terminal_id) WHERE status = 'open'` zodat er nooit meer dan 1 open sessie per terminal kan bestaan
4. **POS overzichtspagina**: Voeg een "Sessie Sluiten" knop toe bij open sessies in de recente-sessies lijst zodat je ze ook vanuit het overzicht kunt sluiten

### Probleem 2: Dashboard toont "Betaling niet gekoppeld"

**Oorzaak:** De `useStripeConnect` hook heeft een `checkStatus` functie die **niet automatisch wordt aangeroepen**. De `status` start als `null`, en `useShopHealth` leest `stripeStatus?.charges_enabled` — dat is `undefined` wanneer status `null` is, dus `stripeConnected` wordt altijd `false`.

De Stripe account IS correct gekoppeld in de database (`stripe_charges_enabled: true` voor VanXcel), maar de health check roept de edge function nooit aan.

**Oplossing:**
- **`useStripeConnect`**: Voeg een `useEffect` toe die `checkStatus()` automatisch aanroept bij mount (wanneer `tenantId` beschikbaar is)
- **Alternatief (sneller/efficiënter)**: Lees `stripe_charges_enabled` rechtstreeks uit de tenant data in `useShopHealth` in plaats van via de edge function. De tenant data is al beschikbaar via `useTenant()`.

### Bestanden

| Actie | Bestand | Wat |
|-------|---------|-----|
| Wijzig | `src/hooks/useStripeConnect.ts` | Auto-fetch status bij mount via useEffect |
| Wijzig | `src/hooks/usePOS.ts` | Check/sluit bestaande open sessie bij openen nieuwe |
| Migratie | Database | Partial unique index + cleanup oude open sessies |
| Wijzig | `src/pages/admin/POS.tsx` | Optioneel: sluit-knop bij open sessies in overzicht |

