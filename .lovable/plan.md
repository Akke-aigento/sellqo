

## Per-Product Sync Velden Toggles — ✅ Geïmplementeerd

Granulaire controle over welke data gesynchroniseerd wordt per product (Prijs, Voorraad, Titel, Fulfillment, Verzendinfo) via expandable rows in de producttabel.

## Productbeheer Samenvoegen: Eén "Producten" Tab — ✅ Geïmplementeerd

De losse "Voorraad" tab, "Producten Synchroniseren" dialog-knop en de producten/voorraad sync-regels zijn samengevoegd in één geïntegreerde **"Producten" tab** binnen de Marketplace detail pagina.

### Wat er veranderd is
- **"Voorraad" tab → "Producten" tab**: Combineert sync instellingen (richting, frequentie, conflict-strategie), gekoppelde producten overzicht, en import/export functionaliteit in één tab.
- **Dialog-knop verwijderd**: "Producten Synchroniseren" knop uit de header verwijderd — alles zit nu inline in de Producten tab.
- **Sync Regels tab**: Producten en Voorraad kaarten vervangen door een deeplink "Beheer producten →" die direct naar de Producten tab navigeert.
- **Nieuwe component**: `BolProductSyncTab.tsx` bevat alle gecombineerde logica.
