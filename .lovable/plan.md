

# Cloudflare API Token Integratie

## Overzicht

Klanten maken zelf een Cloudflare API Token aan met de juiste permissies en voeren deze in bij Sellqo. Sellqo gebruikt dit token om automatisch de DNS records te configureren.

---

## User Flow

```text
┌─────────────────────────────────────────────────────────────────┐
│  Provider gedetecteerd: Cloudflare                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ☁️ Automatisch Koppelen via API Token                          │
│                                                                  │
│  Stap 1: Maak een API Token aan in Cloudflare                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  1. Ga naar Cloudflare Dashboard → My Profile → API Tokens │ │
│  │  2. Klik op "Create Token"                                  │ │
│  │  3. Kies template "Edit zone DNS"                           │ │
│  │  4. Bij Zone Resources: selecteer je domein                 │ │
│  │  5. Klik "Continue to summary" → "Create Token"             │ │
│  │  6. Kopieer het token                                       │ │
│  │                                                              │ │
│  │  [🔗 Open Cloudflare API Tokens]                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Stap 2: Voer je API Token in                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  API Token: [••••••••••••••••••••••••••    ]               │ │
│  │                                                              │ │
│  │  [🔗 Koppelen]                                              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ─────────────────── OF ───────────────────                     │
│                                                                  │
│  [⚙️ Handmatig DNS configureren]                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technische Implementatie

### 1. Nieuwe Edge Function: `cloudflare-api-connect`

Vervangt de OAuth flow met een API token flow:

```text
Input: {
  tenant_id: string,
  domain: string,
  api_token: string
}

Stappen:
1. Valideer API token via Cloudflare API (GET /user/tokens/verify)
2. Lijst zones op waartoe token toegang heeft
3. Vind zone die matcht met domein
4. Voeg DNS records toe:
   - A @ → 185.158.133.1
   - A www → 185.158.133.1  
   - TXT _sellqo → sellqo-verify=<token>
5. Update tenant: domain_verified = true

Output: {
  success: boolean,
  records_created: number,
  error?: string
}
```

### 2. Database: Token Opslag

De API token wordt NIET permanent opgeslagen (beveiligingsrisico). Alleen:
- Eenmalig gebruikt voor DNS configuratie
- Na succesvolle configuratie wordt token weggegooid
- Klant moet nieuw token maken als ze later wijzigingen willen

### 3. UI Aanpassingen

Update `DomainSettings.tsx`:
- Nieuwe "API Token" input sectie voor Cloudflare
- Stapsgewijze instructies met link naar Cloudflare
- Foutafhandeling (ongeldige token, verkeerde permissies, domein niet gevonden)

---

## Bestandswijzigingen

| Bestand | Actie | Beschrijving |
|---------|-------|-------------|
| `supabase/functions/cloudflare-api-connect/index.ts` | Nieuw | Token validatie en DNS configuratie |
| `src/components/admin/settings/DomainSettings.tsx` | Wijzigen | API token input flow toevoegen |
| `src/hooks/useDomainVerification.ts` | Wijzigen | `connectWithApiToken` functie toevoegen |
| `supabase/functions/cloudflare-oauth-init/index.ts` | Verwijderen | Niet meer nodig |
| `supabase/functions/cloudflare-oauth-callback/index.ts` | Verwijderen | Niet meer nodig |
| `supabase/config.toml` | Wijzigen | OAuth functions verwijderen, nieuwe toevoegen |

---

## Cloudflare API Endpoints

```text
# Token verificatie
GET https://api.cloudflare.com/client/v4/user/tokens/verify
Headers: Authorization: Bearer <token>

# Zones ophalen
GET https://api.cloudflare.com/client/v4/zones
Headers: Authorization: Bearer <token>

# DNS record aanmaken
POST https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records
Headers: Authorization: Bearer <token>
Body: {
  "type": "A",
  "name": "@",
  "content": "185.158.133.1",
  "ttl": 1,
  "proxied": false
}
```

---

## Beveiliging

- Token wordt alleen server-side verwerkt (Edge Function)
- Token wordt NIET opgeslagen in database
- Token wordt niet gelogd
- HTTPS verplicht voor alle communicatie
- Token heeft minimale permissies (alleen DNS edit voor specifieke zone)

---

## Foutafhandeling

| Fout | Bericht aan gebruiker |
|------|----------------------|
| Token ongeldig | "Het API token is ongeldig. Controleer of je het volledige token hebt gekopieerd." |
| Geen toegang tot domein | "Dit token heeft geen toegang tot het domein. Selecteer het juiste domein bij 'Zone Resources'." |
| Verkeerde permissies | "Dit token mist de benodigde permissies. Gebruik de 'Edit zone DNS' template." |
| Domein niet in Cloudflare | "Dit domein wordt niet beheerd door Cloudflare. Gebruik de handmatige configuratie." |

---

## Implementatie Volgorde

1. **cloudflare-api-connect Edge Function** - Core functionaliteit
2. **useDomainVerification hook update** - `connectWithApiToken` functie
3. **DomainSettings.tsx update** - API token input UI
4. **OAuth functions verwijderen** - Cleanup oude code
5. **config.toml update** - Functions registratie

