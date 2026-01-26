
# Plan: Klantgesprekken Inbox met Notificatiebadge

## Overzicht

Een dedicated inbox pagina voor alle klantcommunicatie (Email + WhatsApp) met:
- Duidelijke plek in de sidebar met notificatiebadge
- Filter op kanaal (Email/WhatsApp) en status (Ongelezen/Te beantwoorden)
- Chat-achtige conversatieweergave
- Integratie met dashboard statistieken

## Huidige Situatie

De code verwijst al naar `/admin/messages` op meerdere plekken:
- WhatsApp webhook maakt notificaties met `action_url: '/admin/messages'`
- Health Score Calculator linkt naar `/admin/messages` voor onbeantwoorde berichten
- Echter: de pagina en route bestaan nog niet!

## Architectuur

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                         │
│  Sidebar                           Inbox Pagina                                         │
│  ┌─────────────┐                  ┌─────────────────────────────────────────────────┐   │
│  │ Dagelijks   │                  │ 📬 Klantgesprekken                      [🔍 Zoek]│   │
│  │ ─────────── │                  │                                                 │   │
│  │ Dashboard   │                  │ [Alle] [📧 Email (12)] [📱 WhatsApp (3)]        │   │
│  │ Fulfillment │                  │ [⏳ Te beantwoorden (5)] [✓ Beantwoord]         │   │
│  │ ...         │                  │                                                 │   │
│  │             │                  │ ┌─────────────────────┬───────────────────────┐ │   │
│  │ 💬 Inbox 🔴5│ ◄── badge       │ │  Gesprekkenlijst    │  Geselecteerd gesprek │ │   │
│  │ ─────────── │                  │ │                     │                       │ │   │
│  │ Bestellingen│                  │ │  🔵 Marie de V.     │  Marie de Vries       │ │   │
│  │ ...         │                  │ │  📱 10 min geleden  │  +31612345678         │ │   │
│  └─────────────┘                  │ │  "Is die lamp..."   │                       │ │   │
│                                   │ │                     │  ┌─────────────────┐  │ │   │
│                                   │ │  Jan Bakker         │  │ 📱 10:32        │  │ │   │
│                                   │ │  📧 2 uur geleden   │  │ "Hoi! Is die    │  │ │   │
│                                   │ │  "Vraag over..."    │  │ lamp ook in     │  │ │   │
│                                   │ │                     │  │ zwart?"         │  │ │   │
│                                   │ │                     │  └─────────────────┘  │ │   │
│                                   │ │                     │                       │ │   │
│                                   │ │                     │  [💬 Beantwoorden]    │ │   │
│                                   │ └─────────────────────┴───────────────────────┘ │   │
│                                   └─────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

## Database Wijzigingen

### Nieuwe Kolommen voor Tracking

```sql
-- Track wanneer merchant een bericht heeft gelezen
ALTER TABLE public.customer_messages
  ADD COLUMN read_at TIMESTAMPTZ,
  ADD COLUMN read_by UUID REFERENCES auth.users(id);

-- Track of bericht beantwoord is (voor inbound berichten)
ALTER TABLE public.customer_messages
  ADD COLUMN replied_at TIMESTAMPTZ,
  ADD COLUMN reply_message_id UUID REFERENCES public.customer_messages(id);

-- Index voor snelle queries op ongelezen berichten
CREATE INDEX idx_customer_messages_unread 
  ON public.customer_messages(tenant_id, direction, read_at) 
  WHERE direction = 'inbound' AND read_at IS NULL;

-- Index voor channel filtering
CREATE INDEX idx_customer_messages_channel 
  ON public.customer_messages(tenant_id, channel);
```

## Bestandsoverzicht

