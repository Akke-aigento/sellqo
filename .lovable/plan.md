
# Hero Dashboard Mockup - Prominente Features Upgrade

## Huidige Situatie
Het fake dashboard toont nu:
- Trial banner ✅
- Health Score badge ✅
- 4 stat cards (Omzet, Bestellingen, Klanten, Health)
- Revenue chart
- Top producten
- Recente bestellingen

**Probleem**: Dit is een generiek e-commerce dashboard dat elke webshop software kan tonen. Het mist de **unieke selling points** van SellQo.

---

## Voorgestelde Verbeteringen

### 1. AI Coach Suggestie Card (NIEUW)
Vervang "Top Producten" sectie met een **AI Coach preview** die toont:
- Bot avatar met gradient
- Conversational message: *"📈 Je bestseller 'Premium Headphones' is bijna uitverkocht. Bestel nu bij om €2.340 aan gemiste verkopen te voorkomen."*
- Quick action buttons: "Bestel nu" en "Later"
- Priority badge (bijv. "⚠️ Hoog")

Dit toont de **proactieve AI** die SellQo uniek maakt.

---

### 2. Unified Inbox Preview (NIEUW)
Vervang "Recente Bestellingen" met een **Inbox feed** die toont:
- 3 klantberichten met avatar, naam, preview
- Channel icons: 📧 Email, 💬 WhatsApp, 🔵 Bol.com badge
- Unread indicator (rode dot)
- "3 ongelezen berichten" header

Dit toont de **multichannel inbox** met marketplace integratie.

---

### 3. Mini Sidebar Update
Huidige icons: Euro, ShoppingBag, Package, Heart, TrendingUp

Nieuwe icons toevoegen:
- **MessageSquare** (Inbox)
- **Bot** (AI Coach)
- **Zap** (Quick Actions)

Dit benadrukt de AI en communicatie features.

---

### 4. Live Activity Indicator (NIEUW)
Klein element onder de stats:
- 🟢 Pulserende groene dot
- "Live: 3 bezoekers op je shop"
- Subtiele real-time feel

---

## Nieuwe Layout Design

```text
┌─────────────────────────────────────────────────────────┐
│  [Trial Banner - 14 dagen gratis]                       │
├─────────────────────────────────────────────────────────┤
│  [Health Score: 92%]              [3 verbeterpunten →]  │
├─────────────────────────────────────────────────────────┤
│  [Omzet]  [Orders]  [Klanten]  [Health]    ← Stats      │
├──────────────────────────┬──────────────────────────────┤
│                          │                              │
│   📊 Omzet Grafiek       │   🤖 AI Coach Suggestie      │
│   [Chart]                │   "Je bestseller raakt op.." │
│                          │   [Bestel nu] [Later]        │
│                          │                              │
├──────────────────────────┴──────────────────────────────┤
│   📬 Klantberichten (3 ongelezen)                       │
│   ┌─────────────────────────────────────────────────┐   │
│   │ 👤 Jan de Vries  📧  "Vraag over bezorging..."  │   │
│   │ 👤 Lisa Bakker   💬  "Hallo, is dit nog..."    🔴│   │
│   │ 👤 Bol.com Klant 🛒  "Wanneer wordt mijn..."   🔴│   │
│   └─────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│   🟢 Live: 5 bezoekers op je shop                       │
└─────────────────────────────────────────────────────────┘
```

---

## Technische Implementatie

### Bestand
`src/components/landing/HeroDashboardMockup.tsx`

### Data Structures

**AI Coach Message (nieuw)**:
```typescript
const aiCoachSuggestion = {
  priority: 'high',
  emoji: '📈',
  message: "Je bestseller 'Premium Headphones' is bijna uitverkocht. Bestel nu bij om €2.340 aan gemiste verkopen te voorkomen.",
  actions: ['Bestel nu', 'Later']
};
```

**Inbox Messages (nieuw)**:
```typescript
const inboxMessages = [
  { 
    name: 'Jan de Vries', 
    channel: 'email', 
    preview: 'Vraag over bezorging...', 
    unread: false 
  },
  { 
    name: 'Lisa Bakker', 
    channel: 'whatsapp', 
    preview: 'Hallo, is dit nog op voorraad?', 
    unread: true 
  },
  { 
    name: 'Bol.com Klant', 
    channel: 'bol', 
    preview: 'Wanneer wordt mijn bestelling verzonden?', 
    unread: true,
    marketplace: 'bol_com'
  },
];
```

### UI Components binnen Mockup

1. **AICoachMockup** - Gradient card met bot icon, priority badge, message, action buttons
2. **InboxMockup** - List met avatar, channel icon, preview, unread indicator
3. **LiveIndicator** - Pulserende groene dot met bezoekerscount

### Icons toe te voegen
```typescript
import { 
  // Bestaand
  Euro, ShoppingBag, Users, TrendingUp, Package, Heart, Clock,
  // Nieuw
  Bot, MessageSquare, Mail, Zap, ShoppingCart, Circle
} from 'lucide-react';
```

---

## Verwacht Resultaat

Het nieuwe mockup demonstreert visueel:
1. **AI dat meedenkt** - Proactieve suggesties in realtime
2. **Unified Inbox** - Alle kanalen (Email, WhatsApp, Marketplaces) in één view
3. **Live activiteit** - Real-time feel met bezoekersdata
4. **Moderne SaaS UI** - Gradient accents, micro-animations

Dit maakt direct duidelijk wat SellQo onderscheidt van generieke e-commerce platforms.
