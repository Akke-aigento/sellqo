

## Herziening Health Score Systeem

### Kernproblemen met huidige scoring

1. **Onboarding in de score is onzinnig** — De setup wizard is eenmalig, geen operationele gezondheid. Een shop die de wizard heeft overgeslagen maar perfect draait, krijgt strafpunten.

2. **Lege winkel = perfecte score** — Een shop met 0 producten en 0 orders scoort 25/25 op Orders en 20/20 op Voorraad. Dat is misleidend — "geen problemen" ≠ "goed bezig."

3. **Stripe te zwaar bestraft** — -12 van 20 punten (60% penalty) voor geen Stripe is buitenproportioneel. Veel shops starten zonder of gebruiken andere methodes.

4. **Geen verschil tussen "leeg" en "gezond"** — Het systeem kent geen "neutrale" of "niet van toepassing" status.

### Voorgestelde wijzigingen

#### 1. Onboarding uit de health score halen
- Verwijder `onboardingCompleted` volledig uit `calculateComplianceHealth`
- Compliance focust nu alleen op **echte compliance**: juridische pagina's, bedrijfsgegevens, logo
- Herbalanceer Compliance items: legal pages zwaarder (max -7), bedrijfsinfo (-2), logo (-1)

#### 2. "Lege winkel" detectie toevoegen
Wanneer een shop nog geen producten of orders heeft, toon neutrale/helpende items in plaats van groene vinkjes:

| Situatie | Huidig | Nieuw |
|----------|--------|-------|
| 0 producten | Voorraad: 20/20 ✅ | Voorraad: 10/20 ⚡ "Voeg je eerste product toe" |
| 0 orders ooit | Orders: 25/25 ✅ | Orders: 15/25 ⚡ "Wachtend op je eerste bestelling" |
| 0 berichten ooit | Klantservice: 15/15 ✅ | Klantservice: 12/15 — neutrale staat, geen penalty maar ook geen perfecte score |

Dit geeft nieuwe shops een startpunt van ~60-65% in plaats van een misleidende 100%.

#### 3. Stripe penalty verlagen
- Van -12 naar -6 punten (30% van Finance in plaats van 60%)
- Stripe is belangrijk maar niet showstopping voor een nieuwe winkel

#### 4. Gewichten bijstellen
Huidige totaal = 100, dat blijft gelijk, maar verdeling verschuift:

| Categorie | Huidig | Nieuw | Reden |
|-----------|--------|-------|-------|
| Orders | 25 | 25 | Blijft gelijk — kern van de business |
| Voorraad | 20 | 20 | Blijft gelijk |
| Klantservice | 15 | 20 | Verhoogd — klantretentie is cruciaal |
| Betalingen | 20 | 15 | Verlaagd — minder dagelijkse urgentie |
| SEO | 10 | 10 | Blijft gelijk |
| Compliance | 10 | 10 | Blijft gelijk, maar zonder onboarding |

### Technische aanpak

**`src/lib/healthScoreCalculator.ts`**:
- `calculateOrdersHealth`: Check `activeProducts === 0` → geef 15/25 + tip-item "Wachtend op eerste bestelling"
- `calculateInventoryHealth`: Check `activeProducts === 0` → geef 10/20 + tip-item "Voeg producten toe"
- `calculateCustomerServiceHealth`: Verhoog maxScore 15→20; als geen berichten ooit, geef 12/20
- `calculateFinanceHealth`: Verlaag maxScore 20→15; Stripe penalty 12→6
- `calculateComplianceHealth`: Verwijder `onboardingCompleted` check; herbalanceer legal pages naar max -7
- `HealthData` interface: Onboarding veld kan blijven (backward compat) maar wordt niet meer gebruikt in scoring

**`src/config/healthMessages.ts`**:
- Update `categoryInfo` gewichten
- Voeg "new shop" berichten toe per categorie (bijv. "Je winkel is bijna klaar — voeg producten toe!")

**`src/hooks/useShopHealth.ts`**: Geen wijzigingen nodig (data gathering blijft hetzelfde)

### Bestanden
- `src/lib/healthScoreCalculator.ts` — scoring logica herzien
- `src/config/healthMessages.ts` — gewichten + nieuwe berichten

