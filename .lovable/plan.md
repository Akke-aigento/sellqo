
# Fix: Tekstkleur wordt niet correct overgenomen uit palette

## Probleem

De Color Palette Generator stuurt wel `background` en `text` kleuren mee naar `onApply`, maar de storefront-code in `ShopLayout.tsx` zet `--foreground` alleen als er een expliciete `text_color` in de thema-instellingen staat. Als die ontbreekt of niet wordt opgeslagen, valt de storefront terug op de standaard donkerblauwe kleur uit `index.css` (`212 52% 24%`), die onleesbaar is op donkere achtergronden.

Daarnaast is de `getContrastForeground` functie te simplistisch: hij geeft puur zwart of wit terug, zonder rekening te houden met de gekozen merkkleur.

## Oplossing (3 wijzigingen)

### 1. `ShopLayout.tsx` — Altijd een leesbare `--foreground` afleiden

Als er geen expliciete `text_color` is ingesteld, moet `deriveFromBackground` ook `--foreground` en `--popover-foreground` correct afleiden op basis van de achtergrondkleur. Nu doet hij dat alleen voor `--card-foreground` en `--muted-foreground`.

**Wijziging**: In de `deriveFromBackground` functie (regel 183-190) ook `--foreground` en `--popover-foreground` toevoegen als fallback. In de themeStyle builder (regel 234-239) de `text`-override ervoor laten gaan zodat een expliciete keuze altijd wint.

### 2. `ShopLayout.tsx` — `getContrastForeground` verbeteren

De huidige functie mist gamma-correctie bij de luminance-berekening (vergelijkt lineaire RGB in plaats van sRGB). Dit kan verkeerde keuzes opleveren bij midtone kleuren.

**Wijziging**: De `relativeLuminance` functie uit `src/lib/color-utils.ts` hergebruiken in plaats van de eigen berekening.

### 3. `ColorPaletteGenerator.tsx` — Zekerheid dat text/background altijd worden meegestuurd

De `onApply` callback stuurt al `background` en `text` mee, maar de ontvangende kant (ThemeCustomizer of settings) moet deze ook daadwerkelijk opslaan als `background_color` en `text_color`.

**Wijziging**: Verifier in `ThemeCustomizer.tsx` dat wanneer een palette wordt toegepast, `background_color` en `text_color` ook worden opgeslagen in de settings (niet alleen primary/secondary/accent).

## Technische details

### Gewijzigde bestanden

| Bestand | Wijziging |
|---------|-----------|
| `src/components/storefront/ShopLayout.tsx` | `deriveFromBackground` uitbreiden met `--foreground` fallback + `relativeLuminance` import gebruiken |
| `src/components/admin/storefront/ThemeCustomizer.tsx` | `onApply` handler van palette generator aanpassen zodat `background_color` en `text_color` worden opgeslagen |

### Logica flow na de fix

```text
Palette Generator genereert kleuren
  -> onApply({ primary, secondary, accent, background, text })
     -> ThemeCustomizer slaat ALLE 5 kleuren op (inclusief background_color en text_color)
        -> ShopLayout leest text_color -> zet --foreground
           OF als text_color ontbreekt:
           -> deriveFromBackground zet --foreground automatisch op basis van achtergrond luminantie
```
