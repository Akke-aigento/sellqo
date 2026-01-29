
# Shopify OAuth Koppeling - Mogelijke Oplossingen

## Achtergrond
De huidige Shopify-koppeling vereist dat gebruikers handmatig een Custom App aanmaken in Shopify Admin en de Access Token kopiëren. Dit is technisch correct maar gebruiksonvriendelijk.

## Optie A: OAuth Flow via Shopify Partners App (Aanbevolen)
Implementeer een echte "Inloggen met Shopify" flow zodat gebruikers gewoon hun Shopify inloggen en toestemming geven.

### Wat is nodig:
1. **Eenmalige setup voor jou (de app-eigenaar):**
   - Registreer bij Shopify Partners (gratis)
   - Maak een "Public App" aan met naam "SellQo Connector"
   - Configureer de benodigde API scopes (orders, products, inventory, etc.)
   - Voeg de Client ID en Client Secret toe als secrets

2. **Technische implementatie:**
   - Nieuwe edge function: `shopify-oauth-init` (start OAuth flow)
   - Nieuwe edge function: `shopify-oauth-callback` (verwerk autorisatie)
   - UI update: "Verbind met Shopify" knop die popup opent
   - Gebruiker logt in bij Shopify → geeft toestemming → klaar!

### Voordelen:
- Geen technische kennis nodig van gebruikers
- Zelfde flow als Facebook/Instagram koppeling
- Professionele uitstraling

### Nadelen:
- Jij moet eenmalig een Shopify Partners account aanmaken
- App moet door Shopify worden gereviewed voor publiek gebruik

---

## Optie B: Vereenvoudigde Custom App Flow (Snellere Oplossing)
Behoud de huidige aanpak maar maak deze gebruiksvriendelijker.

### Verbeteringen:
1. Stap-voor-stap wizard met screenshots
2. Direct link naar de juiste Shopify Admin pagina
3. Video tutorial embedded in de dialog
4. Kopieer-instructies met één-klik kopiëren

---

## Technische Details (Optie A)

### Edge Functions
```text
┌────────────────────────┐
│   User clicks          │
│   "Verbind Shopify"    │
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│ shopify-oauth-init     │
│ - Vraag store URL      │
│ - Build OAuth URL      │
│ - Redirect naar Shopify│
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│ Shopify Login Page     │
│ User authorizes app    │
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│ shopify-oauth-callback │
│ - Exchange code        │
│ - Save access token    │
│ - Redirect to app      │
└────────────────────────┘
```

### Database Updates
- Toevoegen aan `oauth_states` tabel: ondersteuning voor Shopify
- Opslaan in `marketplace_connections`: access_token wordt automatisch opgeslagen

### Benodigde Secrets
- `SHOPIFY_CLIENT_ID` - Van Shopify Partners
- `SHOPIFY_CLIENT_SECRET` - Van Shopify Partners

### Shopify Scopes
```
read_products, write_products
read_orders, write_orders  
read_inventory, write_inventory
read_customers
read_fulfillments, write_fulfillments
```

---

## Aanbeveling

**Start met Optie A** - dit geeft de beste gebruikerservaring en past bij de bestaande OAuth-flows voor sociale platformen.

### Actieplan:
1. Registreer bij [partner.shopify.com](https://partner.shopify.com) (gratis)
2. Maak een Public App aan genaamd "SellQo"
3. Geef mij de Client ID en Secret → ik implementeer de OAuth flow
4. Na testing: dien de app in voor Shopify review

Wil je hiermee doorgaan?
