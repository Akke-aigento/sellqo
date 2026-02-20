
# SellQo Connect vereenvoudigen: alles-in-een wizard per kanaal

## Probleem

De SellQo Connect pagina is momenteel versnipperd:
- 4 tabbladen (E-commerce, Social Commerce, Autopost, Berichten) met overlappende kanalen
- WhatsApp staat zowel bij Social Commerce als bij Berichten
- Facebook/Instagram staan bij Social Commerce (als Shop), bij Autopost (als posting), en bij Berichten (als Messenger/DM)
- Credentials moeten ergens anders ingevoerd worden (een pagina die niet eens bestaat)
- Gebruiker moet rondklikken tussen tabs en pagina's om 1 kanaal werkend te krijgen

## Oplossing: per kanaal een zelfstandige wizard

Elke kanaalkaart krijgt een "Verbinden" knop die een **complete wizard** opent. In die wizard wordt alles ter plekke afgehandeld:

1. **Credentials invoeren** (als ze nog niet bestaan) -- inline in de wizard
2. **OAuth autoriseren** (redirect naar Meta/Google/etc.)
3. **Configureren** wat je met dit kanaal wilt doen (shop sync, messaging, autoposting)

### Nieuwe tabblad-structuur (versimpeld)

De 4 tabbladen worden teruggebracht naar **2 tabbladen**:

| Tab | Inhoud |
|-----|--------|
| **Marktplaatsen** | Bol.com, Amazon, Shopify, WooCommerce, Odoo, eBay (blijft zoals het is) |
| **Kanalen** | Alle social/messaging kanalen in 1 overzicht |

Het "Kanalen" tabblad combineert Social Commerce, Autopost en Berichten. Per kanaalkaart zie je wat er actief is.

### Kanaalkaarten in het "Kanalen" tabblad

```text
+---------------------------+  +---------------------------+  +---------------------------+
| [Meta icon] Meta          |  | [Google icon] Google      |  | [WA icon] WhatsApp        |
| Facebook & Instagram      |  | Shopping                  |  | Business                  |
|                           |  |                           |  |                           |
| Actief:                   |  | Actief:                   |  | Actief:                   |
| - Facebook Shop           |  | - Product feed            |  | - Inbox berichten         |
| - Instagram DM's          |  |                           |  | - Catalogus               |
| - Autopost                |  |                           |  |                           |
|                           |  |                           |  |                           |
| [Instellingen] [Verbr.]   |  | [Verbinden]               |  | [Instellingen] [Verbr.]   |
+---------------------------+  +---------------------------+  +---------------------------+

+---------------------------+  +---------------------------+  +---------------------------+
| [X icon] X / Twitter      |  | [Pin icon] Pinterest      |  | [LI icon] LinkedIn        |
|                           |  |                           |  |                           |
| Actief:                   |  | Actief:                   |  | Actief:                   |
| - Autopost                |  | - Product Pins            |  | - Autopost                |
|                           |  |                           |  |                           |
| [Instellingen] [Verbr.]   |  | [Verbinden]               |  | [Verbinden]               |
+---------------------------+  +---------------------------+  +---------------------------+

+---------------------------+  +---------------------------+  +---------------------------+
| [TG icon] Telegram        |  | [Chat icon] Live Chat     |  | [MS icon] Microsoft       |
| Business                  |  | Widget                    |  | Shopping                  |
|                           |  |                           |  |                           |
| [Binnenkort]              |  | [Binnenkort]              |  | [Verbinden]               |
+---------------------------+  +---------------------------+  +---------------------------+
```

### De Meta wizard als voorbeeld

Wanneer je klikt op "Verbinden" bij Meta (Facebook & Instagram):

