

## Fix: Bol.com Retouren Pagina Niet Gevonden

### Waarschijnlijke oorzaak

De `MarketplaceDetailPage` (`/admin/connect/:connectionId`) laadt de connectie via `useMarketplaceConnection(connectionId)`. Als deze query faalt of `null` retourneert, toont de pagina: **"Connectie niet gevonden"** — wat lijkt op "pagina niet gevonden".

Mogelijke redenen:
- De `marketplace_connections` query wordt geblokkeerd door RLS-policies (de detail-query filtert **niet op tenant_id**, terwijl de lijst-query dat wél doet)
- De connection `is_active` staat op `false` waardoor `getConnectionByType` in de Marketplaces pagina `undefined` retourneert → `handleSettings` navigeert nergens heen

### Oplossing

**1. `useMarketplaceConnection` hook verbeteren** (`src/hooks/useMarketplaceConnections.ts`)
- Tenant context meegeven aan de query zodat RLS geen probleem is
- Error logging toevoegen zodat de oorzaak zichtbaar is in de console

**2. `MarketplaceDetailPage` — betere foutafhandeling** (`src/pages/admin/MarketplaceDetail.tsx`)
- Bij "Connectie niet gevonden": toon een duidelijkere foutmelding met de daadwerkelijke error
- Console error loggen als de query faalt, zodat we de exacte oorzaak kunnen zien

**3. Directe deep-link naar Retouren tab** (`src/pages/admin/Marketplaces.tsx`)
- `activeTab` state initialiseren vanuit URL query parameter (bijv. `?tab=returns`)
- Vanuit de MarketplaceCard een "Retouren" snelkoppeling toevoegen voor verbonden Bol.com die navigeert naar `/admin/connect/:id?tab=returns`

**4. `MarketplaceDetailPage` — tab uit URL lezen**
- `activeTab` initialiseren vanuit `?tab=` search parameter i.p.v. hardcoded `'overview'`
- Zo werken deep-links naar specifieke tabs

### Bestanden

| Bestand | Wijziging |
|---|---|
| `src/hooks/useMarketplaceConnections.ts` | Tenant-aware detail query + error logging |
| `src/pages/admin/MarketplaceDetail.tsx` | Tab uit URL lezen + betere error state |

