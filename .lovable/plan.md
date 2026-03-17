

## Dashboard Audit: Gevonden Problemen en Oplossingen

### Probleem 1: HealthActionsWidget crasht (ZICHTBARE ERROR)
De console toont een crash in `<HealthActionsWidget>`. Dit widget roept `useShopHealth()` aan, wat intern `useStripeConnect(currentTenant?.id)` aanroept. Het probleem: **3 widgets** (`HealthBannerWidget`, `HealthCategoriesWidget`, `HealthActionsWidget`) roepen elk apart `useShopHealth()` aan, wat **3 aparte instances** van `useStripeConnect` creëert. Elk van deze triggert nu de auto-fetch `useEffect`, dus `check-connect-status` wordt **3x tegelijk** aangeroepen (bevestigd in network logs).

De crash zelf komt waarschijnlijk door een race condition in de data loading — als `useShopHealth` niet goed terugvalt bij loading states, kan `actionItems` undefined zijn waardoor de render crasht.

**Oplossing:**
- Lees `stripe_charges_enabled` direct uit `currentTenant` in `useShopHealth` in plaats van via de edge function. Tenant data is al beschikbaar — dit elimineert 3 onnodige edge function calls.
- Voeg defensieve null-checks toe in `HealthActionsWidget` voor het geval `actionItems` nog niet beschikbaar is.

### Probleem 2: Geen Error Boundary op widgets
Als één widget crasht (zoals nu `HealthActionsWidget`), veroorzaakt dit een cascade-effect. Er is geen error boundary rond individuele widgets.

**Oplossing:** Voeg een `ErrorBoundary` component toe in `DashboardWidgetWrapper` zodat een crashende widget de rest niet meeneemt.

### Probleem 3: `useShopHealth` wordt 3x onafhankelijk aangeroepen
`HealthBannerWidget`, `HealthCategoriesWidget`, en `HealthActionsWidget` roepen elk `useShopHealth()` aan. Dit triggert 3x dezelfde data-fetching (orders, products, messages, invoices, SEO, legal pages, analytics, Stripe).

React Query cached de individuele queries, maar de `useStripeConnect` hook is **geen** React Query hook — het gebruikt `useState`/`useEffect`, dus die data wordt 3x apart opgehaald.

**Oplossing:** Verwijder `useStripeConnect` uit `useShopHealth` en lees `stripe_charges_enabled` direct van `currentTenant` (al aanwezig via `useTenant()`).

### Probleem 4: `getMissingPages` als dependency in useMemo
In `useShopHealth`, `getMissingPages` is een functie die elke render nieuw is (niet gestabiliseerd met `useCallback` in `useLegalPages`). Dit maakt de `useMemo` dependency array instabiel, waardoor de healthData steeds opnieuw berekend wordt.

**Oplossing:** Verwijder `getMissingPages` uit de dependency array en gebruik `legalPages` direct (die al in de array zit).

### Samenvatting wijzigingen

| Actie | Bestand | Wat |
|-------|---------|-----|
| Wijzig | `src/hooks/useShopHealth.ts` | Vervang `useStripeConnect` door `currentTenant.stripe_charges_enabled`; fix dependency array |
| Wijzig | `src/components/admin/widgets/HealthActionsWidget.tsx` | Defensieve null-check toevoegen |
| Wijzig | `src/components/admin/DashboardWidgetWrapper.tsx` | Error boundary toevoegen rond elke widget |

