
# DNS-verificatie voor gekoppelde domeinen

## Overzicht

Er bestaat al een volledig DNS-verificatiesysteem (edge functions, provider-detectie, Cloudflare auto-connect, SSL-check, progress stepper). Dit werkt echter alleen voor het oude enkele `tenants.custom_domain` veld. De nieuwe `tenant_domains` tabel heeft `dns_verified`, `verification_token` en `ssl_active` kolommen maar deze worden nog nergens gebruikt. Het plan is om de bestaande verificatie-infrastructuur te hergebruiken en te koppelen aan het multi-domain systeem.

## Wat er verandert

### 1. Edge function `verify-domain` aanpassen

De huidige edge function leest het domein uit `tenants.custom_domain`. Deze wordt uitgebreid zodat hij ook een `domain_id` parameter accepteert en dan het domein + token uit `tenant_domains` haalt. Bij succes wordt `tenant_domains.dns_verified` op `true` gezet in plaats van `tenants.domain_verified`.

### 2. Edge function `check-domain-ssl` aanpassen

Dezelfde aanpassing: accepteert een `domain_id` parameter en update `tenant_domains.ssl_active` bij succes.

### 3. Nieuwe hook `useDomainVerificationMulti`

Een nieuwe hook specifiek voor het multi-domain systeem, gebaseerd op de bestaande `useDomainVerification`. Per domein kan:
- DNS geverifieerd worden via de `verify-domain` edge function
- Provider gedetecteerd worden via `detect-domain-provider`
- Cloudflare auto-connect uitgevoerd worden
- SSL gecheckt worden via `check-domain-ssl`
- Automatische polling gestart worden (elke 30 sec, max 5 min)

### 4. `MultiDomainSettings` uitbreiden met verificatie-UI

De huidige eenvoudige tabel wordt uitgebreid. Wanneer een domein niet geverifieerd is, kan de gebruiker het uitklappen om:
- De benodigde DNS-records te zien (A-records naar 185.158.133.1, TXT-record met verificatietoken)
- Records te kopieren met een klik
- Provider-specifieke instructies te zien (hergebruikt bestaande `ProviderInstructions` component)
- "Controleer DNS" knop te gebruiken
- Voortgangsstappen te zien (hergebruikt bestaande `DomainProgressSteps` component)
- Cloudflare auto-connect te gebruiken indien gedetecteerd

### 5. Verbeterde statussen in de tabel

| Status | Conditie | Weergave |
|--------|----------|----------|
| DNS niet geverifieerd | `dns_verified = false` | Oranje badge |
| Geverifieerd | `dns_verified = true, ssl_active = false` | Groene badge |
| SSL actief | `dns_verified = true, ssl_active = true` | Groene badge + shield icoon |

## Technische details

### Bestanden die gewijzigd worden

| Bestand | Wijziging |
|---------|-----------|
| `supabase/functions/verify-domain/index.ts` | Support `domain_id` param, lees/schrijf naar `tenant_domains` |
| `supabase/functions/check-domain-ssl/index.ts` | Support `domain_id` param, update `tenant_domains.ssl_active` |
| `src/components/admin/settings/MultiDomainSettings.tsx` | Volledige verificatie-UI per domein met uitklapbaar paneel |

### Bestanden die aangemaakt worden

| Bestand | Beschrijving |
|---------|-------------|
| `src/hooks/useDomainVerificationMulti.ts` | Hook voor DNS-verificatie per domein uit `tenant_domains` |

### Bestaande bestanden die hergebruikt worden (ongewijzigd)

| Bestand | Gebruik |
|---------|--------|
| `src/components/admin/settings/DomainProgressSteps.tsx` | Progress stepper (DNS, SSL, Live) |
| `src/components/admin/settings/ProviderInstructions.tsx` | Provider-specifieke stap-voor-stap instructies |
| `supabase/functions/detect-domain-provider/index.ts` | Automatische provider-detectie |
| `supabase/functions/cloudflare-api-connect/index.ts` | One-click Cloudflare koppeling |

### Verificatiestroom per domein

```text
+------------------+     +-------------------+     +----------------+     +-----------+
| Domein           | --> | Provider          | --> | DNS Records    | --> | Controleer|
| toegevoegd       |     | gedetecteerd      |     | tonen          |     | DNS       |
+------------------+     +-------------------+     +----------------+     +-----------+
                          |                                                    |
                          | Cloudflare?                                        | Succes?
                          v                                                    v
                    +------------------+                              +-----------------+
                    | Auto-connect     |                              | dns_verified =  |
                    | via API token    |                              | true            |
                    +------------------+                              +-----------------+
                                                                           |
                                                                           v
                                                                    +------------------+
                                                                    | SSL check        |
                                                                    | ssl_active = true|
                                                                    +------------------+
```

### UI-ontwerp per domeinrij

Elke domeinrij in de tabel krijgt een uitklapbaar paneel (Collapsible) dat verschijnt wanneer de status wordt aangeklikt:

- **DNS-instructies**: kopieerbare records (A @ -> 185.158.133.1, A www -> 185.158.133.1, TXT _sellqo -> sellqo-verify=TOKEN)
- **Provider-detectie**: automatisch bij openen, toont specifieke instructies
- **Cloudflare optie**: als provider Cloudflare is, toon API token input voor auto-connect
- **Voortgangsbalk**: DomainProgressSteps component
- **Controleer DNS knop**: start verificatie + polling
- **Propagatie-waarschuwing**: melding dat DNS tot 48 uur kan duren
