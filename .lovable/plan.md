
# Fix Meta OAuth fout + WhatsApp eigen koppelflow

## Probleem 1: Meta OAuth geeft 400 error

De `social-oauth-init` edge function zoekt naar `FACEBOOK_CLIENT_ID` en `FACEBOOK_CLIENT_SECRET` secrets, maar deze zijn niet geconfigureerd. Hierdoor faalt elke poging om Facebook Shop, Instagram Shop of WhatsApp te verbinden.

**Oplossing:** De Meta App credentials moeten worden toegevoegd als secrets. Hiervoor heb je een Meta (Facebook) Developer App nodig op https://developers.facebook.com. De benodigde gegevens zijn:
- App ID (= Client ID)
- App Secret (= Client Secret)

## Probleem 2: WhatsApp koppelen via eigen flow (niet via Facebook login)

WhatsApp Business hoort niet via dezelfde Facebook Commerce wizard te gaan. De WhatsApp Business API biedt een **Embedded Signup** flow, waarbij de gebruiker een QR-code scant of inlogt via WhatsApp Web.

### Wijzigingen

#### 1. Secrets toevoegen
- `FACEBOOK_CLIENT_ID` - Je Meta App ID
- `FACEBOOK_CLIENT_SECRET` - Je Meta App Secret

Dit lost direct de 400 error op voor Facebook Shop en Instagram Shop.

#### 2. Nieuw bestand: `src/components/admin/marketplace/WhatsAppConnectWizard.tsx`

Een apart koppelscherm voor WhatsApp Business met:
- **Stap 1:** Uitleg over de koppeling (je hebt een WhatsApp Business Account nodig)
- **Stap 2:** WhatsApp Business telefoonnummer invoeren
- **Stap 3:** Verificatie via de Meta WhatsApp Embedded Signup flow (popup)
- **Stap 4:** Bevestiging en configuratie

Dit gebruikt de Meta WhatsApp Business Platform API maar presenteert het als een WhatsApp-specifieke ervaring (geen Facebook-branding).

#### 3. Bestand aanpassen: `src/components/admin/marketplace/SocialChannelList.tsx`

- `whatsapp_business` uit de `META_COMMERCE_CHANNELS` array halen
- Nieuwe `WHATSAPP_CHANNELS` array toevoegen
- Bij klik op "Verbind WhatsApp Business" de `WhatsAppConnectWizard` openen in plaats van de `MetaShopWizard`

#### 4. Bestand aanpassen: `supabase/functions/social-oauth-init/index.ts`

- Een `whatsapp` platform config toevoegen met de juiste WhatsApp Embedded Signup scopes (`whatsapp_business_management`, `whatsapp_business_messaging`)
- De OAuth URL wijzen naar de WhatsApp Embedded Signup endpoint

## Technische details

- WhatsApp Business Platform gebruikt dezelfde Meta Graph API onder de motorkap, maar de gebruikerservaring is anders
- De Embedded Signup flow opent een Meta popup waar de gebruiker specifiek WhatsApp Business koppelt (niet Facebook)
- Na de koppeling slaan we het WhatsApp Business Account ID en telefoonnummer op in `social_channel_connections`
- De bestaande `send-whatsapp-message` edge function wordt hergebruikt voor berichtverzending
- Facebook Shop en Instagram Shop blijven via de bestaande MetaShopWizard werken (zodra de secrets zijn ingesteld)
