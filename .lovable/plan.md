

## Wauw-factor toevoegen aan billing plan layout

### Huidige situatie
De plan cards zijn functioneel correct maar visueel saai: witte kaarten, kleine tekst, geen visuele hiërarchie, geen kleurgradiënten, en de detail-popup is basic.

### Aanpak

**1. Plan Comparison Cards — visuele upgrade**

- Elke plan-tier krijgt een unieke kleur-accent (Free = grijs, Starter = blauw, Pro = teal gradient met glow, Enterprise = donker/goud)
- Pro-kaart (highlighted) krijgt een **glassmorphism** effect met gradient border en subtiele glow-shadow
- Prijzen worden groter en krijgen een gradient kleur
- Limieten worden compacter weergegeven in een grid met iconen
- "Je krijgt erbij" features krijgen **pill-badges** in plaats van een saaie lijst
- Upgrade-knoppen krijgen gradient achtergrond + hover-animatie (scale + glow)
- "Huidig plan" badge krijgt een animated pulse ring
- Subtiele achtergrond-patronen of gradient mesh per kaart

**2. Feature Detail Dialog — premium look**

- Header krijgt een grotere gradient met het plan-icoon en een visueel aantrekkelijke prijs-weergave
- Limieten-grid krijgt grotere cijfers met kleuraccenten en iconen (📦 producten, 📋 orders, etc.)
- Feature-categorieën krijgen kleur-gecodeerde section headers met achtergrondkleur
- Check/X iconen worden groter en met meer contrast
- Upgrade-knop onderin krijgt dezelfde premium gradient-stijl als de cards
- Animatie bij openen (fade + slide)

**3. Specifieke visuele elementen**

- **Gradient borders**: Pro/Enterprise kaarten krijgen een animated gradient border
- **Hover states**: Cards liften op met shadow-2xl en scale-[1.02]
- **Pricing typography**: Prijscijfer 4xl bold met gradient text color voor betaalde plannen
- **Feature count badge**: "10 van 36 features" als een progress-achtige indicator
- **Spacing**: Meer breathing room, betere verticale ritme

### Bestanden

| Bestand | Actie |
|---|---|
| `src/components/admin/billing/PlanComparisonCards.tsx` | Complete visuele restyling: gradiënten, glassmorphism, animaties, betere typografie |
| `src/components/admin/billing/PlanFeatureDetailDialog.tsx` | Premium dialog styling: grotere header, kleur-gecodeerde categorieën, betere CTA |

### Geen database wijzigingen nodig

