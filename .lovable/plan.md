
# Plan: "Vandaag" Widget - Live Sales Feed

## Overzicht

Een real-time widget die de hartslag van je webshop toont: bestellingen die binnenkomen, verzendingen, reviews en bezoekers. De widget combineert live Supabase Realtime subscriptions met "vandaag vs gisteren" vergelijkingen voor directe context.

## Widget Structuur

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ⚡ LIVE NU                                               🟢 Verbonden     │
│                                                                             │
│  ───────────────────────────────────────────────────────────────────────   │
│                                                                             │
│  10:32  💰 €49,95 bestelling van Jan de V.                                 │
│  10:28  📦 Bestelling #0042 verzonden via PostNL                           │
│  10:15  ⭐ Nieuwe 5-sterren review ontvangen                               │
│  09:45  🛒 3 items toegevoegd aan winkelwagen                              │
│  09:30  💰 €127,50 bestelling van Marie B.                                 │
│  09:12  👋 Nieuwe klant geregistreerd                                      │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│  📊 Vandaag                                                                │
│  ┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐ │
│  │ 💰 €847,50      │ 📦 12 orders    │ 👥 3 klanten    │ ⭐ 2 reviews    │ │
│  │ +23% vs gister  │ +4 vs gisteren  │ +2 vs gisteren  │ nieuw vandaag   │ │
│  └─────────────────┴─────────────────┴─────────────────┴─────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Technische Architectuur

### Data Bronnen & Realtime Events

De widget luistert naar meerdere tabellen via Supabase Realtime:

| Tabel | Event | Weergave |
|-------|-------|----------|
| `orders` | INSERT | "💰 €49,95 bestelling van [naam]" |
| `orders` | UPDATE (shipped_at) | "📦 Bestelling #0042 verzonden via [carrier]" |
| `orders` | UPDATE (delivered_at) | "✅ Bestelling #0042 afgeleverd" |
| `customers` | INSERT | "👋 Nieuwe klant geregistreerd" |
| `external_reviews` | INSERT | "⭐ Nieuwe [rating]-sterren review" |
| `notifications` | INSERT (type=order_*) | Fallback voor andere order events |

### useTodayLiveFeed Hook

```typescript
interface LiveFeedItem {
  id: string;
  type: 'order_new' | 'order_shipped' | 'order_delivered' | 'customer_new' | 'review_new' | 'cart_activity';
  icon: string;
  message: string;
  timestamp: Date;
  amount?: number;
  metadata?: Record<string, unknown>;
}

interface TodayStats {
  revenue: number;
  revenueChange: number; // vs gisteren
  orderCount: number;
  orderCountChange: number;
  newCustomers: number;
  newCustomersChange: number;
  reviewCount: number;
}

interface UseTodayLiveFeedReturn {
  feedItems: LiveFeedItem[];
  todayStats: TodayStats;
  isConnected: boolean;
  isLoading: boolean;
}
```

### Widget Component Structuur

```text
src/
├── hooks/
│   └── useTodayLiveFeed.ts           # Realtime data hook
├── components/admin/widgets/
│   └── TodayWidget.tsx               # Dashboard widget wrapper
└── components/today-widget/
    ├── LiveFeedHeader.tsx            # "⚡ LIVE NU" + connection status
    ├── LiveFeedItem.tsx              # Individueel feed item met animatie
    ├── LiveFeedList.tsx              # Scrollbare lijst van events
    ├── TodayStatsGrid.tsx            # 4-kolom stats onderaan
    └── TodayStatCard.tsx             # Individuele stat card
```

## Implementatie Details

### 1. useTodayLiveFeed Hook

