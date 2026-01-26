
# Plan: Gamification & Milestones Systeem

## Overzicht

Een compleet gamification systeem met:
- Milestone popups met confetti wanneer doelen bereikt worden
- Persistente badges en achievements per tenant
- Progress bars naar volgende milestone
- "Ben je tevreden?" feedback popup na belangrijke milestones
- Integratie met dashboard en Shop Health widget

## Architectuur

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                         │
│  Milestone Detection                      Milestone Display                             │
│  ┌─────────────────────────────────┐     ┌─────────────────────────────────────────┐   │
│  │ useMilestones Hook              │────▶│ MilestonePopup (Dialog)                 │   │
│  │ - Check totals vs thresholds    │     │ - Confetti effect                       │   │
│  │ - Compare with last shown       │     │ - Badge display                         │   │
│  │ - Mark as seen in DB            │     │ - Progress to next milestone            │   │
│  └─────────────────────────────────┘     │ - Satisfaction question (optional)      │   │
│           │                               └─────────────────────────────────────────┘   │
│           │                                                                             │
│           ▼                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              Database                                           │   │
│  │  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐     │   │
│  │  │ tenant_milestones   │  │ tenant_badges       │  │ app_feedback        │     │   │
│  │  │ - milestone_id      │  │ - badge_type        │  │ - rating            │     │   │
│  │  │ - achieved_at       │  │ - earned_at         │  │ - comment           │     │   │
│  │  │ - shown_at          │  │ - value             │  │ - milestone_id      │     │   │
│  │  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘     │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

## Milestone Types & Badges

### Bestellingen Milestones
| Milestone | Badge | Emoji | Volgende |
|-----------|-------|-------|----------|
| 1e bestelling | First Sale | 🎉 | 10 |
| 10 bestellingen | Getting Started | 🚀 | 50 |
| 50 bestellingen | On a Roll | 🔥 | 100 |
| 100 bestellingen | Century Seller | 🥇 | 250 |
| 250 bestellingen | Power Seller | 💎 | 500 |
| 500 bestellingen | Superstar | ⭐ | 1000 |
| 1000 bestellingen | Legend | 🏆 | - |

### Omzet Milestones
| Milestone | Badge | Emoji |
|-----------|-------|-------|
| €1.000 | First Thousand | 💵 |
| €5.000 | Five K Club | 💰 |
| €10.000 | Ten K Champion | 🎯 |
| €25.000 | Quarter Master | 💎 |
| €50.000 | Fifty K Elite | 🌟 |
| €100.000 | Six Figure Seller | 👑 |

### Speciale Badges
| Badge | Criteria | Emoji |
|-------|----------|-------|
| Speed Demon | 7 dagen alle orders <24u verzonden | ⚡ |
| Customer Champion | 0 negatieve reviews in 30 dagen | 🏅 |
| Inventory Master | Nooit uitverkocht in 30 dagen | 📦 |
| Response Pro | Gemiddelde reactietijd <1u | 💬 |

## Database Schema

```sql
-- Bereikte milestones per tenant
CREATE TABLE public.tenant_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  milestone_type TEXT NOT NULL, -- 'orders', 'revenue', 'customers'
  milestone_value INTEGER NOT NULL, -- 100, 1000, 10000, etc.
  achieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  shown_at TIMESTAMPTZ, -- NULL = not yet shown to user
  acknowledged_at TIMESTAMPTZ, -- When user closed the popup
  feedback_requested BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, milestone_type, milestone_value)
);

-- Verdiende badges per tenant
CREATE TABLE public.tenant_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL, -- 'century_seller', 'speed_demon', etc.
  badge_name TEXT NOT NULL,
  badge_emoji TEXT NOT NULL,
  badge_description TEXT,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  display_order INTEGER DEFAULT 0,
  UNIQUE(tenant_id, badge_id)
);

-- App feedback (na milestones)
CREATE TABLE public.app_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  milestone_id UUID REFERENCES public.tenant_milestones(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  is_satisfied BOOLEAN,
  feedback_text TEXT,
  feature_requests TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cache totals voor snelle milestone checks
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS
  lifetime_order_count INTEGER DEFAULT 0,
  lifetime_revenue NUMERIC(12,2) DEFAULT 0,
  lifetime_customer_count INTEGER DEFAULT 0,
  last_milestone_check TIMESTAMPTZ;

-- RLS Policies
ALTER TABLE public.tenant_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.tenant_milestones
  FOR ALL USING (tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant isolation" ON public.tenant_badges
  FOR ALL USING (tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant isolation" ON public.app_feedback
  FOR ALL USING (tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  ));
```

