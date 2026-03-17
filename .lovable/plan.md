

## Ontbrekende inbox-functionaliteit — overzicht en plan

Na het doorlopen van alle bestaande code (filters, acties, composer, detail-view, action sheets, folders, bulk-acties, AI-suggesties, multi-channel) zijn dit de features die een serieuze unified inbox nog mist:

### 1. Interne notities op gesprekken
Teamleden moeten opmerkingen kunnen achterlaten op een gesprek die de klant NIET ziet. Denk aan "Wacht op retourzending" of "Escalatie naar manager". Dit is standaard in elke helpdesk (Zendesk, Intercom, Freshdesk).

**Implementatie**: Nieuw veld `internal_notes` tabel (of hergebruik `customer_messages` met `direction: 'internal'`). In `ConversationDetail` een toggle "Notitie toevoegen" naast de reply composer. Notities tonen als gele/oranje bubbels in de tijdlijn.

### 2. Snelle antwoordsjablonen (Canned Responses)
Veelgestelde vragen beantwoorden met vooraf ingestelde templates. Bijv. "Uw bestelling is onderweg" of "Retourformulier". De ReplyComposer heeft al AI-suggesties, maar handmatige templates ontbreken.

**Implementatie**: Nieuwe tabel `message_templates` (tenant_id, name, body, channel, category). In de ReplyComposer een `/`-command of template-knop die een dropdown toont met beschikbare templates. Templates beheerbaar via een settings-pagina.

### 3. Gesprekken vastzetten (Pin/Star)
Belangrijke gesprekken bovenaan de lijst pinnen zodat ze niet wegzakken. Simpel maar essentieel voor prioritering.

**Implementatie**: Nieuw veld `is_pinned` op `customer_messages` (of een apart `pinned_conversations` tabel). Pinned gesprekken altijd bovenaan sorteren. Star-icoon in de conversation list + actie in action sheet.

### 4. Snooze / Herinnering
Een gesprek tijdelijk verbergen en op een bepaald moment terug laten komen. Bijv. "Herinner me morgen" of "Over 3 dagen". Dit is een killer-feature in moderne inboxen (Gmail, Front, Missive).

**Implementatie**: Nieuw veld `snoozed_until` op messages. Gesnoozde gesprekken filteren uit de inbox-query tot het moment verstreken is. Snooze-opties in action sheet en ConversationActions dropdown.

### 5. Klantinfo-sidebar in detail view
Wanneer je een gesprek opent, zie je nu alleen de header met naam/email. Een sidebar (of uitklapbaar paneel) met klantdetails, bestelgeschiedenis en eerdere gesprekken zou enorm helpen.

**Implementatie**: Nieuw component `CustomerInfoPanel` in de ConversationDetail. Op desktop als rechterzijbalk, op mobiel als uitklapbaar paneel. Toont: klantgegevens, recente bestellingen, eerdere gesprekken, tags.

---

### Aanbevolen prioriteit

| # | Feature | Impact | Complexiteit |
|---|---------|--------|-------------|
| 1 | Interne notities | Hoog (team samenwerking) | Medium |
| 2 | Snelle antwoordsjablonen | Hoog (efficiëntie) | Medium |
| 3 | Pin/Star gesprekken | Medium (organisatie) | Laag |
| 4 | Snooze | Medium (workflow) | Medium |
| 5 | Klantinfo-sidebar | Hoog (context) | Medium |

### Technische wijzigingen samengevat

| Wat | Database | UI |
|-----|----------|-----|
| Interne notities | Hergebruik `customer_messages` met `direction: 'internal'` | Gele bubbels in tijdlijn + notitie-toggle in composer |
| Templates | Nieuwe tabel `message_templates` | Template-picker in ReplyComposer + beheer in settings |
| Pin/Star | Nieuw veld `is_pinned` boolean op messages | Star-icoon in lijst + sorteer pinned bovenaan |
| Snooze | Nieuw veld `snoozed_until` timestamp op messages | Snooze-picker in actiemenu + filter in query |
| Klantinfo | Geen (leest bestaande data) | Nieuw `CustomerInfoPanel` component |

Wil je alles in één keer implementeren of stapsgewijs? Ik zou aanraden te beginnen met **Pin/Star** (laagste complexiteit, directe waarde) en **Interne notities** (hoogste impact voor teamwerk).

