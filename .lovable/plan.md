

## Fix: Betere feedback bij Bol Ads synchronisatie

### Probleem
Bij het pushen/synchroniseren van Bol campagnes duurt het 20-30 seconden zonder duidelijke feedback. Er verschijnt alleen een toast "Campagne wordt naar Bol.com gestuurd..." en daarna lijkt er niets te gebeuren tot het klaar is.

### Oplossing
Twee verbeteringen: (1) visuele loading state op de campagnekaart zelf, en (2) stapsgewijze toast-updates zodat de gebruiker ziet wat er gebeurt.

### Wijzigingen

| Bestand | Actie |
|---------|-------|
| `src/components/admin/ads/CampaignCard.tsx` | Loading overlay op de kaart tonen tijdens push, met animatie en staptekst |
| `src/hooks/useAdCampaigns.ts` | Stapsgewijze toasts bij auto-push na aanmaken: "Verbinden met Bol...", "Campagne aanmaken...", "Producten toevoegen...", "Klaar!" |
| `supabase/functions/push-bol-campaign/index.ts` | Stap-indicatie in response toevoegen (welke stappen zijn voltooid) |

### Detail

**CampaignCard.tsx**
- Als `pushing === true`: toon een semi-transparante overlay over de kaart met een spinner + "Bezig met synchroniseren..." tekst
- De hele kaart krijgt een subtiele pulserende border (`animate-pulse border-primary/50`)
- Push-knop toont al een spinner (al aanwezig), maar nu ook de kaart zelf

**useAdCampaigns.ts — onSuccess auto-push flow**
- Vervang de enkele toast door een reeks updates met `toast.loading` pattern:
  - Stap 1: "Verbinden met Bol.com..." (onmiddellijk)
  - Stap 2: Na response: success/error toast met details
- Gebruik `toast()` met een `id` zodat de toast wordt bijgewerkt i.p.v. gestacked

**CampaignCard.tsx — handlePushToBol / handleRepushToBol**
- Zelfde pattern: gebruik toast met vaste ID die wordt bijgewerkt
- Toon stap-indicatie: "Stap 1/3: Campagne aanmaken..." → "Stap 2/3: Producten toevoegen..." etc.
- Aangezien de edge function synchroon werkt en we geen tussentijdse updates krijgen, simuleren we stap-indicatie met een timer (na 5s → stap 2, na 15s → stap 3) zodat de gebruiker ziet dat er iets gebeurt

### Geen database wijzigingen nodig