| Bestand | Actie | Beschrijving |
|---------|-------|--------------|
| **Database** | | |
| `supabase/migrations/xxx_inbox_tracking.sql` | Nieuw | read_at, replied_at kolommen + indexes |
| **Hooks** | | |
| `src/hooks/useInbox.ts` | Nieuw | Gesprekken laden, groeperen, filteren |
| `src/hooks/useUnreadMessagesCount.ts` | Nieuw | Realtime badge counter voor sidebar |
| **Pagina** | | |
| `src/pages/admin/Messages.tsx` | Nieuw | Hoofd inbox pagina |
| **Components** | | |
| `src/components/admin/inbox/ConversationList.tsx` | Nieuw | Linkerkant: lijst van gesprekken |
| `src/components/admin/inbox/ConversationItem.tsx` | Nieuw | Individueel gesprek in lijst |
| `src/components/admin/inbox/ConversationDetail.tsx` | Nieuw | Rechterkant: chat-weergave |
| `src/components/admin/inbox/MessageBubble.tsx` | Nieuw | Chat bubble (inbound/outbound) |
| `src/components/admin/inbox/InboxFilters.tsx` | Nieuw | Filter tabs (kanaal, status) |
| `src/components/admin/inbox/ReplyComposer.tsx` | Nieuw | Antwoord opstellen onderaan |
| `src/components/admin/inbox/index.ts` | Nieuw | Barrel exports |
| **Sidebar** | | |
| `src/components/admin/sidebar/InboxNavItem.tsx` | Nieuw | Nav item met live badge |
| `src/components/admin/sidebar/sidebarConfig.ts` | Update | Inbox toevoegen aan dagelijks |
| **Routing** | | |
| `src/App.tsx` | Update | Route toevoegen voor /admin/messages |
| **Dashboard** | | |
| `src/components/admin/DashboardGrid.tsx` | Update | Link naar inbox voor ongelezen berichten |

## Component Details

### useInbox Hook

```typescript
interface Conversation {
  id: string; // customer_id of gecombineerde identifier
  customer: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    avatar?: string;
  } | null;
  lastMessage: CustomerMessage;
  unreadCount: number;
  channel: 'email' | 'whatsapp' | 'mixed';
  relatedOrders: { id: string; order_number: string }[];
}

interface UseInboxReturn {
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  messages: CustomerMessage[]; // voor geselecteerd gesprek
  unreadTotal: number;
  isLoading: boolean;
  filters: InboxFilters;
  setFilters: (filters: InboxFilters) => void;
  markAsRead: (messageId: string) => Promise<void>;
  markConversationAsRead: (conversationId: string) => Promise<void>;
}
```

### useUnreadMessagesCount Hook

```typescript
// Realtime counter voor sidebar badge
function useUnreadMessagesCount() {
  const { currentTenant } = useTenant();
  const [count, setCount] = useState(0);

  useEffect(() => {
    // Initial fetch
    fetchUnreadCount();
    
    // Realtime subscription
    const channel = supabase
      .channel('inbox-unread-count')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'customer_messages',
        filter: `tenant_id=eq.${tenantId}`,
      }, () => fetchUnreadCount())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [tenantId]);

  return count;
}
```

### InboxNavItem Component

```typescript
// Sidebar nav item met realtime badge
function InboxNavItem() {
  const unreadCount = useUnreadMessagesCount();
  
  return (
    <NavLink 
      to="/admin/messages" 
      className={({ isActive }) => cn(...)}
    >
      <MessageSquare className="h-4 w-4" />
      <span>Gesprekken</span>
      {unreadCount > 0 && (
        <Badge 
          variant="destructive" 
          className="ml-auto h-5 min-w-5 text-xs"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </Badge>
      )}
    </NavLink>
  );
}
```

### Inbox Pagina Layout

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  📬 Klantgesprekken                                                    [🔍] [⚙️]       │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│  [Alle (15)] [📧 Email (12)] [📱 WhatsApp (3)]   |   [⏳ Te beantwoorden (5)] [✓ Alle] │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                  │                                      │
│  Gesprekken                                      │  Marie de Vries                      │
│  ────────────────────────────────────────────    │  📱 +31 6 1234 5678                  │
│                                                  │  ──────────────────────────────────  │
│  🔵 Marie de Vries                    📱         │                                      │
│     "Hoi! Is die lamp ook in zwart.."           │         ┌─────────────────────────┐  │
│     10 min geleden                               │         │ Bestelling #0042 is     │  │
│  ─────────────────────────────────────────────   │         │ verzonden via PostNL... │  │
│                                                  │         │            📱 11:30 ✓✓  │  │
│  Jan Bakker                           📧         │         └─────────────────────────┘  │
│     "Vraag over levertijd"                       │                                      │
│     2 uur geleden                                │  ┌─────────────────────────┐         │
│  ─────────────────────────────────────────────   │  │ Hoi! Is die lamp ook    │         │
│                                                  │  │ in zwart beschikbaar?   │         │
│  Peter de Jong                        📱         │  │ 📱 10:32                │         │
│     "Bedankt voor de snelle levering!"          │  └─────────────────────────┘         │
│     1 dag geleden                      ✓         │                                      │
│                                                  │  ──────────────────────────────────  │
│                                                  │                                      │
│                                                  │  [📎] Typ je antwoord...    [Stuur]  │
│                                                  │                                      │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Conversatie Groepering

