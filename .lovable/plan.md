

# Plan: Waarschuwingen bij "Reset naar Standaard" Acties

## Probleem

Momenteel worden destructieve "reset naar standaard" acties direct uitgevoerd zonder bevestiging. Dit kan leiden tot onbedoeld verlies van werk wanneer gebruikers per ongeluk op de knop klikken.

## Gevonden Locaties

Na onderzoek heb ik **4 locaties** gevonden waar reset-acties een waarschuwingsdialoog nodig hebben:

| Locatie | Actie | Risico |
|---------|-------|--------|
| **ThemeCustomizer** | "Reset naar standaard" | Verlies van alle kleur-, font- en layout-aanpassingen |
| **SyncRulesTab** | "Herstel standaard" | Verlies van alle marketplace synchronisatie-instellingen |
| **DashboardCustomizeDialog** | "Standaard" knop | Verlies van dashboard layout en widget voorkeuren |
| **LegalPagesManager** | "Alle pagina's aanmaken" | Bestaande juridische pagina's worden overschreven |

## Oplossing

Een herbruikbare `AlertDialog` component gebruiken die:
- Duidelijk uitlegt wat er gaat gebeuren
- Specifiek benoemt welke data verloren gaat
- Een bevestigingsknop heeft met destructieve styling (rood)
- Een annuleer-optie heeft als uitweg

## Visueel Ontwerp Waarschuwingsdialoog

```text
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ⚠️  Weet je het zeker?                                          │
│                                                                 │
│  Je staat op het punt alle aanpassingen te resetten naar de    │
│  standaard instellingen. Dit omvat:                            │
│                                                                 │
│  • Kleuren (primair, secundair, accent)                        │
│  • Fonts (heading, body)                                       │
│  • Layout instellingen                                         │
│  • Logo en favicon                                             │
│  • Aangepaste CSS                                              │
│                                                                 │
│  Deze actie kan niet ongedaan worden gemaakt.                  │
│                                                                 │
│                            [Annuleren]  [Ja, reset alles]      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Technische Wijzigingen

### 1. ThemeCustomizer.tsx

Voeg een AlertDialog toe rond de reset-knop:

```typescript
// State toevoegen
const [showResetConfirm, setShowResetConfirm] = useState(false);

// In JSX: AlertDialog wrapper
<AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
  <AlertDialogTrigger asChild>
    <Button variant="outline">Reset naar standaard</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Weet je het zeker?</AlertDialogTitle>
      <AlertDialogDescription>
        Alle theme-aanpassingen worden teruggezet naar de standaard 
        instellingen. Dit omvat kleuren, fonts, layout en aangepaste CSS.
        Deze actie kan niet ongedaan worden gemaakt.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Annuleren</AlertDialogCancel>
      <AlertDialogAction 
        onClick={handleResetToDefaults}
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
      >
        Ja, reset alles
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### 2. SyncRulesTab.tsx

Zelfde patroon voor marketplace sync regels:

```typescript
// State
const [showResetConfirm, setShowResetConfirm] = useState(false);

// Waarschuwingstekst specifiek voor sync regels
<AlertDialogDescription>
  Alle synchronisatie-instellingen voor {platformName} worden 
  teruggezet naar de standaard. Dit omvat:
  • Product sync regels
  • Voorraad sync instellingen  
  • Bestel mapping
  Deze actie kan niet ongedaan worden gemaakt.
</AlertDialogDescription>
```

### 3. DashboardCustomizeDialog.tsx

De "Standaard" knop reset alleen lokale state (niet opgeslagen), maar dit kan ook verwarrend zijn na veel aanpassingen:

```typescript
// Minder kritische waarschuwing
<AlertDialogDescription>
  Alle widget en layout selecties worden gereset naar de 
  standaard configuratie. Je moet nog steeds op "Opslaan" 
  klikken om de wijzigingen definitief te maken.
</AlertDialogDescription>
```

### 4. LegalPagesManager.tsx

Voor het aanmaken van juridische pagina's wanneer er al pagina's bestaan:

```typescript
// Alleen tonen als er bestaande pagina's zijn
{legalPages.length > 0 && (
  <AlertDialog>
    <AlertDialogTrigger asChild>
      <Button>Alle pagina's regenereren</Button>
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogDescription>
        Bestaande juridische pagina's worden overschreven met 
        nieuwe automatisch gegenereerde content. Eventuele 
        handmatige wijzigingen gaan verloren.
      </AlertDialogDescription>
    </AlertDialogContent>
  </AlertDialog>
)}
```

## Bestandsoverzicht

| Bestand | Actie | Wijziging |
|---------|-------|-----------|
| `ThemeCustomizer.tsx` | Update | AlertDialog toevoegen rond reset knop |
| `SyncRulesTab.tsx` | Update | AlertDialog toevoegen rond herstel knop |
| `DashboardCustomizeDialog.tsx` | Update | AlertDialog toevoegen rond standaard knop |
| `LegalPagesManager.tsx` | Update | AlertDialog toevoegen voor regenereren |

## Consistente Waarschuwingstekst

Elk dialoog volgt dit patroon:
1. **Titel**: "Weet je het zeker?" 
2. **Beschrijving**: Wat er gereset wordt + "Deze actie kan niet ongedaan worden gemaakt."
3. **Annuleer knop**: "Annuleren" (outline/secondary)
4. **Bevestig knop**: "Ja, reset alles" of context-specifiek (destructive/rood)

## Resultaat

Na implementatie:
- Geen enkele reset-actie wordt meer direct uitgevoerd
- Gebruiker moet altijd expliciet bevestigen
- Duidelijke communicatie over wat er verloren gaat
- Eenvoudige uitweg via "Annuleren"
- Liever een klik teveel dan al je werk weg!

