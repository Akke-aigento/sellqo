

## Fix: Downgrade pop-up toont niet

### Oorzaak

In `Billing.tsx` (regel 121) wordt de downgrade warning **alleen** getoond als:
1. `preview.is_upgrade === false` — prijs is lager
2. `preview.features.lost.length > 0` — er zijn features die verloren gaan

Als een van beide condities niet klopt (bijv. plans hebben geen/dezelfde features in de database, of de prijs-vergelijking gaat fout bij interval-wissels), wordt de dialog overgeslagen en gaat het direct naar de plan-switch preview.

### Oplossing

De downgrade warning moet **altijd** verschijnen bij een downgrade, ook als er geen specifieke features verloren gaan. Het is immers altijd goed om te bevestigen dat iemand wil downgraden.

### Wijzigingen

| Bestand | Actie |
|---|---|
| `src/pages/admin/Billing.tsx` | Conditie aanpassen: toon warning bij **elke** downgrade (`!preview.is_upgrade`), niet alleen als er features verloren gaan |
| `src/components/admin/billing/DowngradeWarningDialog.tsx` | Stap 2 features-lijst alleen tonen als er daadwerkelijk features zijn, anders direct checkbox tonen |

### Detail

**Billing.tsx (regel 120-125)**
```tsx
// Was:
if (!preview.is_upgrade && preview.features.lost.length > 0) {
// Wordt:
if (!preview.is_upgrade) {
```

**DowngradeWarningDialog.tsx** — de features-sectie in stap 2 heeft al een `featuresLost.length > 0` check, dus dat werkt al correct als er geen features zijn.

### Geen database wijzigingen nodig

