

## Velden afstemmen op SellQo "Verbinding & API" pagina

### Probleem
De huidige velden (Tenant Slug, Custom Domein, Supabase Project ID, Lovable Project Naam) komen niet overeen met wat de gebruiker ziet in de SellQo admin "Verbinding & API" pagina. Daar staan: **Frontend URL**, **API Base URL**, **Storefront API Key**, **Tenant ID**, **Webhook URL**.

Het veld "Supabase Project ID" is verwarrend — dat refereert naar het *externe* Lovable project, niet naar iets in SellQo.

### Oplossing

Herstructureer de configurator in **twee secties**:

**Sectie A — SellQo gegevens** (auto-filled via tenant selector):
- **Tenant ID** (was: Tenant Slug) — label matcht SellQo admin
- **Frontend URL** (was: Custom Domein) — label matcht SellQo admin
- **API Base URL** — nieuw veld, auto-filled als `https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/storefront-api` (altijd hetzelfde, read-only)
- **Storefront API Key** — nieuw optioneel veld, prefix zichtbaar uit `storefront_api_keys` tabel

**Sectie B — Lovable project gegevens** (handmatig):
- **Lovable Cloud Project ID** (was: Supabase Project ID) — met hulptekst: "Te vinden in je Lovable project → instellingen. Voorbeeld: jpnacppdutjnasmuikgp"
- **Project Naam** (was: Lovable Project Naam) — auto-filled met tenant naam maar bewerkbaar

### Wijziging: `src/pages/platform/CustomFrontendConfigurator.tsx`
1. Config interface uitbreiden met `apiBaseUrl` (auto-filled, read-only)
2. Labels en descriptions aanpassen naar SellQo terminologie
3. Twee visuele groepen maken (SellQo gegevens + Lovable gegevens)
4. `handleTenantSelect` vult ook `apiBaseUrl` automatisch in
5. `allFilled` check aanpassen — `apiBaseUrl` altijd ingevuld, `storefrontApiKey` optioneel

