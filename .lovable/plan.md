

## Redesign: Downgrade bevestigingsdialog — creatiever en mooier

### Huidige situatie
Er is al een `DowngradeWarningDialog` met een basis AlertDialog, een waarschuwingsicoon, feature-badges, en een checkbox. Het werkt, maar het is vrij standaard en saai.

### Nieuw ontwerp — twee-staps flow

**Stap 1: "Weet je het zeker?" — emotionele eerste pop-up**
- Groot animerend icoon (ShieldAlert of TrendingDown) met een subtiele pulse-animatie
- Headline: **"Wil je echt downgraden?"**
- Subtext: *"Je {currentPlan} abonnement geeft je toegang tot krachtige tools. Weet je zeker dat je deze wilt opgeven?"*
- Visuele vergelijking: huidige plan vs doel-plan als twee mini-kaartjes naast elkaar, met het huidige plan licht gehighlight en het doel-plan gedempt
- Twee knoppen: **"Nee, ik blijf bij {currentPlan}"** (primary, opvallend) en **"Ja, ik wil downgraden"** (ghost/outline, bewust minder opvallend)

**Stap 2: Feature-overzicht + bevestiging (bestaande flow, opgepoetst)**
- Alleen als gebruiker "Ja" kiest in stap 1
- Toont de verloren features als nette pills (al gestyled)
- Checkbox bevestiging blijft
- Destructive "Bevestig Downgrade" knop

### Wijzigingen

**Bestand: `src/components/admin/billing/DowngradeWarningDialog.tsx`**

- `step` state toevoegen (1 of 2)
- **Stap 1**: Nieuw design met twee mini plan-kaartjes, grote headline, emotionele copy, en asymmetrische knoppen (blijf-knop is primary + groot, downgrade-knop is klein/outline)
- **Stap 2**: Bestaande feature-lost lijst + checkbox (al aanwezig), maar met verbeterde styling
- Animatie via Tailwind `animate-in` classes bij stap-wissel
- Reset `step` naar 1 bij sluiten

### Geen database wijzigingen nodig