```typescript
export function useTodayLiveFeed() {
  const { currentTenant } = useTenant();
  const [feedItems, setFeedItems] = useState<LiveFeedItem[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  
  // 1. Fetch vandaag's bestaande events bij mount
  useEffect(() => {
    const fetchTodayEvents = async () => {
      const todayStart = startOfDay(new Date()).toISOString();
      
      // Fetch orders, customers, reviews from today
      const [orders, customers, reviews] = await Promise.all([
        supabase.from('orders').select('*').eq('tenant_id', tenantId).gte('created_at', todayStart),
        supabase.from('customers').select('*').eq('tenant_id', tenantId).gte('created_at', todayStart),
        supabase.from('external_reviews').select('*').eq('tenant_id', tenantId).gte('review_date', todayStart),
      ]);
      
      // Map to LiveFeedItem format, sort by timestamp
      // ...
    };
  }, [currentTenant?.id]);
  
  // 2. Setup realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('today-live-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: `tenant_id=eq.${tenantId}` }, handleNewOrder)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `tenant_id=eq.${tenantId}` }, handleOrderUpdate)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'customers', filter: `tenant_id=eq.${tenantId}` }, handleNewCustomer)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'external_reviews', filter: `tenant_id=eq.${tenantId}` }, handleNewReview)
      .subscribe((status) => setIsConnected(status === 'SUBSCRIBED'));
      
    return () => supabase.removeChannel(channel);
  }, [tenantId]);
  
  // 3. Calculate today vs yesterday stats
  const todayStats = useMemo(() => calculateTodayStats(feedItems, yesterdayData), [feedItems, yesterdayData]);
  
  return { feedItems, todayStats, isConnected, isLoading };
}
```

### 2. LiveFeedItem Component

Elk item krijgt een subtiele "slide-in" animatie bij binnenkomst:

```typescript
function LiveFeedItem({ item }: { item: LiveFeedItem }) {
  const icon = getIconForType(item.type); // 💰, 📦, ⭐, 👋, etc.
  const timeAgo = formatDistanceToNow(item.timestamp, { addSuffix: true, locale: nl });
  
  return (
    <div className="flex items-start gap-3 py-2 animate-in slide-in-from-left-2 duration-300">
      <span className="text-lg">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{item.message}</p>
        <p className="text-xs text-muted-foreground">{timeAgo}</p>
      </div>
      {item.amount && (
        <span className="text-sm font-semibold text-emerald-600">
          {formatCurrency(item.amount)}
        </span>
      )}
    </div>
  );
}
```

### 3. TodayStatsGrid Component

```typescript
function TodayStatsGrid({ stats }: { stats: TodayStats }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <TodayStatCard
        icon="💰"
        label="Omzet"
        value={formatCurrency(stats.revenue)}
        change={stats.revenueChange}
        changeLabel="vs gisteren"
      />
      <TodayStatCard
        icon="📦"
        label="Bestellingen"
        value={stats.orderCount.toString()}
        change={stats.orderCountChange}
        changeLabel="vs gisteren"
        changeIsAbsolute // +4 instead of +23%
      />
      <TodayStatCard
        icon="👥"
        label="Nieuwe klanten"
        value={stats.newCustomers.toString()}
        change={stats.newCustomersChange}
        changeLabel="vs gisteren"
        changeIsAbsolute
      />
      <TodayStatCard
        icon="⭐"
        label="Reviews"
        value={stats.reviewCount.toString()}
        changeLabel="nieuw vandaag"
        hideChange
      />
    </div>
  );
}
```

### 4. Connection Status Indicator

```typescript
function LiveFeedHeader({ isConnected }: { isConnected: boolean }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Zap className="h-5 w-5 text-yellow-500" />
        <span className="font-semibold">LIVE NU</span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            isConnected 
              ? "bg-emerald-500 animate-pulse" 
              : "bg-gray-300"
          )}
        />
        <span className="text-xs text-muted-foreground">
          {isConnected ? 'Verbonden' : 'Verbinden...'}
        </span>
      </div>
    </div>
  );
}
```

## Database Considerations

### Realtime Enablement

De `orders` tabel heeft mogelijk al realtime nodig. We moeten controleren of deze is toegevoegd aan de `supabase_realtime` publication. Indien niet:

```sql
-- Enable realtime for orders table (if not already enabled)
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
```

De `customers` en `external_reviews` tabellen moeten mogelijk ook worden toegevoegd.

### Query Optimization

Voor de "vandaag vs gisteren" vergelijking:

