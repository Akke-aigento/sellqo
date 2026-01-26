
# Complete Domein Integratie - 100% Afwerking

## Overzicht

Dit plan omvat alle verbeteringen om de domein-integratie volledig productierijp te maken met een optimale gebruikerservaring voor alle klanten.

---

## Huidige Status

| Component | Status |
|-----------|--------|
| Provider Detectie (18+ providers) | Gereed |
| Cloudflare API Token Flow | Gereed |
| Handmatige DNS Instructies | Gereed |
| GoDaddy/IONOS Auto-Connect Flag | Probleem - geen API flow |
| SSL/HTTPS Status Check | Ontbreekt |
| Progress Indicator UI | Ontbreekt |
| Foutafhandeling Edge Cases | Kan verbeterd |

---

## Verbeteringen

### 1. GoDaddy en IONOS Flags Corrigeren

De `detect-domain-provider` functie markeert GoDaddy en IONOS als `supports_auto_connect: true`, maar er is geen API flow voor geïmplementeerd. Dit misleidt gebruikers.

**Oplossing**: Zet `supports_auto_connect: false` voor deze providers totdat een echte API-integratie beschikbaar is.

**Wijziging in** `supabase/functions/detect-domain-provider/index.ts`:
```text
GoDaddy: supports_auto_connect: false
IONOS: supports_auto_connect: false
```

### 2. SSL/HTTPS Status Check

Na DNS propagatie moet SSL automatisch werken. Een actieve check geeft de gebruiker vertrouwen.

**Nieuwe Edge Function**: `check-domain-ssl/index.ts`

```text
Input: { domain: string }

Stappen:
1. Probeer HTTPS verbinding naar het domein
2. Controleer SSL certificaat geldigheid
3. Return status: 'active', 'pending', 'error'

Output: {
  ssl_active: boolean,
  ssl_issuer: string | null,
  ssl_expires_at: string | null,
  error?: string
}
```

### 3. Visuele Progress Indicator

Een stapsgewijze voortgangsindicator laat gebruikers precies zien waar ze staan.

**Nieuwe Component**: `DomainProgressSteps.tsx`

```text
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  ●──────●──────○──────○                                         │
│  Domein  DNS    SSL    Actief                                   │
│  ingevoerd geconfigureerd                                       │
│                                                                  │
│  Huidige stap: DNS Configuratie                                 │
│  De DNS records worden gecontroleerd...                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

Stappen:
1. Domein Ingevoerd - ✓ Domein is opgeslagen
2. DNS Geconfigureerd - ⏳ Wachten op DNS propagatie
3. SSL Actief - ○ Certificaat wordt aangevraagd na DNS
4. Domein Actief - ○ Je webshop is bereikbaar
```

### 4. Automatische Verificatie Polling

Na handmatige DNS configuratie, poll automatisch om de 30 seconden (max 5 minuten) om te controleren of DNS correct is.

**Wijziging in** `DomainSettings.tsx`:
- Voeg `useEffect` toe met interval polling
- Stop polling na succes of timeout
- Toon "Bezig met controleren..." animatie

### 5. Provider-Specifieke Instructies

Voor populaire providers, toon specifieke stap-voor-stap instructies.

**Providers met instructies**:
- TransIP (Nederland populair)
- Combell (België populair)  
- one.com
- Hostinger
- Versio

**Nieuwe Component**: `ProviderInstructions.tsx`

