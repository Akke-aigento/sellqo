

# Berichten-tabblad toevoegen aan SellQo Connect

## Wat verandert

Een vierde tabblad **"Berichten"** wordt toegevoegd aan de SellQo Connect pagina. Dit tabblad toont alle kanalen waarmee klanten direct berichten kunnen sturen naar je inbox, los van de Shop- en Autopost-flows.

## Kanalen in het Berichten-tabblad

| Kanaal | Status | Koppelmethode |
|--------|--------|---------------|
| Facebook Messenger | Beschikbaar | Facebook OAuth (bestaande flow) |
| Instagram DM's | Beschikbaar | Facebook OAuth (bestaande flow) |
| WhatsApp Business | Beschikbaar | WhatsApp Embedded Signup (bestaande wizard) |
| Telegram Business | Binnenkort | Bot token invoer (coming soon) |
| Live Chat | Binnenkort | Configuratie (coming soon) |

## Layout

```text
Berichten-tabblad:

+---------------------------+  +---------------------------+  +---------------------------+
| [FB icon] Facebook        |  | [IG icon] Instagram       |  | [WA icon] WhatsApp        |
| Messenger                 |  | Direct Messages           |  | Business                  |
|                           |  |                           |  |                           |
| Ontvang en beantwoord     |  | Ontvang en beantwoord     |  | Berichten en notificaties |
| Facebook berichten        |  | Instagram DM's            |  | via WhatsApp              |
|                           |  |                           |  |                           |
| [Verbinden]               |  | [Verbinden]               |  | [Verbinden]               |
+---------------------------+  +---------------------------+  +---------------------------+

+---------------------------+  +---------------------------+
| [TG icon] Telegram        |  | [Chat icon] Live Chat     |
| Business                  |  | Widget                    |
|                           |  |                           |
| Ontvang Telegram          |  | Chat widget voor je       |
| berichten in je inbox     |  | webshop                   |
|                           |  |                           |
| [Binnenkort]              |  | [Binnenkort]              |
+---------------------------+  +---------------------------+
```

## Technische details

### 1. Nieuw bestand: `src/components/admin/marketplace/MessagingChannelList.tsx`

- Toont kaarten voor alle 5 messaging-kanalen
- Facebook Messenger en Instagram DM's halen status op uit `meta_messaging_connections`
- WhatsApp haalt status op uit `social_channel_connections` (type `whatsapp_business`)
- Telegram en Live Chat worden getoond met een "Binnenkort" badge
- "Verbinden" voor FB/IG start de bestaande Facebook OAuth flow via `social-oauth-init`
- "Verbinden" voor WhatsApp opent de bestaande `WhatsAppConnectWizard`

### 2. Nieuw bestand: `src/hooks/useMetaMessagingConnections.ts`

- Query op `meta_messaging_connections` tabel voor de huidige tenant
- Returnt connecties per platform (facebook/instagram)
- Delete-mutatie voor ontkoppelen
- Helper: `getConnectionByPlatform(platform)`

### 3. Wijziging: `src/pages/admin/Marketplaces.tsx`

- TabsList uitbreiden van 3 naar 4 kolommen (`grid-cols-4`)
- Nieuw tabblad "Berichten" met `MessageCircle` icoon
- Import en render van `MessagingChannelList`
- Stats-rij: eventueel een "Berichten Kanalen" stat toevoegen

### 4. Bestaande componenten hergebruikt

- `WhatsAppConnectWizard` - wordt hergebruikt voor WhatsApp koppeling
- `social-oauth-init` edge function - wordt hergebruikt voor FB/IG messaging OAuth
- `meta_messaging_connections` tabel - data wordt al aangemaakt bij Facebook OAuth callback

### Geen database wijzigingen nodig

De `meta_messaging_connections` tabel en alle benodigde edge functions bestaan al. De WhatsApp-koppeling werkt al via de Social Commerce tab en wordt nu ook vanuit het Berichten-tabblad bereikbaar.
