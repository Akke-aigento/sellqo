
# Herdesign: Order Pagina & Navigatie Vereenvoudiging

## Huidige Situatie

De order-gerelateerde interface is verspreid over te veel aparte secties:

**Sidebar (onder "Bestellingen"):**
- Alle bestellingen
- Offertes
- Facturen
- Creditnota's
- Abonnementen

Plus een apart top-level item "Fulfillment".

**Order Detail Pagina - Rechterkolom (9 losse kaarten!):**
1. Acties (status selects)
2. Klant
3. Berichtenhistorie
4. Tracking Info
5. Bol.com Acties
6. Service Point
7. Verzendadres
8. Factuuradres
9. Factuur
10. Pakbon
11. Interne notities

Dit is inderdaad rommelig en overweldigend.

---

## Voorstel: Twee grote verbeteringen

### 1. Sidebar Navigatie Consolideren

**Huidige structuur:**
```text
Dagelijks
  +-- Dashboard
  +-- Gesprekken
  +-- Fulfillment          <-- apart item
  +-- Bestellingen
  |     +-- Alle bestellingen
  |     +-- Offertes
  |     +-- Facturen
  |     +-- Creditnota's
  |     +-- Abonnementen
  +-- Producten
  +-- Klanten
```

**Nieuwe structuur:**
```text
Dagelijks
  +-- Dashboard
  +-- Gesprekken
  +-- Bestellingen
  |     +-- Alle bestellingen
  |     +-- Fulfillment    <-- verplaatst naar hier
  |     +-- Facturen
  |     +-- Offertes
  +-- Producten
  +-- Klanten
```

Wijzigingen:
- **Fulfillment** wordt een sub-item onder Bestellingen (logischer, het hoort bij orders)
- **Creditnota's** wordt verwijderd als apart menu-item (toegankelijk via de factuurpagina zelf)
- **Abonnementen** wordt verwijderd als apart menu-item (toegankelijk via een tab op de orderpagina of via klantprofiel)
- Van 5 sub-items naar 4, en 1 minder top-level item

### 2. Order Detail Pagina Herstructureren

De 11 losse kaarten worden samengevoegd tot **4 overzichtelijke secties** via een tab-achtige opbouw in de rechterkolom:

**Linkerkolom (blijft grotendeels hetzelfde):**
- Orderregels + totalen
- Tijdlijn

**Rechterkolom - samengevoegde kaarten:**

**Kaart 1: "Acties & Status"** (bovenaan, compact)
- Orderstatus dropdown
- Betaalstatus dropdown
- "Markeer als betaald" knop (indien relevant)

**Kaart 2: "Klant & Adressen"** (gecombineerd)
- Klantinfo (naam, email, telefoon) + knoppen (Email, Profiel)
- Verzendadres en Factuuradres naast elkaar in 2 kolommen
- Service point info (indien van toepassing)
- Berichtenhistorie (compact, inklapbaar)

**Kaart 3: "Verzending & Tracking"** (gecombineerd)
- Tracking info (carrier, tracking nummer, link)
- Pakbon download knop
- Bol.com acties (indien van toepassing)

**Kaart 4: "Documenten & Notities"** (gecombineerd)
- Factuur sectie (nummer, status, PDF/UBL/Versturen knoppen)
- Interne notities (textarea + opslaan)

---

## Technische Wijzigingen

### Bestand 1: `src/components/admin/sidebar/sidebarConfig.ts`

- Fulfillment verplaatsen van top-level `dailyItems` naar child van `orders`
- Creditnota's en Abonnementen verwijderen uit sidebar children
- Volgorde aanpassen: Alle bestellingen > Fulfillment > Facturen > Offertes

### Bestand 2: `src/pages/admin/OrderDetail.tsx`

Volledige herstructurering van de rechterkolom:
- **Klant + Adressen**: Combineer klantinfo, verzendadres, factuuradres en service point in 1 kaart
- **Verzending**: Combineer tracking, pakbon en Bol.com acties
- **Documenten**: Combineer factuur en interne notities
- Gebruik `Separator` componenten binnen kaarten i.p.v. aparte kaarten
- Adressen in een 2-koloms grid layout

### Bestand 3: `src/components/admin/sidebar/sidebarConfig.ts` (WAREHOUSE_ALLOWED_ITEMS)

- Update `WAREHOUSE_ALLOWED_ITEMS` array om de nieuwe `fulfillment` child-id te reflecteren

---

## Resultaat

| Aspect | Voor | Na |
|--------|------|-----|
| Sidebar top-level items (Dagelijks) | 6 | 5 |
| Sidebar sub-items (Bestellingen) | 5 | 4 |
| Kaarten in rechterkolom orderdetail | 11 | 4 |
| Visuele rust | Overweldigend | Gestructureerd |

De pagina wordt compacter, logischer gegroepeerd, en minder scrollwerk nodig.