```text
┌─────────────────────────────────────────────────────────────────┐
│  📖 Instructies voor TransIP                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Log in op je TransIP controlepaneel                         │
│  2. Ga naar "Domeinen" → selecteer je domein                    │
│  3. Klik op "DNS" in het menu                                   │
│  4. Klik op "Nieuw record toevoegen"                            │
│  5. Voer de onderstaande records in                             │
│                                                                  │
│  [🔗 Ga naar TransIP]                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6. Verbeterde Foutafhandeling

Specifieke foutmeldingen voor veelvoorkomende problemen.

| Situatie | Huidige melding | Verbeterde melding |
|----------|-----------------|---------------------|
| A-record wijst naar ander IP | "Niet gevonden" | "Je A-record wijst naar {ip} maar moet naar 185.158.133.1 wijzen" |
| CNAME conflict | Geen | "Er staat een CNAME record op @. Verwijder deze eerst." |
| DNS nog niet gepropageerd | "Niet gevonden" | "DNS nog niet gepropageerd. Probeer het over 30 minuten opnieuw." |
| Domein bestaat niet | Geen | "Dit domein lijkt niet te bestaan. Controleer de spelling." |

### 7. Tenant Database Update

Voeg velden toe voor SSL tracking.

**Migratie**:
```sql
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ssl_status text DEFAULT 'pending';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ssl_checked_at timestamptz;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ssl_expires_at timestamptz;
```

---

## Bestandswijzigingen

| Bestand | Actie | Beschrijving |
|---------|-------|-------------|
| `supabase/functions/detect-domain-provider/index.ts` | Wijzigen | GoDaddy/IONOS flags corrigeren |
| `supabase/functions/check-domain-ssl/index.ts` | Nieuw | SSL status check |
| `src/components/admin/settings/DomainSettings.tsx` | Wijzigen | Progress indicator, polling, betere errors |
| `src/components/admin/settings/DomainProgressSteps.tsx` | Nieuw | Visuele stappen component |
| `src/components/admin/settings/ProviderInstructions.tsx` | Nieuw | Provider-specifieke instructies |
| `src/hooks/useDomainVerification.ts` | Wijzigen | SSL check functie, polling logica |
| `supabase/functions/verify-domain/index.ts` | Wijzigen | Betere foutmeldingen |
| `supabase/config.toml` | Wijzigen | Nieuwe function registreren |

---

## Implementatie Volgorde

1. **GoDaddy/IONOS Flags Fix** - Voorkomt verwarring bij gebruikers
2. **Database Migratie** - SSL velden toevoegen
3. **check-domain-ssl Edge Function** - SSL status check
4. **verify-domain Verbeteren** - Betere foutmeldingen
5. **DomainProgressSteps Component** - Visuele voortgang
6. **ProviderInstructions Component** - Provider-specifieke hulp
7. **DomainSettings Update** - Integratie van alle componenten
8. **useDomainVerification Update** - Polling en SSL functionaliteit

---

## Verwachte Gebruikerservaring Na Implementatie

```text
Scenario 1: Cloudflare Gebruiker
────────────────────────────────
1. Voert domein in → Provider gedetecteerd: Cloudflare
2. Volgt instructies voor API token
3. Klikt "Koppelen" → DNS automatisch geconfigureerd
4. Ziet progress: ✓ DNS → ⏳ SSL → ○ Actief
5. Na ~2 min: ✓ DNS → ✓ SSL → ✓ Actief
6. "Je domein is nu live!"

Scenario 2: TransIP Gebruiker  
────────────────────────────────
1. Voert domein in → Provider gedetecteerd: TransIP
2. Ziet specifieke TransIP instructies
3. Configureert DNS handmatig bij TransIP
4. Keert terug, klikt "DNS Controleren"
5. Automatische polling start
6. Progress updates: ⏳ DNS → ✓ DNS → ⏳ SSL → ✓ Actief
7. "Je domein is nu live!"

Scenario 3: Onbekende Provider
────────────────────────────────
1. Voert domein in → Provider: Onbekend
2. Ziet generieke DNS instructies
3. Configureert DNS bij provider
4. Klikt "DNS Controleren"
5. Zelfde flow als TransIP
```

---

## Technische Details

### SSL Check Implementatie

De `check-domain-ssl` functie maakt een HTTPS request naar het domein en parseert het certificaat:

```text
1. fetch(`https://${domain}`, { method: 'HEAD' })
2. Indien succes: SSL actief
3. Check headers voor certificaat info (indien beschikbaar)
4. Return status

Fallback: Als fetch faalt met SSL error, 
status = 'pending' (certificaat nog niet klaar)
```

### Polling Logica

```text
State Machine:
- START: Begin polling na "DNS Controleren" click
- POLLING: Check elke 30 seconden
- SUCCESS: Stop polling, update UI
- TIMEOUT: Stop na 5 minuten, toon "Probeer later opnieuw"
- ERROR: Stop polling, toon foutmelding
```

### Provider Instructies Data

Hardcoded instructies per provider in `ProviderInstructions.tsx`:

```text
PROVIDER_INSTRUCTIONS = {
  transip: {
    name: 'TransIP',
    url: 'https://my.transip.nl',
    steps: [
      'Log in op my.transip.nl',
      'Ga naar "Domeinen"',
      'Selecteer je domein',
      'Klik op "DNS"',
      ...
    ]
  },
  combell: { ... },
  ...
}
```

---

## Beveiliging

- SSL check gebruikt alleen HEAD requests (geen data transfer)
- Geen gevoelige informatie opgeslagen
- Rate limiting op check-domain-ssl (max 10 requests per minuut per tenant)
- API tokens worden nooit opgeslagen (bestaande implementatie)
