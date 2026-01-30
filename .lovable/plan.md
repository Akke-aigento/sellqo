
# Plan: Geavanceerde Zoekfunctie voor Inbox

## Overzicht

Een uitgebreide zoekfunctionaliteit met globale zoekmodus, filter-opties en kanaal-specifieke zoekmogelijkheden.

---

## Huidige Situatie

| Aspect | Huidig Gedrag |
|--------|---------------|
| **Zoekbereik** | Alleen huidige map/folder |
| **Zoeklocatie** | Client-side op gefilterde resultaten |
| **Zoekvelden** | Naam, email, onderwerp, body (laatste bericht) |
| **Kanaalfilter** | Los van zoekfunctie |
| **Diepte** | Alleen laatste bericht per gesprek |

---

## Nieuwe Functionaliteit

### 1. Zoekbereik Opties

```text
┌─────────────────────────────────────────────────────┐
│ 🔍 [Zoek in gesprekken...                        ]  │
├─────────────────────────────────────────────────────┤
│ Zoek in:  ○ Huidige map  ● Alle mappen  ○ Overal   │
└─────────────────────────────────────────────────────┘
```

- **Huidige map**: Alleen in geselecteerde folder (standaard wanneer specifieke map actief)
- **Alle mappen**: Inbox + Archief + Custom folders (standaard wanneer geen specifieke map)
- **Overal**: Inclusief prullenbak

### 2. Kanaalfilters bij Zoeken

```text
┌─────────────────────────────────────────────────────┐
│ Kanalen:  ☑ Email  ☑ WhatsApp  ☑ Facebook  ☑ Insta │
└─────────────────────────────────────────────────────┘
```

- Multi-select checkboxes voor kanalen
- Onafhankelijk van de bestaande kanaal-tabs
- Alleen actief wanneer zoekterm is ingevuld

### 3. Zoekveld Specificatie

```text
┌─────────────────────────────────────────────────────┐
│ Zoek op:  ☑ Onderwerp  ☑ Inhoud  ☑ Afzender        │
└─────────────────────────────────────────────────────┘
```

- **Onderwerp**: `subject` veld
- **Inhoud**: `body_text` / `body_html`
- **Afzender**: `from_email` + klant naam

### 4. Tijdsperiode Filter

```text
┌─────────────────────────────────────────────────────┐
│ Periode:  [Afgelopen week ▼]                        │
│           ○ Afgelopen week                          │
│           ○ Afgelopen maand                         │
│           ○ Afgelopen 3 maanden                     │
│           ○ Alles                                   │
└─────────────────────────────────────────────────────┘
```

---

## Technische Implementatie

### Stap 1: Extended InboxFilters Type

Uitbreiden van het `InboxFilters` interface:

```typescript
// src/hooks/useInbox.ts
export interface SearchOptions {
  scope: 'current' | 'all' | 'everywhere'; // Huidige map, Alle, Overal (incl prullenbak)
  channels: FilterChannel[]; // Multi-select kanalen
  searchIn: {
    subject: boolean;
    content: boolean;
    sender: boolean;
  };
  period: 'week' | 'month' | '3months' | 'all';
}

export interface InboxFilters {
  channel: FilterChannel;
  status: 'all' | 'unread' | 'unanswered';
  search: string;
  folderId: string | null;
  searchOptions?: SearchOptions; // Nieuwe property
}
```

### Stap 2: Database Query Aanpassing

De zoekfunctie verplaatsen naar database-niveau voor betere performance:

```typescript
// useInbox.ts - Query aanpassing
if (filters.search && filters.searchOptions?.scope !== 'current') {
  // Globale zoekmodus: negeer folderId filter
  if (filters.searchOptions?.scope === 'everywhere') {
    // Geen message_status filter (inclusief deleted)
  } else {
    // Exclude deleted
    query = query.neq('message_status', 'deleted');
  }
}

// Kanaal filter bij zoeken
if (filters.search && filters.searchOptions?.channels?.length) {
  query = query.in('channel', filters.searchOptions.channels);
}

// Periode filter
if (filters.search && filters.searchOptions?.period !== 'all') {
  const periods = {
    week: 7,
    month: 30,
    '3months': 90,
  };
  const days = periods[filters.searchOptions.period];
  const since = new Date();
  since.setDate(since.getDate() - days);
  query = query.gte('created_at', since.toISOString());
}

// Text search met OR conditie (Supabase)
if (filters.search) {
  const { subject, content, sender } = filters.searchOptions?.searchIn ?? 
    { subject: true, content: true, sender: true };
  
  // Bouw OR query met ilike patterns
  let orConditions = [];
  if (subject) orConditions.push(`subject.ilike.%${filters.search}%`);
  if (content) orConditions.push(`body_text.ilike.%${filters.search}%`);
  if (sender) orConditions.push(`from_email.ilike.%${filters.search}%`);
  
  query = query.or(orConditions.join(','));
}
```