Berichten worden gegroepeerd per klant:

```typescript
// Groepeer berichten per customer_id (of email/telefoon als geen customer_id)
function groupMessagesIntoConversations(messages: CustomerMessage[]): Conversation[] {
  const grouped = new Map<string, CustomerMessage[]>();
  
  for (const msg of messages) {
    // Gebruik customer_id als beschikbaar, anders email/telefoon
    const key = msg.customer_id || msg.from_email || 'unknown';
    const existing = grouped.get(key) || [];
    grouped.set(key, [...existing, msg]);
  }
  
  return Array.from(grouped.entries()).map(([key, msgs]) => ({
    id: key,
    lastMessage: msgs[0], // Nieuwste eerst (gesorteerd)
    unreadCount: msgs.filter(m => m.direction === 'inbound' && !m.read_at).length,
    messages: msgs,
    // ...
  }));
}
```

## Dashboard Integratie

### "Te beantwoorden" in Stats Grid

Het bestaande stats grid kan een "Te beantwoorden" kaart tonen die linkt naar de inbox:

```typescript
// In stats grid of quick actions
{
  title: 'Te beantwoorden',
  value: unreadCount,
  icon: MessageSquare,
  href: '/admin/messages?filter=unread',
  variant: unreadCount > 0 ? 'warning' : 'default',
}
```

### Shop Health Integratie

De `healthScoreCalculator.ts` verwijst al naar `/admin/messages` - dit zal nu werken.

## Sidebar Wijziging

De inbox wordt toegevoegd aan de "Dagelijks" groep, direct na Dashboard:

```typescript
// sidebarConfig.ts
const dailyItems: NavItem[] = [
  { id: 'dashboard', title: 'Dashboard', url: '/admin', icon: LayoutDashboard },
  { id: 'inbox', title: 'Gesprekken', url: '/admin/messages', icon: MessageSquare, badge: true }, // NIEUW
  { id: 'fulfillment', title: 'Fulfillment', url: '/admin/fulfillment', icon: PackageCheck },
  // ...
];
```

## Realtime Updates

De inbox pagina abonneert op realtime updates:

```typescript
// In useInbox hook
useEffect(() => {
  const channel = supabase
    .channel('inbox-realtime')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'customer_messages',
      filter: `tenant_id=eq.${tenantId}`,
    }, (payload) => {
      // Voeg nieuw bericht toe aan juiste conversatie
      // Speel geluid af bij inbound bericht
      if (payload.new.direction === 'inbound') {
        playNotificationSound();
        showToast('Nieuw bericht ontvangen');
      }
    })
    .subscribe();
    
  return () => supabase.removeChannel(channel);
}, [tenantId]);
```

## Antwoorden via Inbox

De `ReplyComposer` component integreert met bestaande edge functions:

```typescript
// Bij WhatsApp: gebruik send-whatsapp-message
// Bij Email: gebruik send-customer-message
async function sendReply(channel: 'email' | 'whatsapp', body: string) {
  if (channel === 'whatsapp') {
    await supabase.functions.invoke('send-whatsapp-message', {
      body: {
        tenant_id,
        customer_id,
        template_type: 'custom', // Free-form reply
        message: body,
      },
    });
  } else {
    await sendMessage.mutateAsync({
      customer_email,
      customer_name,
      subject: `Re: ${lastSubject}`,
      body_html: body,
      context_type: 'general',
    });
  }
  
  // Mark conversation as replied
  await markAsReplied(conversationId);
}
```

## Implementatie Volgorde

1. **Database Migration** - read_at, replied_at kolommen + indexes
2. **useUnreadMessagesCount Hook** - Realtime badge counter
3. **useInbox Hook** - Gesprekken laden en groeperen
4. **UI Components** - ConversationList, ConversationDetail, MessageBubble
5. **Messages Page** - Hoofd inbox pagina
6. **Sidebar Update** - Inbox nav item met badge
7. **Routing** - /admin/messages route toevoegen
8. **Dashboard Links** - Quick action naar inbox

## Resultaat

Na implementatie:
- "Gesprekken" item in sidebar met rode badge (aantal ongelezen)
- Dedicated inbox pagina met alle klantberichten
- Filter op Email/WhatsApp en gelezen/ongelezen status
- Chat-achtige weergave per klant
- Direct antwoorden vanuit de inbox
- Realtime updates bij nieuwe berichten
- Dashboard toont "Te beantwoorden" teller
- Shop Health links naar inbox werken
