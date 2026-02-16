
# Volledige Herziening: Kleuren Sectie & Palette Generator

## Probleem (uit screenshots)

1. **Palette Generator negeert 4 van 5 kleuren** -- hij genereert op basis van 1 basekleur, maar past alleen `primary` toe. Background, text, secondary en accent worden niet goed meegenomen naar de storefront
2. **Onduidelijke UX** -- de flow Mood Presets > Palette Generator > Handmatige kleurvelden is verwarrend. Drie losse stukken die niet samenhangen. Een klant weet niet waar te beginnen
3. **Storefront toont verkeerde kleuren** -- op screenshot 3 is de header teal terwijl "Warm & Cozy" (bruin/oranje) is geselecteerd. De `themeStyle` builder in ShopLayout mist koppelingen

## Nieuwe Aanpak: Unified Color Studio

In plaats van 3 losse blokken (moods, generator, handmatig) wordt het EEN samenhangende flow:

### Stap 1: Sfeer kiezen (Mood) -- optioneel startpunt
- Blijft als compacte pills bovenaan
- Bij klik: vult ALLE 5 kleurvelden direct in (zoals nu, dit werkt al)

### Stap 2: Kleurpalet -- de hoofdinterface
Vervang de huidige "generator + handmatig" door een **enkele visuele kleurkaart**:

```
+--------------------------------------------------+
| JOUW KLEURENPALET                                 |
|                                                   |
|  [====]  Primair      #a0522d    Knoppen & links  |
|  [====]  Secundair    #d2691e    Subtiele accenten |
|  [====]  Accent       #cd853f    Prijzen & badges  |
|  [====]  Achtergrond  #faf0e6    Pagina achtergrond|
|  [====]  Tekst        #3e2723    Standaard tekst   |
|                                                   |
|  [Wand] Genereer variaties    [Contrast check]    |
+--------------------------------------------------+
```

- Elk kleurveld heeft een color picker + hex input + beschrijving wat het doet
- WCAG contrast badge rechts bij primair, accent en tekst (ratio t.o.v. achtergrond)
- Alles op 1 plek, geen scrollen nodig

### Stap 3: Palette Generator als popover/uitklapbaar
- "Genereer variaties" knop opent een compacte sectie met de 5 strategieen (Complementair, Analoog, etc.)
- De strategieen gebruiken ALLE huidige kleuren als context, niet alleen primary
- Bij "Toepassen" worden ALLE 5 kleurvelden bijgewerkt
- Generator is nu een hulpmiddel, niet de hoofdinterface

### Stap 4: Live mini-preview
- Onder de kleurkaart: een mini-preview blokje dat ALLE 5 kleuren visueel toont
- Toont: achtergrond + tekst + button (primary) + prijslabel (accent) + badge (secondary)
- Verandert live mee als je een kleur aanpast

## Technische Wijzigingen

### 1. `ThemeCustomizer.tsx` -- Herstructurering Kleuren sectie
- Verwijder de scheiding tussen "Palette Generator" en "Handmatig"  
- Maak 1 unified kleurkaart met alle 5 velden, elk met inline color picker, hex input, label, beschrijving en contrast badge
- Verplaats de palette generator naar een uitklapbaar blok onder de kleurkaart (Collapsible of Accordion)
- Voeg een inline mini-preview toe die alle 5 kleuren visueel toont
- Behoud de mood presets als pills bovenaan (deze werken goed)

### 2. `ColorPaletteGenerator.tsx` -- Vereenvoudiging
- Verwijder de eigen "basekleur" input -- de generator ontvangt nu ALLE 5 huidige kleuren als props
- Strategieen genereren nog steeds op basis van de primary hue, maar het preview toont duidelijker wat er verandert
- Elke strategie-kaart wordt compacter: alleen de kleurstrip + contrast indicator + toepassen knop
- Verwijder mood-linking logica (dat zit nu in de parent)

### 3. `ShopLayout.tsx` -- Betrouwbare kleur-toepassing
- Verifieer dat ALLE 5 kleuren correct worden doorgezet als CSS variabelen
- De volgorde moet zijn: eerst `deriveFromBackground` (fallbacks), dan expliciete overrides voor `--foreground` als `text_color` is gezet
- Dit is al grotendeels gefixt in de vorige update, maar wordt nogmaals gevalideerd

### Bestanden die worden gewijzigd

| Bestand | Wijziging |
|---------|-----------|
| `src/components/admin/storefront/ThemeCustomizer.tsx` | Kleuren sectie herstructureren naar unified kleurkaart + inline preview + generator als uitklapbaar blok |
| `src/components/admin/storefront/ColorPaletteGenerator.tsx` | Vereenvoudigen: geen eigen basekleur input meer, compactere strategie-kaarten, ontvangt alle kleuren als props |
| `src/components/storefront/ShopLayout.tsx` | Validatie dat alle 5 CSS variabelen correct worden gezet in de juiste volgorde |

### UX Verbeteringen samengevat

- **Was**: 3 losse secties (moods / generator met eigen kleurkiezer / handmatige velden) -- verwarrend
- **Wordt**: 1 overzichtelijke kleurkaart met alle kleuren, met optioneel een generator-hulpmiddel
- **Was**: Generator toont alleen kleurstrips zonder uitleg welke kleur wat doet
- **Wordt**: Elk kleurveld heeft duidelijke label + beschrijving + live contrast feedback
- **Was**: Mini-preview toont alleen een buttonnetje
- **Wordt**: Preview toont een echt mini-webshop blokje met alle 5 kleuren in actie
