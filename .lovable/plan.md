
# Per-Tenant Meta/Social Credentials (niet hardcoden!)

## Het probleem

De huidige `social-oauth-init` en `social-oauth-callback` edge functions zoeken naar globale environment secrets (`FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`). In een multi-tenant SaaS als Sellqo is dat fundamenteel fout: elke tenant heeft zijn eigen Meta Developer App en dus eigen credentials.

## De oplossing

Credentials per tenant opslaan in de database en de OAuth edge functions aanpassen om deze uit de database te lezen in plaats van uit globale secrets.

## Wijzigingen

### 1. Database: nieuwe tabel `tenant_oauth_credentials`

Een tabel waarin elke tenant zijn eigen OAuth credentials opslaat per platform:

```text
tenant_oauth_credentials
- id (UUID, PK)
- tenant_id (UUID, FK -> tenants)
- platform (text: 'facebook', 'twitter', 'linkedin')
- client_id (text, encrypted)
- client_secret (text, encrypted)
- is_active (boolean, default true)
- created_at / updated_at
- UNIQUE(tenant_id, platform)
```

Met RLS policies zodat alleen tenant admins hun eigen credentials kunnen beheren.

### 2. Admin UI: Credentials invulscherm

Nieuw bestand: `src/components/admin/marketplace/SocialCredentialsForm.tsx`

- Een formulier per platform (Facebook/Meta, Twitter, LinkedIn) waar de tenant zijn App ID en App Secret kan invoeren
- Wordt getoond in de marketplace/social settings pagina
- Duidelijke uitleg waar ze de credentials kunnen vinden (link naar developers.facebook.com etc.)
- Secret wordt gemaskeerd na opslaan (alleen eerste/laatste 4 tekens zichtbaar)

### 3. Edge function: `social-oauth-init` aanpassen

In plaats van:
```
const clientId = Deno.env.get('FACEBOOK_CLIENT_ID');
```

Wordt het:
```
const { data: creds } = await supabase
  .from('tenant_oauth_credentials')
  .select('client_id, client_secret')
  .eq('tenant_id', tenantId)
  .eq('platform', platform)
  .eq('is_active', true)
  .single();
```

De edge function leest de credentials uit de database op basis van de `tenantId` die meegegeven wordt.

### 4. Edge function: `social-oauth-callback` aanpassen

Zelfde aanpassing: bij het token exchange worden de `client_id` en `client_secret` opgehaald uit `tenant_oauth_credentials` via de `tenant_id` die in de `oauth_states` tabel staat.

### 5. WhatsApp Connect Wizard

Nieuw bestand: `src/components/admin/marketplace/WhatsAppConnectWizard.tsx`

Een aparte koppelwizard voor WhatsApp Business:
- Stap 1: Check of de tenant Meta credentials heeft ingevuld (zo niet, doorverwijzen naar credentials-formulier)
- Stap 2: Start de Meta WhatsApp Embedded Signup flow (popup) met de tenant's eigen credentials
- Stap 3: Bevestiging en telefoonnummer opslaan

### 6. SocialChannelList aanpassen

- WhatsApp uit `META_COMMERCE_CHANNELS` halen
- Bij klik op WhatsApp de `WhatsAppConnectWizard` openen
- Bij klik op Facebook/Instagram eerst checken of credentials zijn ingevuld

### 7. `social-oauth-init` WhatsApp platform toevoegen

WhatsApp-specifieke scopes toevoegen (`whatsapp_business_management`, `whatsapp_business_messaging`).

## Technische details

- Credentials worden opgeslagen in de database met RLS, niet als globale secrets
- De `social-oauth-init` en `social-oauth-callback` edge functions lezen credentials per tenant uit de `tenant_oauth_credentials` tabel
- De MetaShopWizard toont een waarschuwing als er nog geen credentials zijn ingesteld en linkt naar het instellingenscherm
- De WhatsApp wizard is een apart component met een eigen flow, los van de Facebook Commerce wizard
- Geen globale secrets meer nodig voor Meta OAuth
