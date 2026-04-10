

## Fix: Inconsistente verzendkosten in winkelwagen en checkout

### Probleem
De verzendkosten worden op 3 plekken anders getoond:

1. **CartDrawer** (slide-out panel): toont geen verzendkosten — alleen subtotaal. Dat is prima.
2. **ShopCart.tsx** (winkelwagen pagina, regel 67): `shipping = 5.95` — **HARDCODED placeholder**, nooit aangepast naar echte waarden
3. **ShopCheckout.tsx** (checkout pagina, regel 174): zelfde hardcoded `5.95`
4. **Storefront API**: berekent de echte verzendkosten (€8 bij Mancini) pas bij `checkout_shipping`

De screenshot toont de **custom frontend** (mancini-milano.lovable.app) die waarschijnlijk dezelfde fout bevat. Maar het kernprobleem zit in de ingebouwde storefront componenten.

### Oplossing

#### 1. ShopCart.tsx — Verwijder hardcoded shipping, toon "wordt berekend bij checkout"
- Verwijder de hardcoded `const shipping = 5.95`
- Toon subtotaal + tekst "Verzendkosten worden berekend bij het afrekenen"
- Totaal = alleen subtotaal (geen nep-verzendkosten optellen)

#### 2. ShopCheckout.tsx — Haal echte verzendmethodes op via Storefront API
- Bij de details-stap: toon "Verzendkosten worden berekend in de volgende stap" (zoals nu al deels gebeurt)
- Bij de payment-stap: haal `get_shipping_methods` op via de storefront API en toon de echte prijs
- Gebruik het resultaat van `checkout_start` dat al `available_shipping_methods` retourneert
- Update het totaal dynamisch op basis van de gekozen verzendmethode

#### 3. CartDrawer.tsx — Voeg informatieregel toe
- Voeg onder het subtotaal een kleine tekst toe: "Excl. verzendkosten" zodat klanten niet verrast worden

### Wijzigingen
| Bestand | Wat |
|---------|-----|
| `src/pages/storefront/ShopCart.tsx` | Verwijder hardcoded shipping, toon info-tekst |
| `src/pages/storefront/ShopCheckout.tsx` | Haal echte shipping op via API, toon dynamisch |
| `src/components/storefront/CartDrawer.tsx` | Voeg "excl. verzendkosten" tekst toe |

### Wat de klant ziet (na fix)
```text
CartDrawer:     Subtotaal €59,99 · "Excl. verzendkosten"
Winkelwagen:    Subtotaal €59,99 · "Verzendkosten bij afrekenen"  
Checkout stap 1: Subtotaal €59,99 · "Wordt berekend"
Checkout stap 2: Verzending €8,00 · Totaal €67,99
```

Geen edge function wijzigingen nodig — de API werkt al correct.

