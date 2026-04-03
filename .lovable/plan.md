

## Fix: Mobiele kaartweergave voor Bestellingen, Producten en Klanten

### Probleem

De drie overzichtspagina's (Bestellingen, Producten, Klanten) gebruiken tabellen die op mobiel buiten het viewport vallen. Eerder was er een kaart-gebaseerde weergave op mobiel die goed werkte, maar deze is verloren gegaan.

### Aanpak

Op alle drie pagina's: detecteer mobiel via `useIsMobile()`, en toon op mobiel een kaartlijst in plaats van de tabel. De tabel blijft op desktop/tablet.

**1. Orders.tsx — Mobiele order-kaarten**

- Import `useIsMobile`
- Binnen de orders-lijst: `isMobile ? <MobileOrderCards /> : <Table>...</Table>`
- Elke kaart toont: ordernummer, klantnaam, status-badge, totaalbedrag, datum
- Checkbox links, ⋮ menu rechts
- Klikbaar → navigate naar order detail

**2. Products.tsx — Mobiele product-kaarten**

- Zelfde patroon: `isMobile ? <MobileProductCards /> : <Table>...</Table>`
- Kaart toont: product-afbeelding (klein), naam, prijs, voorraad-badge
- Checkbox + ⋮ menu
- Klikbaar → navigate naar product edit

**3. Customers.tsx — Mobiele klant-kaarten**

- Zelfde patroon
- Kaart toont: initiaal-avatar, naam, email, bron-badge, bestellingen-count, totaal uitgegeven
- Klikbaar → navigate naar klant detail

### Kaart-stijl

Consistent patroon over alle drie pagina's:
- `Card` component met `p-3` padding
- Flex-layout met info links, status/bedrag rechts
- Subtiele border, hover-effect
- Compact maar leesbaar

### Bestanden

| Bestand | Actie |
|---|---|
| `src/pages/admin/Orders.tsx` | Mobiele kaartweergave toevoegen naast tabel |
| `src/pages/admin/Products.tsx` | Mobiele kaartweergave toevoegen naast tabel |
| `src/pages/admin/Customers.tsx` | Mobiele kaartweergave toevoegen naast tabel |

### Geen database wijzigingen nodig

