

## Storefront API Keys beheer in Instellingen

### Wat ontbreekt

De `storefront_api_keys` tabel bestaat al in de database met kolommen: `id`, `tenant_id`, `key_hash`, `key_prefix`, `name`, `is_active`, `last_used_at`, `created_at`. Maar:

1. **Geen UI** — er is geen component om keys aan te maken, bekijken of verwijderen
2. **Geen generatie-logica** — er is geen edge function die een key genereert, hasht en opslaat

Het beleid (uit memory) is: alleen de SHA-256 hash + prefix (`sk_live_xxxx`) worden opgeslagen; de volledige key wordt éénmaal getoond.

### Aanpak

**1. Edge function: `generate-storefront-api-key`**

- Genereert een random key: `sk_live_` + 48 random hex chars
- Slaat SHA-256 hash + prefix (eerste 12 chars) op in `storefront_api_keys`
- Retourneert de volledige key éénmalig
- Auth check: alleen tenant owner/admin of platform admin

**2. Nieuw component: `StorefrontApiKeysManager.tsx`**

Gebaseerd op het bestaande `FulfillmentAPISettings` patroon:
- Lijst van bestaande keys (prefix, naam, status, laatst gebruikt)
- "Nieuwe key aanmaken" dialog met naam-invoer
- Na aanmaak: key tonen in een copieerbaar veld met waarschuwing "wordt slechts éénmaal getoond"
- Toggle active/inactive
- Verwijder key met bevestiging

**3. Integratie in `StorefrontSettings.tsx`**

- Toevoegen als nieuwe Card sectie binnen de Custom Frontend sectie (alleen zichtbaar als `use_custom_frontend` aan staat)
- Tussen de API Toegang alert en Tracking & Scripts

### Bestanden

| Bestand | Actie |
|---|---|
| `supabase/functions/generate-storefront-api-key/index.ts` | Nieuw — key generatie + hash opslag |
| `src/components/admin/storefront/StorefrontApiKeysManager.tsx` | Nieuw — UI voor key beheer |
| `src/components/admin/storefront/StorefrontSettings.tsx` | Import + render StorefrontApiKeysManager |

### Geen database wijzigingen nodig

De `storefront_api_keys` tabel is al volledig ingericht.

