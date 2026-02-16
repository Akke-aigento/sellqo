

# Fix: Auto-Accept & VVB Niet Werkend - Diagnose & Oplossing

## Gevonden Problemen

### Probleem 1: Edge function niet gedeployed
De logs tonen dat de **retry-code helemaal niet draait** -- er zijn nul logregels over "missed orders to retry". Dit betekent dat de versie van `sync-bol-orders` die nu live staat nog de OUDE versie is zonder retry-mechanisme. De code is wel geschreven maar niet gedeployed.

**Bewijs**: Na "Processed 0 new orders" springt de log direct naar "Sync completed" zonder enige retry-output.

### Probleem 2: Order werd geimporteerd door de oude code
De order `C0000WLM0F` heeft `sync_status: 'synced'` -- hij werd geimporteerd VOOR de auto-accept fix live ging. Bij elke volgende sync wordt hij overgeslagen met "already exists", en het retry-mechanisme draait niet omdat het niet gedeployed is.

### Probleem 3: VVB niet ingeschakeld in settings
De connectie-instellingen hebben `autoAcceptOrder: true` maar er is **geen `vvbEnabled`** veld. De gebruiker heeft deze instelling nog niet aangezet in het VVB-instellingenpaneel. Zelfs als de code perfect werkt, zal VVB niet getriggerd worden.

## Oplossing

### 1. Edge function herdeployen
De `sync-bol-orders` functie moet opnieuw gedeployed worden zodat de retry-code daadwerkelijk live gaat. Dit gebeurt automatisch bij een code-wijziging.

### 2. Kleine code-aanpassing voor robuustheid
Er is een potentieel probleem: de `accept-bol-order` functie accepteert de order bij Bol.com, maar de Bol.com API vereist dat de order items een `quantity` hebben. De huidige code haalt die uit `raw_marketplace_data`, maar als die structuur afwijkt kan het falen. 

Toevoegen: extra logging in het retry-pad zodat we precies zien wat er gebeurt, en een fallback als `raw_marketplace_data` geen `orderItems` bevat.

### 3. Directe retry-test triggeren
Na deployment, handmatig de sync triggeren via de UI (of via een functie-aanroep) om te verifiereren dat de retry het order `C0000WLM0F` oppakt en succesvol accepteert.

## Technische Details

### Gewijzigd bestand

| Bestand | Wijziging |
|---------|-----------|
| `supabase/functions/sync-bol-orders/index.ts` | Minimale wijziging (extra logline) om herdeployment te forceren + betere error logging in retry-pad |

### VVB Instelling
De gebruiker moet in de Bol.com koppeling-instellingen de VVB toggle aanzetten. Dit is een bestaand UI-element (BolVVBSettings component) maar het is momenteel uit. Na het aanzetten worden labels automatisch aangemaakt bij succesvolle auto-accept.

### Verwachte flow na fix

```text
Sync draait
  -> Order C0000WLM0F "already exists, skipping"
  -> 0 nieuwe orders verwerkt
  -> Retry-mechanisme start
     -> Vindt order met sync_status='synced'
     -> Roept accept-bol-order aan
     -> Succes -> sync_status wordt 'accepted'
     -> Als vvbEnabled=true -> roept create-bol-vvb-label aan
  -> Sync klaar
```

### Wat de gebruiker moet doen
Na de deployment: in de Bol.com koppeling-instellingen de "Verzenden via Bol (VVB)" toggle aanzetten als automatische labels gewenst zijn.