```typescript
// Efficient query: alleen counts en sums nodig
const { data: todayData } = await supabase
  .from('orders')
  .select('total, payment_status')
  .eq('tenant_id', tenantId)
  .gte('created_at', todayStart)
  .eq('payment_status', 'paid');

const { data: yesterdayData } = await supabase
  .from('orders')
  .select('total, payment_status')
  .eq('tenant_id', tenantId)
  .gte('created_at', yesterdayStart)
  .lt('created_at', todayStart)
  .eq('payment_status', 'paid');
```

## UI/UX Details

### Animaties

- **Nieuwe items**: `animate-in slide-in-from-left-2 duration-300`
- **Pulse op connection indicator**: `animate-pulse` op de groene stip
- **Highlight bij nieuwe order**: Korte `bg-emerald-50` flash die wegfadet

### Feed Limit

- Maximum 20 items in de feed
- Oudste items worden automatisch verwijderd
- Smooth scroll naar boven bij nieuwe items (optioneel)

### Empty State

```text
┌─────────────────────────────────────────┐
│  ⚡ LIVE NU                 🟢 Verbonden │
│                                         │
│      ☕                                 │
│      Nog geen activiteit vandaag        │
│      Bestellingen verschijnen hier      │
│      zodra ze binnenkomen               │
│                                         │
│  ─────────────────────────────────────  │
│  📊 Vandaag: €0,00 omzet                │
└─────────────────────────────────────────┘
```

### Responsiveness

- **Desktop**: Volledige widget met 4-kolom stats
- **Tablet**: 2x2 stats grid
- **Mobile**: Gestapelde stats, kortere feed (laatste 10 items)

## Bestandsoverzicht

| Bestand | Actie | Beschrijving |
|---------|-------|--------------|
| `src/hooks/useTodayLiveFeed.ts` | Nieuw | Realtime feed + today stats hook |
| `src/components/today-widget/LiveFeedHeader.tsx` | Nieuw | Header met LIVE indicator |
| `src/components/today-widget/LiveFeedItem.tsx` | Nieuw | Individueel feed item |
| `src/components/today-widget/LiveFeedList.tsx` | Nieuw | Feed container met scroll |
| `src/components/today-widget/TodayStatsGrid.tsx` | Nieuw | Stats grid onderaan |
| `src/components/today-widget/TodayStatCard.tsx` | Nieuw | Individuele stat card |
| `src/components/today-widget/index.ts` | Nieuw | Barrel export |
| `src/components/admin/widgets/TodayWidget.tsx` | Nieuw | Dashboard widget wrapper |
| `src/config/dashboardWidgets.ts` | Update | Voeg today-widget toe |
| `src/components/admin/DashboardGrid.tsx` | Update | Import TodayWidget |
| `src/components/admin/widgets/index.ts` | Update | Export TodayWidget |
| Database migration | Nieuw | Enable realtime voor orders, customers, external_reviews |

## Widget Configuratie

Toevoegen aan `dashboardWidgets.ts`:

```typescript
{
  id: 'today-widget',
  title: 'Vandaag',
  description: 'Live sales feed en dagelijkse statistieken',
  defaultSize: 'lg', // Neemt 2 kolommen
  minSize: 'md',
  category: 'stats',
  icon: Zap,
}
```

## Implementatie Volgorde

1. **Database Migration** - Enable realtime voor orders, customers, external_reviews
2. **useTodayLiveFeed Hook** - Core data aggregatie en realtime subscriptions
3. **UI Components** - Feed items, header, stats grid
4. **TodayWidget** - Widget wrapper
5. **Dashboard Integratie** - Toevoegen aan widget config en grid
6. **Polish** - Animaties, empty states, responsiveness

## Resultaat

Na implementatie:
- Merchants zien real-time activiteit in hun dashboard
- Elke nieuwe bestelling/klant/review verschijnt instant
- "Vandaag vs gisteren" vergelijking geeft directe context
- Groene "Verbonden" indicator bevestigt live connectie
- Emotionele impact: je winkel "leeft"
