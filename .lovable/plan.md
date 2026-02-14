
# Theme Selectie: Van Dood Knopje naar Werkend Thema-Systeem

## Het Kernprobleem

Wanneer je een thema selecteert (Bold, Classic, Modern), wordt alleen het `theme_id` opgeslagen. De bijbehorende kleuren, fonts en layout-instellingen worden **niet toegepast** op de storefront. Het thema bevat `default_settings` met alle juiste waarden, maar niemand leest ze.

```text
Admin: Selecteert "Bold" thema
  --> Slaat op: theme_id = "bold-id"
  --> Slaat NIET op: primary_color, fonts, header_style, etc.

Storefront: Leest themeSettings.primary_color
  --> Vindt: null
  --> Resultaat: geen verschil zichtbaar
```

## De Oplossing: Twee-lagen Thema Systeem

Bij het selecteren van een thema worden de default_settings van dat thema als **startwaardes** toegepast. De merchant kan daarna kleuren/fonts aanpassen als overrides. De storefront merged altijd: thema-defaults + tenant-overrides.

```text
Stap 1: Merchant kiest "Bold" thema
  --> primary_color, fonts, header_style etc. worden
      ingevuld vanuit Bold's default_settings

Stap 2: Merchant past accent kleur aan
  --> Alleen accent_color wordt overschreven,
      rest blijft uit Bold thema

Stap 3: Storefront rendert
  --> Leest tenant overrides + vult gaten aan met thema defaults
  --> Alles werkt
```

## Technische Wijzigingen

### 1. ThemeGallery.tsx -- Thema-selectie past defaults toe

Wanneer een thema wordt geselecteerd, worden de `default_settings` van dat thema meegestuurd als `saveThemeSettings` payload. Dit vult de kleur/font/layout velden in zodat de storefront ze direct kan lezen.

De admin colorpickers en font selectors tonen dan de actieve waarden (uit het thema) en de merchant kan ze overriden.

### 2. usePublicStorefront.ts -- Merged settings voor de storefront

De public storefront hook krijgt dezelfde merge-logica die al bestaat in `useStorefront.getMergedSettings()`. Wanneer een veld op de tenant `null` is maar het thema een default heeft, wordt de default gebruikt. Dit zorgt ervoor dat thema-selectie altijd werkt, zelfs als de tenant nog geen handmatige overrides heeft gemaakt.

### 3. ShopLayout.tsx -- Gebruikt gemerged settings

In plaats van `themeSettings.primary_color` direct te lezen, gebruikt de layout de gemerged waarden. Dit maakt het onmogelijk dat een ontbrekende kleur/font het thema breekt.

### 4. ThemeGallery.tsx -- Live preview indicator

Na selectie toont de gallery een "Bekijk je winkel" link zodat de merchant direct het resultaat kan zien. Dit geeft onmiddellijke feedback dat het thema werkt.

---

## Overzicht wijzigingen per bestand

| Bestand | Wijziging |
|---------|-----------|
| `src/components/admin/storefront/ThemeGallery.tsx` | Bij selectie: stuur theme defaults mee als tenant velden. Voeg "Bekijk winkel" link toe. |
| `src/hooks/usePublicStorefront.ts` | Voeg merge-logica toe: tenant overrides + thema defaults (zoals `getMergedSettings` in useStorefront) |
| `src/components/storefront/ShopLayout.tsx` | Gebruik gemerged `themeSettings` in plaats van raw waarden |

## Resultaat

- **Bold** thema: Donkere achtergrond, rode primary, Montserrat font, minimale header
- **Classic** thema: Lichte achtergrond, blauwe primary, Playfair Display heading, standaard header
- **Modern** thema: Witte achtergrond, zwarte primary, Inter font, gecentreerde header

Elke keuze is direct zichtbaar in de storefront zonder handmatig kleuren/fonts te moeten invullen.