### Stap 3: UI Componenten

**Nieuwe component: `AdvancedSearchFilters.tsx`**

Een uitklapbaar paneel dat verschijnt zodra de gebruiker begint met zoeken:

```text
Zoekterm getypt → Toon geavanceerde filters
Zoekterm leeg → Verberg geavanceerde filters
```

Layout:
```text
┌────────────────────────────────────────────────────────┐
│ 🔍 [Zoekterm hier...                              ] X  │
├────────────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐ ┌─────────────────┐  │
│ │ Zoek in: ▼   │ │ Kanalen: ▼   │ │ Periode: ▼     │  │
│ │ Alle mappen  │ │ 4 geselecteerd│ │ Alles          │  │
│ └──────────────┘ └──────────────┘ └─────────────────┘  │
├────────────────────────────────────────────────────────┤
│ Zoek op: ☑ Onderwerp  ☑ Inhoud  ☑ Afzender            │
└────────────────────────────────────────────────────────┘
```

---

## Bestanden te Wijzigen/Maken

| Bestand | Actie | Beschrijving |
|---------|-------|--------------|
| `src/hooks/useInbox.ts` | Wijzigen | Extended types + database query logica |
| `src/components/admin/inbox/InboxFilters.tsx` | Wijzigen | Zoekbalk + trigger voor geavanceerde filters |
| `src/components/admin/inbox/AdvancedSearchFilters.tsx` | **Nieuw** | Filter dropdowns en checkboxes |
| `src/components/admin/inbox/index.ts` | Wijzigen | Export toevoegen |

---

## UX Flow

```text
1. Gebruiker typt zoekterm
   ↓
2. Geavanceerde filters worden zichtbaar (geanimeerd)
   ↓
3. Standaard: "Alle mappen" + alle kanalen + alle velden
   ↓
4. Gebruiker past filters aan (optioneel)
   ↓
5. Resultaten updaten real-time
   ↓
6. Bij klikken op resultaat → navigeer naar gesprek
   ↓
7. Zoekterm wissen → terug naar normale view
```

---

## Visueel Voorbeeld

Gesloten staat (geen zoekterm):
```text
┌──────────────────────────────────┐
│ 🔍 Zoek in gesprekken...         │
├──────────────────────────────────┤
│ [Alle] [Email] [Social ▼]        │
├──────────────────────────────────┤
│ [Alle] [Ongelezen] [Te beantw.]  │
└──────────────────────────────────┘
```

Open staat (met zoekterm):
```text
┌──────────────────────────────────┐
│ 🔍 retour                     ✕  │
├──────────────────────────────────┤
│ Zoek in    Kanalen     Periode   │
│ [Alles ▼]  [4 ▼]       [Alles ▼] │
├──────────────────────────────────┤
│ ☑ Onderwerp ☑ Inhoud ☑ Afzender  │
├──────────────────────────────────┤
│ 📧 Retour aanvraag - jan@...     │
│ 💬 Over mijn retour - lisa@...   │
│ 📧 RE: Retourlabel - piet@...    │
└──────────────────────────────────┘
```

---

## Technische Details

### Database Performance

Voor betere zoekperformance kan later een full-text search index worden toegevoegd:

```sql
-- Optionele optimalisatie (kan later)
CREATE INDEX idx_customer_messages_search 
ON customer_messages 
USING gin(to_tsvector('dutch', coalesce(subject, '') || ' ' || coalesce(body_text, '')));
```

### Default Zoekgedrag

| Situatie | Standaard Scope |
|----------|-----------------|
| Geen map geselecteerd (inbox) | Alle mappen (excl. prullenbak) |
| Specifieke map geselecteerd | Huidige map |
| Gebruiker wijzigt scope handmatig | Onthouden tot zoekterm leeg |

---

## Samenvatting Nieuwe Features

1. **Globale zoekmodus** - Zoek over alle mappen tegelijk
2. **Kanaal multi-select** - Filter op Email, WhatsApp, Facebook, Instagram
3. **Zoekveld keuze** - Onderwerp, Inhoud, of Afzender
4. **Tijdsperiode filter** - Week, maand, 3 maanden, of alles
5. **Slimme defaults** - Automatisch "alle mappen" bij globale zoek
6. **Clean UI** - Filters alleen zichtbaar wanneer nodig