## Milestone Popup Design

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           🎊 CONFETTI EFFECT 🎊                            │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                     │   │
│  │                     🎉 MILESTONE BEREIKT! 🎉                        │   │
│  │                                                                     │   │
│  │                    ┌─────────────────────┐                          │   │
│  │                    │                     │                          │   │
│  │                    │        🥇           │                          │   │
│  │                    │   Century Seller    │                          │   │
│  │                    │                     │                          │   │
│  │                    └─────────────────────┘                          │   │
│  │                                                                     │   │
│  │            Je hebt je 100e bestelling verwerkt!                     │   │
│  │                                                                     │   │
│  │            "Van eerste order tot 100 - je bent echt                 │   │
│  │             aan het groeien! Trots op je!"                          │   │
│  │                                                                     │   │
│  │  ─────────────────────────────────────────────────────────────────  │   │
│  │                                                                     │   │
│  │            Volgende milestone: 250 bestellingen                     │   │
│  │            ████████████░░░░░░░░░░░░░░ 40%                          │   │
│  │                                                                     │   │
│  │                         [🎉 Geweldig!]                              │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Feedback Popup (na elke 5e milestone)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                     │   │
│  │                      💬 Even een vraagje...                         │   │
│  │                                                                     │   │
│  │            Ben je tevreden over je ervaring met SellQo?             │   │
│  │                                                                     │   │
│  │                     😞  😐  🙂  😊  🤩                              │   │
│  │                     1   2   3   4   5                               │   │
│  │                                                                     │   │
│  │  ─────────────────────────────────────────────────────────────────  │   │
│  │                                                                     │   │
│  │  Wat kunnen we verbeteren? (optioneel)                              │   │
│  │  ┌───────────────────────────────────────────────────────────────┐  │   │
│  │  │                                                               │  │   │
│  │  │                                                               │  │   │
│  │  └───────────────────────────────────────────────────────────────┘  │   │
│  │                                                                     │   │
│  │            [Later]                    [Verstuur feedback]           │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Badges Overview Widget

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  🏆 Jouw Badges                                                [Alle ▶]    │
│                                                                             │
│  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐                      │
│  │ 🎉  │  │ 🚀  │  │ 💵  │  │ 🥇  │  │ ⚡  │  │ 🔒  │ ← locked             │
│  │First│  │Start│  │ 1K  │  │100  │  │Speed│  │ ???  │                      │
│  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘                      │
│                                                                             │
│  Volgende: Power Seller (250 bestellingen)                                  │
│  ████████████░░░░░░░░░░░░░░ 40% (100/250)                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Bestandsoverzicht

| Bestand | Actie | Beschrijving |
|---------|-------|--------------|
| **Database** | | |
| `supabase/migrations/xxx_gamification.sql` | Nieuw | Milestones, badges, feedback tabellen |
| **Config** | | |
| `src/config/milestones.ts` | Nieuw | Milestone definities, drempelwaarden |
| `src/config/badges.ts` | Nieuw | Badge definities, emoji's, beschrijvingen |
| **Hooks** | | |
| `src/hooks/useMilestones.ts` | Nieuw | Milestone detection & tracking |
| `src/hooks/useBadges.ts` | Nieuw | Badge management |
| `src/hooks/useAppFeedback.ts` | Nieuw | Feedback collection |
| **Components** | | |
| `src/components/gamification/MilestonePopup.tsx` | Nieuw | Celebratie popup met confetti |
| `src/components/gamification/FeedbackPopup.tsx` | Nieuw | Tevredenheids vraag |
| `src/components/gamification/BadgeCard.tsx` | Nieuw | Individuele badge display |
| `src/components/gamification/BadgesOverview.tsx` | Nieuw | Alle badges overzicht |
| `src/components/gamification/MilestoneProgress.tsx` | Nieuw | Progress bar naar volgende |
| `src/components/gamification/GamificationProvider.tsx` | Nieuw | Context voor milestone checks |
| `src/components/gamification/index.ts` | Nieuw | Barrel exports |
| **Widgets** | | |
| `src/components/admin/widgets/BadgesWidget.tsx` | Nieuw | Dashboard widget voor badges |
| **Updates** | | |
| `src/components/admin/AdminLayout.tsx` | Update | GamificationProvider toevoegen |
| `src/config/dashboardWidgets.ts` | Update | Badges widget registreren |
| `src/components/admin/DashboardGrid.tsx` | Update | Badges widget mapping |
| `src/components/shop-health/HealthAchievements.tsx` | Update | Link naar badges overzicht |

