

# Plan: Fix Notification Bell Issues

## Geïdentificeerde Problemen

### Probleem 1: Notificaties worden niet opgeslagen
De webhooks (WhatsApp, Meta Messaging, Email) proberen notificaties op te slaan met `category: 'messages'`, maar deze categorie bestaat **niet** in de database enum. De database ondersteunt alleen:
- orders, invoices, payments, customers, products, quotes, subscriptions, marketing, team, system, ai_coach

Daarom falen alle inbox-notificatie inserts en blijft de notificatiebel leeg.

### Probleem 2: Slechte Layout van Tabs
De screenshot toont dat de tabs (Alle, Ongelezen, Urgent, Coach) te krap zijn en niet goed passen in de popover. De huidige styling gebruikt `px-4 py-2` voor elke tab, maar in een 384px breed popover met 4 tabs + iconen past dit niet.

### Probleem 3: Geen Geluid
Het geluid werkt technisch (code is aanwezig), maar:
- De global listener luistert naar de `notifications` tabel
- Inbox berichten triggeren geen notifications (zie probleem 1)
- Dus wordt `playSound()` nooit aangeroepen

### Probleem 4: Geen Geluid Toggle in Instellingen
De `useNotificationSound` hook heeft wel een `enabled` state en `toggleEnabled` functie, maar deze is nergens in de UI beschikbaar.

---

## Oplossing

### Stap 1: Database - Voeg 'messages' categorie toe aan enum

```sql
ALTER TYPE notification_category ADD VALUE 'messages';
```

Dit maakt het mogelijk om inbox-notificaties correct op te slaan.

### Stap 2: Frontend - Update NotificationSettings met Geluid Toggle

Voeg een sectie toe bovenaan de `NotificationSettings` component:

```text
┌─────────────────────────────────────────────────────────┐
│ 🔔 Notificatie Voorkeuren                               │
│ Bepaal welke notificaties je wilt ontvangen...          │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🔊 Geluidsmelding                                   │ │
│ │ Speel een geluid af bij nieuwe notificaties   [●─] │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [🔔 In-app] [✉️ Email]                                  │
│                                                         │
│ ▼ Bestellingen (9 types)                                │
│ ▼ Facturen (9 types)                                    │
│ ...                                                     │
└─────────────────────────────────────────────────────────┘
```

### Stap 3: Frontend - Fix NotificationCenter Layout

Pas de tabs styling aan voor betere layout in de smalle popover:
- Kleinere padding op tabs (`px-2 py-1.5`)
- Kortere labels ("Alle" → "Alle", "Ongelezen" → blijft)
- Flex-wrap toestaan of scrollbaar maken
- Tabs op meerdere rijen als nodig

### Stap 4: Types - Voeg 'messages' toe aan NotificationCategory

Update `src/types/notification.ts` om de nieuwe categorie te ondersteunen:

```typescript
export type NotificationCategory = 
  | 'orders'
  | 'invoices'
  // ... bestaande
  | 'messages'; // NIEUW
```

En voeg de configuratie toe aan `NOTIFICATION_CONFIG`:

```typescript
{
  category: 'messages',
  label: 'Berichten',
  icon: 'MessageSquare',
  types: [
    { type: 'email_inbound', label: 'Email ontvangen', ... },
    { type: 'whatsapp_inbound', label: 'WhatsApp ontvangen', ... },
    { type: 'facebook_inbound', label: 'Facebook bericht', ... },
    { type: 'instagram_inbound', label: 'Instagram DM', ... },
    { type: 'bol_inbound', label: 'Bol.com vraag', ... },
  ]
}
```

---

## Bestanden te Wijzigen

| Bestand | Wijziging |
|---------|-----------|
| Database migratie | `ALTER TYPE notification_category ADD VALUE 'messages'` |
| `src/types/notification.ts` | Voeg 'messages' categorie + types toe |
| `src/components/admin/settings/NotificationSettings.tsx` | Voeg geluid toggle toe |
| `src/components/admin/NotificationCenter.tsx` | Fix tabs layout |

---

## Resultaat na Implementatie

1. **Berichten verschijnen in bell** - Inbox notificaties worden correct opgeslagen en getoond
2. **Verbeterde layout** - Tabs passen netjes in de popover
3. **Geluid werkt** - Bij elk nieuw bericht klinkt een geluid (als ingeschakeld)
4. **Geluid toggle** - In Instellingen > Notificaties kan je het geluid aan/uit zetten

---

## Technische Details

### Database Migratie
```sql
-- Voeg messages toe aan notification_category enum
ALTER TYPE notification_category ADD VALUE 'messages';
```

### NotificationSettings Geluid Toggle
```typescript
import { useNotificationSound } from '@/hooks/useNotificationSound';
import { Volume2, VolumeX } from 'lucide-react';

// In component:
const { enabled: soundEnabled, toggleEnabled: toggleSound } = useNotificationSound();

// In render:
<Card className="mb-4">
  <CardContent className="p-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {soundEnabled ? <Volume2 /> : <VolumeX />}
        <div>
          <Label>Geluidsmelding</Label>
          <p className="text-sm text-muted-foreground">
            Speel een geluid af bij nieuwe notificaties
          </p>
        </div>
      </div>
      <Switch checked={soundEnabled} onCheckedChange={toggleSound} />
    </div>
  </CardContent>
</Card>
```

### NotificationCenter Tabs Fix
```typescript
// Huidige problematische styling:
<TabsTrigger className="px-4 py-2">Ongelezen ({count})</TabsTrigger>

// Nieuwe compacte styling:
<TabsList className="w-full grid grid-cols-4 h-auto p-1">
  <TabsTrigger className="text-xs px-2 py-1.5">
    Alle ({n})
  </TabsTrigger>
  <TabsTrigger className="text-xs px-2 py-1.5">
    Nieuw ({n})
  </TabsTrigger>
  <TabsTrigger className="text-xs px-2 py-1.5">
    Urgent ({n})
  </TabsTrigger>
  <TabsTrigger className="text-xs px-2 py-1.5 gap-1">
    <Bot className="h-3 w-3" />
    AI ({n})
  </TabsTrigger>
</TabsList>
```

