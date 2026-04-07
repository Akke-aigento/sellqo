

## Billing cards visueel opschonen: minder kleur, meer elegantie

### Wat je wilt
- De **bovenste helft** van de kaarten (icoon, naam, prijs, limieten-grid) is goed — behouden
- **Minder felle kleuren** per tier: geen blauw/teal/amber gradiënten overal
- **"Meest gekozen"** badge krijgt alleen een **gouden omranding**, geen felgroene gradient
- Het **onderste gedeelte** (feature-pills, upgrade-knoppen) is te veel fel groen — neutraler maken

### Aanpassingen

**1. Tier-kleuren neutraliseren**
- Alle kaarten krijgen een schone witte/lichtgrijze achtergrond — geen gekleurde gradiënten meer
- De gekleurde top-strip (1.5px) blijft als subtiel accent, maar wordt dunner/subtieler
- Prijs-kleur wordt voor alle plannen gewoon donkergrijs/zwart in plaats van blauw/teal/amber
- Icoon-achtergrond wordt neutraal (lichtgrijs) voor alle tiers

**2. "Meest gekozen" badge → gouden rand**
- Badge wordt wit/transparant met een **gouden border** en subtiele gouden tekst
- Geen felgroene gradient meer
- De highlighted kaart krijgt een **gouden border** (border-amber-400) in plaats van een tier-kleur

**3. Feature-pills rustiger**
- "Je krijgt erbij" pills: zachter groen (lichtere achtergrond, subtielere border)
- De limit-wijzigingen (Producten: 25 → 250) worden gewone tekst met een klein icoon, geen gekleurde achtergrond
- Meer witruimte, minder visuele drukte

**4. Upgrade-knoppen**
- Alle upgrade-knoppen krijgen dezelfde kleur: de standaard SellQo teal (primary), niet per-tier blauw/amber/oranje
- Downgrade-knoppen blijven outline/neutraal
- "Huidig plan" knop blijft disabled outline

### Bestanden

| Bestand | Actie |
|---|---|
| `src/components/admin/billing/PlanComparisonCards.tsx` | tierConfig neutraliseren, badge gouden rand, pills zachter, knoppen uniform |

### Geen database wijzigingen nodig

