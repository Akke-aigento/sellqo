
# Hybride Domain Koppeling - Automatisch + Handmatige Fallback

## Concept

Na het invoeren van een domein:
1. **Detecteer automatisch** welke provider het domein beheert
2. **Bied automatische koppeling** aan als de provider ondersteund wordt
3. **Fallback naar handmatig** als de provider niet ondersteund wordt of als de gebruiker dit verkiest

---

## User Flow

```text
┌─────────────────────────────────────────────────────────────────┐
│  Stap 1: Domein invoeren                                        │
│  ┌───────────────────────────────────────────────┐              │
│  │ mijnwebshop.be                                │ [Volgende]   │
│  └───────────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Detecteer       │
                    │ Provider        │
                    │ (Edge Function) │
                    └─────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
    ┌─────────────────────┐         ┌─────────────────────┐
    │ Provider Ondersteund │         │ Provider Onbekend   │
    │ (Cloudflare, etc.)   │         │                     │
    └─────────────────────┘         └─────────────────────┘
              │                               │
              ▼                               ▼
┌─────────────────────────────┐   ┌─────────────────────────────┐
│  "We detecteerden Cloudflare"│   │  Handmatige Configuratie    │
│                              │   │                             │
│  [🔗 Automatisch Koppelen]   │   │  DNS records tabel...       │
│                              │   │                             │
│  ─── of ───                  │   │  [Verifieer DNS]            │
│                              │   │                             │
│  [Handmatig configureren ▼]  │   │                             │
└─────────────────────────────┘   └─────────────────────────────┘
```

---

## Technische Implementatie

### 1. Provider Detectie Edge Function

**Nieuw bestand:** `supabase/functions/detect-domain-provider/index.ts`

Detecteert de DNS provider via:
- NS (nameserver) record lookup
- Bekende patterns matchen (cloudflare.com, ns.transip.nl, etc.)

```text
Input: { domain: "mijnwebshop.be" }

Output: {
  provider: "cloudflare" | "transip" | "combell" | "godaddy" | "unknown",
  provider_name: "Cloudflare" | "TransIP" | "Combell" | "GoDaddy" | "Onbekend",
  supports_auto_connect: true | false,
  connect_method: "cloudflare_oauth" | "domain_connect" | null
}
```

**Bekende providers:**
| Provider | NS Pattern | Auto Connect |
|----------|-----------|--------------|
| Cloudflare | *.ns.cloudflare.com | ✅ OAuth API |
| GoDaddy | *.domaincontrol.com | ✅ Domain Connect |
| TransIP | ns*.transip.nl | ❌ (API key vereist) |
| Combell | ns*.combell.net | ❌ |
| Versio | ns*.versio.nl | ❌ |
| one.com | ns*.one.com | ❌ |

### 2. Cloudflare OAuth Flow

**Nieuw bestand:** `supabase/functions/cloudflare-oauth-init/index.ts`
- Start OAuth flow met Cloudflare
- Redirect gebruiker naar Cloudflare login

**Nieuw bestand:** `supabase/functions/cloudflare-oauth-callback/index.ts`
- Ontvangt OAuth token
- Vindt de juiste zone (domein)
- Voegt DNS records automatisch toe
- Update tenant als geverifieerd

### 3. Aangepaste UI Flow

**Wijziging aan:** `DomainSettings.tsx`

Na het invoeren van een domein:
1. Call `detect-domain-provider` Edge Function
2. Toon resultaat met juiste opties

**Nieuwe state:**
```typescript
const [providerInfo, setProviderInfo] = useState<ProviderInfo | null>(null);
const [setupMethod, setSetupMethod] = useState<'auto' | 'manual' | null>(null);
```

### 4. Database Uitbreiding

```sql
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS 
  domain_provider TEXT,
  domain_auto_configured BOOLEAN DEFAULT false;
```

---

## UI Ontwerp

### Scenario A: Provider Ondersteund (Cloudflare)

```text
┌─────────────────────────────────────────────────────────────────┐
│ Eigen Domein                                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Domein: mijnwebshop.be                                         │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  ☁️  We detecteerden: Cloudflare                           │ │
│  │                                                             │ │
│  │  Je kunt automatisch koppelen via je Cloudflare account.   │ │
│  │                                                             │ │
│  │  [🔗 Inloggen bij Cloudflare]                              │ │
│  │                                                             │ │
│  │  Je wordt doorgestuurd naar Cloudflare om toegang te       │ │
│  │  verlenen. Wij voegen alleen de benodigde DNS records toe. │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  ⚙️  Liever handmatig configureren?                        │ │
│  │                                                             │ │
│  │  [Toon DNS instructies ▼]                                  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Scenario B: Provider Niet Ondersteund

```text
┌─────────────────────────────────────────────────────────────────┐
│ Eigen Domein                                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Domein: mijnwebshop.be                                         │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  ℹ️  Provider: Combell                                     │ │
│  │                                                             │ │
│  │  Voor Combell moet je de DNS records handmatig toevoegen.  │ │
│  │  Dit duurt ongeveer 5 minuten.                             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  DNS Records Configureren                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Type  │  Naam     │  Waarde            │                  │ │
│  │  A     │  @        │  185.158.133.1     │  [📋]            │ │
│  │  A     │  www      │  185.158.133.1     │  [📋]            │ │
│  │  TXT   │  _sellqo  │  sellqo-verify=... │  [📋]            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  [🔄 Controleer DNS Records]                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Bestanden Overzicht

| Bestand | Actie | Beschrijving |
|---------|-------|-------------|
| `supabase/functions/detect-domain-provider/index.ts` | Nieuw | NS lookup en provider detectie |
| `supabase/functions/cloudflare-oauth-init/index.ts` | Nieuw | Start Cloudflare OAuth |
| `supabase/functions/cloudflare-oauth-callback/index.ts` | Nieuw | Verwerk OAuth en configureer DNS |
| `src/components/admin/settings/DomainSettings.tsx` | Wijzigen | Hybride flow met auto-detectie |
| `src/hooks/useDomainVerification.ts` | Wijzigen | Provider detectie functie toevoegen |
| `supabase/config.toml` | Wijzigen | Nieuwe functions registreren |

---

## Secrets Nodig

Voor Cloudflare OAuth integratie:
- `CLOUDFLARE_CLIENT_ID` - OAuth client ID
- `CLOUDFLARE_CLIENT_SECRET` - OAuth client secret

Deze moeten aangevraagd worden bij Cloudflare als "Service Provider". Zonder deze secrets werkt alleen de handmatige flow.

---

## Implementatie Volgorde

1. **detect-domain-provider Edge Function** - Provider herkenning
2. **DomainSettings.tsx update** - Hybride UI met detectie
3. **useDomainVerification.ts update** - detectProvider functie
4. **Cloudflare OAuth functions** - Automatische koppeling (optioneel, vereist secrets)

---

## Belangrijke Punten

- **Handmatig blijft altijd werken** - Ook als OAuth faalt of provider onbekend is
- **Geen API keys nodig voor basis flow** - Provider detectie werkt via DNS lookup
- **Cloudflare OAuth is optioneel** - Kan later toegevoegd worden zodra credentials beschikbaar zijn
- **Uitbreidbaar** - Makkelijk om meer providers toe te voegen (Domain Connect, GoDaddy API, etc.)
