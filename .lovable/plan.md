

## Fix: Campagne blijft bestaan op Bol.com na verwijderen

### Root cause (twee bugs)

**Bug 1 — `push-bol-campaign` archive wordt nooit uitgevoerd**
In `push-bol-campaign/index.ts` regel 135: als `platform_campaign_id` bestaat EN `force_repush` is false, returnt de functie meteen met `already_pushed: true`. De `action === 'archive'` check staat op regel 183 — die wordt nooit bereikt. Het archiveren op Bol.com gebeurt dus nooit.

**Bug 2 — `ads-bolcom-manage` delete pauzeerd alleen, archiveert niet**
In `ads-bolcom-manage/index.ts` regel 271: bij delete wordt de campagne alleen op `PAUSED` gezet, niet op `ARCHIVED`. Gepauzeerde campagnes worden door de sync-functie gewoon weer bijgewerkt.

### Wijzigingen

| Bestand | Fix |
|---------|-----|
| `push-bol-campaign/index.ts` | Archive-check verplaatsen VÓÓR de "already pushed" early return (regel 135) |
| `ads-bolcom-manage/index.ts` | Bij `delete_campaign`: `PAUSED` → `ARCHIVED` wijzigen |

### Detail

**1. `push-bol-campaign/index.ts`**
Verplaats het archive-blok (regels 182-203) naar vóór regel 135. Zo wordt bij `action === 'archive'` de campagne direct gearchiveerd en returnt de functie, zonder geblokkeerd te worden door de `already_pushed` check.

**2. `ads-bolcom-manage/index.ts`**
Regel 273: wijzig `{ state: "PAUSED" }` naar `{ state: "ARCHIVED" }`. Zo wordt de campagne definitief gearchiveerd op Bol.com voordat lokale data verwijderd wordt.

### Geen database wijzigingen nodig

