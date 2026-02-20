
# Health Categorieën kaart full-width maken

## Wijziging

In `src/config/dashboardWidgets.ts` de `health-categories` widget aanpassen van `lg` naar `full` voor zowel `defaultSize` als `minSize`. Hierdoor wordt de kaart met de 6 pilaren (Bestellingen, Voorraad, Klantenservice, Betalingen, SEO, Compliance) over de volle breedte getoond, net zoals de Health Banner en Actie-items.

| Bestand | Wijziging |
|---------|-----------|
| `src/config/dashboardWidgets.ts` | `defaultSize: 'lg'` en `minSize: 'lg'` worden `'full'` |
