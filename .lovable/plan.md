

# Mood Presets en Kleurpalet Generator Slim Koppelen

## Het probleem

De Mood Presets en Kleurpalet Generator werken nu volledig onafhankelijk van elkaar:

- Als je een Mood Preset kiest (bijv. "Luxury"), worden de kleuren ingesteld -- maar de Kleurpalet Generator weet daar niets van en blijft op zijn eigen basekleur staan.
- Als je een palet genereert, wordt de actieve mood preset niet bijgewerkt of uitgeschakeld.
- Er is geen duidelijke stap-voor-stap flow. De gebruiker weet niet: "Moet ik eerst een mood kiezen en dan fine-tunen? Of zijn dit twee aparte dingen?"

## De oplossing: Gecombineerde "Design Flow"

De twee tools worden samengevoegd in een logische workflow binnen de Kleuren-accordion:

**Stap 1: Kies een mood (startpunt)**
De Mood Presets worden bovenaan de Kleuren-sectie geplaatst als compacte, horizontaal scrollbare chips/pills (in plaats van een apart collapsible blok). Dit is het snelle startpunt.

**Stap 2: Verfijn met de palette generator**
Wanneer een mood geselecteerd wordt, wordt de primaire kleur van die mood automatisch als basekleur in de Kleurpalet Generator gezet. De generator toont dan variaties gebaseerd op die mood-kleur. Een label laat zien: "Gebaseerd op Luxury" (of welke mood dan ook actief is).

**Stap 3: Handmatig finetunen**
De handmatige kleurvelden blijven onderaan staan voor wie volledige controle wil.

## Concrete wijzigingen

### 1. ThemeMoodPresets.tsx -- Compact pill-formaat

De huidige grid met grote kaarten wordt vervangen door een compacte horizontale rij van pills/chips:
- Elke pill toont: icoon + naam + 3 kleurbolletjes
- Actieve pill krijgt een ring/border highlight
- Neemt veel minder ruimte in en is overzichtelijker

### 2. ColorPaletteGenerator.tsx -- Mood-aware

- Nieuwe prop: `activeMood?: { name: string; color: string }`
- Wanneer een mood actief is, wordt de basekleur automatisch gesynchroniseerd en toont een label "Gebaseerd op [Mood naam]"
- Gebruiker kan de basekleur nog steeds handmatig aanpassen -- dan verdwijnt het mood-label
- Wanneer een palette wordt toegepast, wordt `activeMoodId` gereset (zoals nu al gebeurt)

### 3. ThemeCustomizer.tsx -- Eenvoudigere structuur

- Het aparte Collapsible blok voor Mood Presets verdwijnt
- Mood Presets worden bovenaan de Kleuren-accordion geplaatst
- De `activeMoodId` state wordt doorgegeven aan de ColorPaletteGenerator
- Bij mood-selectie wordt de basekleur in de generator automatisch bijgewerkt

## Technische wijzigingen

| Bestand | Wijziging |
|---------|-----------|
| `ThemeMoodPresets.tsx` | Refactor naar compact horizontaal pill-formaat. Minder hoogte, zelfde functionaliteit. |
| `ColorPaletteGenerator.tsx` | Nieuwe `activeMood` prop toevoegen. Basekleur synchroniseren met actieve mood. Label tonen bij actieve koppeling. |
| `ThemeCustomizer.tsx` | Mood Presets verplaatsen naar binnen de Kleuren-accordion (bovenaan). Collapsible verwijderen. Mood-data doorgeven aan ColorPaletteGenerator. |

## Resultaat

De gebruiker ervaart nu een natuurlijke flow:
1. Kies snel een sfeer via de mood pills bovenaan
2. Zie direct gegenereerde kleurpaletten gebaseerd op die sfeer
3. Pas een palet toe, of fine-tune handmatig
4. Alles in een logische, samenhangende sectie

