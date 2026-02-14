
# Theme Kleuren Doorvoeren naar de Storefront

## Het Probleem

De thema-kleuren worden opgeslagen en als CSS variabelen gezet (`--shop-primary`, `--shop-secondary`, etc.), maar **geen enkel element in de storefront gebruikt deze variabelen**. Alle componenten gebruiken Tailwind klassen:

```text
Wat er gebeurt:
  1. Admin: Kiest rood als primary --> opgeslagen in DB
  2. ShopLayout: Zet --shop-primary: #dc2626 op <html>
  3. Header: Gebruikt class="bg-background" --> leest --background (Tailwind)
  4. Footer: Gebruikt class="bg-muted/30" --> leest --muted (Tailwind)
  5. Buttons: Gebruikt class="bg-primary" --> leest --primary (Tailwind)
  
  Resultaat: --shop-primary wordt NERGENS gelezen. Kleuren hebben geen effect.
```

## De Oplossing

In plaats van ongebruikte `--shop-*` variabelen te zetten, overschrijven we de **Tailwind CSS variabelen** zelf (`--primary`, `--background`, `--foreground`, etc.) met de thema-kleuren. Dit zorgt ervoor dat ALLE Tailwind klassen automatisch de thema-kleuren gebruiken -- zonder dat we elk component hoeven aan te passen.

```text
Na de fix:
  1. Admin: Kiest rood als primary
  2. ShopLayout: Zet --primary: <rood in HSL> op root div
  3. Header "bg-background" --> leest --background --> thema achtergrondkleur
  4. Buttons "bg-primary" --> leest --primary --> thema primary kleur
  5. Alles klopt automatisch
```

## Technische Aanpak

### 1. Hex-naar-HSL converter

Tailwind/shadcn verwacht kleuren in HSL formaat (bijv. `220 14% 96%`). De thema-kleuren staan als hex (`#dc2626`). Er is een simpele utility nodig die hex omzet naar het juiste HSL formaat.

### 2. ShopLayout.tsx - CSS variabelen overschrijven

Het huidige `useEffect` dat `--shop-*` variabelen zet wordt vervangen. In plaats daarvan worden de Tailwind variabelen overschreven op de **wrapper div** van de storefront (niet op `document.documentElement`, zodat het alleen de storefront beinvloedt en niet de admin):

| Thema-instelling | Tailwind variabele | Gebruikt door |
|---|---|---|
| `primary_color` | `--primary` | Buttons, badges, links, cart badges |
| `secondary_color` | `--secondary` | Secondary buttons |
| `accent_color` | `--accent` | Hover states, highlights |
| `background_color` | `--background` | Pagina achtergrond, header |
| `text_color` | `--foreground` | Alle tekst |
| afgeleid van background | `--muted` | Footer, subtiele achtergronden |
| afgeleid van background | `--card` | Productkaarten |
| afgeleid van background | `--border` | Borders |

De variabelen worden als inline `style` op de wrapper div gezet, zodat ze lokaal gelden voor de storefront.

### 3. Header achtergrondkleur

De header gebruikt momenteel `bg-background/95` als Tailwind class. Zodra `--background` correct is overschreven, pakt de header automatisch de juiste kleur. Er is geen extra wijziging nodig.

### 4. Contrastberekening

Voor `--primary-foreground` (tekst op primary knoppen) wordt automatisch wit of zwart gekozen op basis van het contrast met de primary kleur. Hetzelfde voor `--secondary-foreground` en `--accent-foreground`.

## Gewijzigde bestanden

| Bestand | Wijziging |
|---|---|
| `src/components/storefront/ShopLayout.tsx` | Vervang `--shop-*` variabelen door Tailwind variabelen overschrijving via inline styles op wrapper div. Voeg hex-naar-HSL utility toe. Verwijder de `document.documentElement` manipulatie. |

Dit is een gerichte fix in een enkel bestand. Doordat we de Tailwind variabelen overschrijven, werken alle bestaande componenten (ProductCard, headers, footer, buttons, badges) automatisch met de thema-kleuren zonder dat ze individueel aangepast hoeven te worden.
