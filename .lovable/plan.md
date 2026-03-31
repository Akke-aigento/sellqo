

## Analyse: Advertentiepagina — Fantoomknoppen & Functionaliteit

### Gevonden problemen

Na doorlichting van alle 5 componenten in `src/components/admin/ads/`:

#### Fantoomknoppen (doen letterlijk niets)

| Knop | Bestand | Regel | Probleem |
|---|---|---|---|
| **"Beheren"** bij gekoppeld platform | `PlatformConnections.tsx` | 166 | Geen onClick, geen link — doet niets |
| **"Bewerken"** in campagne dropdown | `CampaignCard.tsx` | 114-117 | Geen onClick — doet niets |
| **"Bekijk in [platform]"** in campagne dropdown | `CampaignCard.tsx` | 119-122 | Geen onClick/href — doet niets |
| **"Nieuwe Campagne"** op dashboard | `AdsDashboard.tsx` | 63 | Linkt naar `?tab=campaigns&action=new` maar query params worden nergens gelezen |

#### Incomplete wizard (4 van 6 stappen)

De CampaignWizard heeft alleen: Platform → Type → Budget → Review.
Ontbreekt: **Productselectie** en **Doelgroep/Segment targeting** — twee stappen die essentieel zijn voor een bruikbare campagne.

#### Geen echte integraties

- Connect/disconnect schrijft alleen naar de lokale `ad_platform_connections` tabel
- Geen OAuth flows, geen echte API calls naar Bol/Meta/Google/Amazon
- Stats (impressies, clicks, spend, ROAS) zijn altijd 0 — geen sync
- AI Suggesties sectie is volledig placeholder

### Voorgesteld plan

Aangezien echte platformintegraties (OAuth, API sync) een groot apart project zijn, focus ik op het **functioneel maken van wat er is** en het **verwijderen/labelen van wat niet werkt**:

**1. Fantoomknoppen fixen of verwijderen**

- **"Beheren"** → verwijderen (er is niets te beheren zonder echte integratie)
- **"Bewerken"** → koppelen aan een edit-flow: wizard heropenen met bestaande campagne-data pre-filled
- **"Bekijk in platform"** → verwijderen (geen echte platform_campaign_id zonder integratie)
- **"Nieuwe Campagne" link** op dashboard → `setActiveTab('campaigns')` + `showWizard` triggeren, of simpelweg direct naar de wizard navigeren

**2. Wizard uitbreiden met ontbrekende stappen**

- **Productselectie stap**: multi-select van bestaande producten (uit `useProducts`) met zoekfunctie
- **Doelgroep stap**: segment selectie uit bestaande `customer_segments` of handmatige audience config

Nieuwe flow: Platform → Type → **Producten** → **Doelgroep** → Budget → Review

**3. Campagne bewerken**

- `CampaignWizard` aanpassen om een `campaign` prop te accepteren voor edit-modus
- Pre-fill alle velden met bestaande data
- Bij submit: `updateCampaign` i.p.v. `createCampaign`

**4. "Coming soon" eerlijk communiceren**

- Meta, Google, Amazon platformkaarten: duidelijk "Binnenkort beschikbaar" (dit werkt al)
- AI Suggesties: label als "Beta" of verwijderen als het niet werkt
- Stats cards: toon "Geen data" i.p.v. allemaal nullen als er geen campagnes/sync is

### Bestanden

| Bestand | Wijziging |
|---|---|
| `CampaignCard.tsx` | "Bewerken" koppelen aan edit-flow, "Bekijk in platform" verwijderen |
| `PlatformConnections.tsx` | "Beheren" knop verwijderen |
| `CampaignWizard.tsx` | Edit-modus + productselectie stap + doelgroep stap toevoegen |
| `CampaignsList.tsx` | Edit-state beheren, query param `action=new` afhandelen |
| `AdsDashboard.tsx` | "Nieuwe Campagne" link fixen, lege stats beter tonen |