```text
Stap 1: Meta App Credentials
+---------------------------------------------+
|  Stap 1 van 3 - Credentials                 |
|                                              |
|  Om te verbinden heb je een Meta Developer   |
|  App nodig.                                  |
|                                              |
|  App ID:     [________________]              |
|  App Secret: [________________]              |
|                                              |
|  [Link: Open Meta Developer Portal]          |
|                                              |
|              [Volgende ->]                   |
+---------------------------------------------+

(Overgeslagen als credentials al bestaan)

Stap 2: Autoriseren
+---------------------------------------------+
|  Stap 2 van 3 - Autoriseren                 |
|                                              |
|  Je wordt doorgestuurd naar Facebook om      |
|  je account te autoriseren.                  |
|                                              |
|  [Verbind met Facebook ->]                   |
+---------------------------------------------+

Stap 3: Functies kiezen
+---------------------------------------------+
|  Stap 3 van 3 - Wat wil je gebruiken?       |
|                                              |
|  [x] Facebook Shop (catalogus sync)         |
|  [x] Instagram Shop (product tags)          |
|  [x] Facebook Messenger (inbox)             |
|  [x] Instagram DM's (inbox)                 |
|  [x] Autopost (AI social media posts)       |
|                                              |
|              [Voltooien]                     |
+---------------------------------------------+
```

## Technische wijzigingen

### Bestanden die aangepast worden

| Bestand | Wijziging |
|---------|-----------|
| `Marketplaces.tsx` | 4 tabs -> 2 tabs (Marktplaatsen + Kanalen). Verwijder imports van `SocialChannelList`, `SocialConnectionsManager`, `MessagingChannelList`. Importeer nieuw `UnifiedChannelList` component. |
| `UnifiedChannelList.tsx` (nieuw) | Eenvoudige grid met alle kanaalkaarten. Per kaart: icoon, naam, actieve functies, verbinden/instellingen knoppen. |
| `MetaConnectWizard.tsx` (nieuw) | Vervangt `MetaShopWizard` + `MessagingChannelList` Meta-logica + `SocialConnectionsManager` Meta-logica. 3 stappen: credentials -> OAuth -> functies kiezen. |
| `WhatsAppConnectWizard.tsx` | Aanpassen: credentials-stap toont inline formulier i.p.v. verwijzing naar niet-bestaande pagina. Functies-stap toevoegen (inbox, catalogus, notificaties). |
| `MessagingChannelList.tsx` | Wordt verwijderd -- functionaliteit zit nu in `UnifiedChannelList` |
| `SocialCredentialsForm.tsx` | `CredentialCard` component wordt geexporteerd zodat wizards het inline kunnen hergebruiken. De standalone `SocialCredentialsForm` wrapper blijft bestaan voor eventueel toekomstig gebruik. |

### Bestanden die NIET veranderen

- `social-oauth-init` edge function -- werkt al correct
- `social-oauth-callback` edge function -- blijft hetzelfde
- `meta-messaging-webhook` -- ongewijzigd
- `send-meta-message` -- ongewijzigd
- Database tabellen -- geen wijzigingen nodig
- `ConnectMarketplaceDialog` -- E-commerce tab blijft hetzelfde
- `MarketplaceCard` -- E-commerce tab blijft hetzelfde

### Data-structuur per kanaal

Het `UnifiedChannelList` component haalt data op uit 3 bronnen:
- `social_channel_connections` (shop sync, WhatsApp)
- `social_connections` (autopost OAuth tokens)
- `meta_messaging_connections` (FB Messenger, IG DM's)

Per kanaalkaart wordt een samenvatting getoond van welke functies actief zijn op basis van deze 3 tabellen.

### Kanaal-indeling

| Kanaalkaart | Mogelijke functies | Wizard |
|-------------|-------------------|--------|
| Meta (FB & IG) | Shop, Messenger, IG DM, Autopost | MetaConnectWizard |
| Google Shopping | Product feed | ConnectSocialChannelDialog (bestaand) |
| WhatsApp Business | Inbox, Catalogus, Notificaties | WhatsAppConnectWizard (aangepast) |
| X / Twitter | Autopost | Eenvoudige OAuth wizard |
| Pinterest | Product Pins feed | ConnectSocialChannelDialog (bestaand) |
| LinkedIn | Autopost | Eenvoudige OAuth wizard |
| Microsoft Shopping | Product feed | ConnectSocialChannelDialog (bestaand) |
| TikTok Shop | Coming soon | -- |
| Telegram | Coming soon | -- |
| Live Chat | Coming soon | -- |
| Snapchat | Coming soon | -- |
