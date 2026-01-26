
# Custom Domain Configuratie Plan

## Samenvatting

De database structuur voor custom domains is al aanwezig (`custom_domain`, `domain_verified`, `domain_verification_token` in de tenants tabel), maar er ontbreekt:
1. Een invoerformulier voor het configureren van een domein
2. DNS verificatie logica (Edge Function)
3. SSL certificaat provisioning
4. Integratie met het bestaande feature gating systeem

---

## Huidige Status

| Component | Status | Notities |
|-----------|--------|----------|
| Database velden | Aanwezig | `custom_domain`, `domain_verified`, `domain_verification_token` |
| Feature gating | Aanwezig | `customDomain` feature in pricing_plans (Starter+) |
| DNS instructies UI | Aanwezig | Hardcoded in StorefrontSettings.tsx |
| Invoerformulier | Ontbreekt | Verwezen naar "Instellingen → Algemeen" maar niet aanwezig |
| Verificatie logica | Ontbreekt | Geen Edge Function voor DNS check |
| SSL provisioning | Ontbreekt | Geen automatische certificaat aanvraag |

---

## Implementatie

### 1. Domain Settings Component

Een nieuwe component `DomainSettings.tsx` in de Settings pagina die:
- Toont of de feature beschikbaar is (via FeatureGate)
- Input veld voor het invoeren van een custom domein
- Validatie van domein formaat (regex check)
- Genereren van een uniek verification token
- Opslaan naar de tenants tabel

### 2. DNS Verificatie Edge Function

Een nieuwe Edge Function `verify-domain` die:
- DNS lookup doet naar het opgegeven domein
- Controleert of het A-record naar het juiste IP wijst (185.158.133.1)
- Controleert op een TXT-record met het verificatie token
- Update `domain_verified` naar `true` bij succes
- Retourneert gedetailleerde status informatie

### 3. Uitbreiding StoreSettings

De bestaande BusinessSettings of StoreSettings uitbreiden met:
- Een "Domein" sectie met FeatureGate wrapper
- Input voor custom_domain
- Status indicator (pending/verified/failed)
- Kopieerbare DNS instructies
- "Verifieer Nu" knop die de Edge Function aanroept
- Optie om domein te verwijderen

### 4. Storefront Routing Update

De storefront moet herkennen wanneer het via een custom domain wordt bezocht:
- Middleware/routing logica toevoegen
- Tenant lookup op basis van custom_domain
- Redirect logica voor www vs non-www

---

## Technische Details

### Database (geen wijzigingen nodig)
De benodigde kolommen bestaan al:
```sql
custom_domain TEXT,
domain_verified BOOLEAN DEFAULT false,
domain_verification_token TEXT
```

### Nieuwe Edge Function: `verify-domain`

```text
Input:
  - tenant_id: string
  - domain: string (optioneel, voor initiële check zonder opslaan)

Stappen:
  1. Haal tenant op uit database
  2. Krijg custom_domain en domain_verification_token
  3. DNS lookup:
     - Resolve A-record voor domain
     - Resolve TXT-record voor _sellqo.domain
  4. Valideer:
     - A-record moet 185.158.133.1 zijn
     - TXT-record moet "sellqo-verify=<token>" bevatten
  5. Bij succes: update domain_verified = true
  6. Return status object

Output:
  {
    success: boolean,
    a_record_valid: boolean,
    txt_record_valid: boolean,
    current_a_record: string | null,
    current_txt_record: string | null,
    error?: string
  }
```

### Nieuwe Component: `DomainSettings.tsx`

```text
UI Flow:
┌──────────────────────────────────────────────────────────────┐
│ Eigen Domein                                    [Starter+] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌─ Stap 1: Domein invoeren ─────────────────────────────┐   │
│ │                                                        │   │
│ │ Domein: [www.mijnwebshop.be                    ]      │   │
│ │                                                        │   │
│ │ [Domein Koppelen]                                     │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                              │
│ ┌─ Stap 2: DNS Records Configureren ─────────────────────┐   │
│ │                                                        │   │
│ │ Voeg deze records toe bij je domeinprovider:          │   │
│ │                                                        │   │
│ │ Type: A    | Name: @   | Value: 185.158.133.1    [📋] │   │
│ │ Type: A    | Name: www | Value: 185.158.133.1    [📋] │   │
│ │ Type: TXT  | Name: _sellqo | Value: sellqo-verify=... │   │
│ │                                                        │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                              │
│ ┌─ Stap 3: Verificatie ──────────────────────────────────┐   │
│ │                                                        │   │
│ │ Status: ⏳ Wacht op DNS propagatie                    │   │
│ │                                                        │   │
│ │ A-record:   ❌ Niet gevonden (kan tot 48u duren)      │   │
│ │ TXT-record: ❌ Niet gevonden                          │   │
│ │                                                        │   │
│ │ [🔄 Opnieuw Controleren]                              │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                              │
│ [🗑️ Domein Verwijderen]                                     │
└──────────────────────────────────────────────────────────────┘
```

### Aanpassingen Bestaande Bestanden

**Settings.tsx**
- Nieuwe sectie "Domein" toevoegen aan de "Bedrijfsinformatie" groep

**StorefrontSettings.tsx**
- Verwijzing naar Settings → Domein updaten
- Direct link toevoegen naar de nieuwe domein instellingen

---

## Bestanden Overzicht

| Bestand | Actie | Beschrijving |
|---------|-------|-------------|
| `src/components/admin/settings/DomainSettings.tsx` | Nieuw | Hoofdcomponent voor domeinconfiguratie |
| `src/hooks/useDomainVerification.ts` | Nieuw | Hook voor verificatie status en acties |
| `supabase/functions/verify-domain/index.ts` | Nieuw | Edge Function voor DNS verificatie |
| `src/pages/admin/Settings.tsx` | Wijzigen | Domein sectie toevoegen |
| `src/components/admin/storefront/StorefrontSettings.tsx` | Wijzigen | Link naar domeininstellingen verbeteren |
| `supabase/config.toml` | Wijzigen | verify-domain function registreren |

---

## Belangrijke Overwegingen

### DNS Propagatie
- DNS wijzigingen kunnen tot 48 uur duren
- UI moet duidelijk communiceren dat dit normaal is
- Automatische polling overwegen (elke 5 min voor eerste 24 uur)

### SSL Certificaten
- Voor een volledig werkende oplossing is integratie met een CDN/proxy nodig
- Opties: Cloudflare, Vercel, of een eigen reverse proxy
- In eerste instantie: alleen DNS verificatie, SSL handmatig of via externe service

### Subdomein Support
- Ondersteuning voor zowel `example.com` als `www.example.com`
- Canonical URL configuratie voor SEO

### Feature Gating
- Alleen beschikbaar voor Starter plan en hoger
- FeatureGate component gebruiken voor UI bescherming
- Server-side check in Edge Function

---

## Implementatie Volgorde

1. **DomainSettings Component** - UI voor domein invoer en status
2. **useDomainVerification Hook** - State management en API calls
3. **verify-domain Edge Function** - DNS lookup en verificatie
4. **Settings.tsx Update** - Nieuwe sectie toevoegen
5. **StorefrontSettings Update** - Betere navigatie
6. **Polling Mechanisme** - Automatische verificatie checks