## Technische Details

### Milestone Detection Logic

```typescript
// useMilestones.ts
const ORDER_MILESTONES = [1, 10, 50, 100, 250, 500, 1000];
const REVENUE_MILESTONES = [1000, 5000, 10000, 25000, 50000, 100000];

function checkForNewMilestones(
  currentCount: number, 
  achievedMilestones: number[],
  milestoneList: number[]
): number | null {
  // Find the highest milestone that:
  // 1. Current count has reached
  // 2. Is not yet in achievedMilestones
  for (const milestone of [...milestoneList].reverse()) {
    if (currentCount >= milestone && !achievedMilestones.includes(milestone)) {
      return milestone;
    }
  }
  return null;
}
```

### GamificationProvider

```typescript
// Wraps AdminLayout, checks milestones on mount and data changes
function GamificationProvider({ children }: { children: ReactNode }) {
  const { pendingMilestone, acknowledgeMilestone } = useMilestones();
  const [showFeedback, setShowFeedback] = useState(false);
  
  return (
    <GamificationContext.Provider value={{ ... }}>
      {children}
      
      {pendingMilestone && (
        <MilestonePopup
          milestone={pendingMilestone}
          onClose={(requestFeedback) => {
            acknowledgeMilestone(pendingMilestone.id);
            if (requestFeedback) setShowFeedback(true);
          }}
        />
      )}
      
      {showFeedback && (
        <FeedbackPopup onClose={() => setShowFeedback(false)} />
      )}
    </GamificationContext.Provider>
  );
}
```

### Tenant Stats Caching

```typescript
// Trigger to update lifetime stats on new orders
CREATE OR REPLACE FUNCTION update_tenant_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.payment_status = 'paid' THEN
    UPDATE tenants SET
      lifetime_order_count = lifetime_order_count + 1,
      lifetime_revenue = lifetime_revenue + NEW.total
    WHERE id = NEW.tenant_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_order_paid
AFTER INSERT OR UPDATE ON orders
FOR EACH ROW
WHEN (NEW.payment_status = 'paid')
EXECUTE FUNCTION update_tenant_stats();
```

### Feedback Collection

De feedback wordt gekoppeld aan de milestone en bevat:
- Rating (1-5 sterren/emoji's)
- Optionele tekst feedback
- Feature requests veld
- Automatisch: tenant_id, user_id, timestamp

Na elke 5e milestone wordt de feedback popup getriggerd.

## Implementatie Volgorde

1. **Database Migration** - Tabellen, triggers, cached stats
2. **Config Files** - Milestone en badge definities
3. **useMilestones Hook** - Detectie en tracking logica
4. **useBadges Hook** - Badge management
5. **MilestonePopup** - Celebratie UI met confetti
6. **FeedbackPopup** - Tevredenheids vraag
7. **BadgesWidget** - Dashboard widget
8. **GamificationProvider** - Context wrapper
9. **Integration** - AdminLayout, DashboardGrid updates

## Resultaat

Na implementatie:
- Automatische milestone detectie bij order/omzet groei
- Celebratie popups met confetti effect
- Persistente badges die verzameld worden
- Progress tracking naar volgende milestone
- Periodieke tevredenheidsvragen na milestones
- Badges widget op het dashboard
- Volledige badge collectie pagina
- Emotionele binding tussen merchant en platform
