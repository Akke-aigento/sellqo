

# Plan: Klantcommunicatie Centrum - Unified Customer Communication Settings

## Probleemanalyse

Je hebt een uitstekend punt! Momenteel is de communicatie-configuratie versnipperd:

| Huidige locatie | Wat het doet | Doelgroep |
|-----------------|--------------|-----------|
| **Notificaties** (`/admin/settings?section=notifications`) | In-app + email alerts | Winkel (intern) |
| **WhatsApp Business** (`/admin/settings?section=whatsapp`) | WhatsApp templates + automations | Klant |
| **Tracking Notifications** (niet in menu) | Email bij verzending/levering | Klant |
| **Invoice Automation** | Factuur emails | Klant |
| **Marketing Templates** | Email templates | Klant |

**Probleem:** Er is geen duidelijk onderscheid tussen "communicatie die JIJ ontvangt" en "communicatie die je KLANT ontvangt".

---

## Oplossing: Twee Duidelijke Communicatie-Hubs

### Nieuwe Structuur in Settings

```text
Koppelingen & Kanalen
├── 📬 Winkel Notificaties        ← Communicatie die JIJ ontvangt
│   └── (huidige NotificationSettings)
│
├── 💬 Klant Communicatie         ← NIEUW: Communicatie naar KLANTEN
│   ├── 📧 Email Triggers
│   │   ├── Bestelbevestiging
│   │   ├── Betaling ontvangen
│   │   ├── Factuur automatisch verzenden
│   │   ├── Verzending update (Track & Trace)
│   │   ├── Pakket bezorgd
│   │   └── Review verzoek
│   │
│   ├── 💬 WhatsApp Triggers
│   │   ├── Bestelbevestiging
│   │   ├── Verzending update
│   │   ├── Pakket bezorgd
│   │   └── Verlaten winkelwagen
│   │
│   └── ⚙️ Template Beheer
│       └── Link naar templates bewerken
│
├── 📧 Nieuwsbrief               ← Blijft
├── 📱 Social Media              ← Blijft
└── 🔗 WhatsApp Koppeling        ← Alleen de META connectie (technisch)
```

---

## UI Design: Klant Communicatie Pagina

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  💬 Klant Communicatie                                                                  │
│  ─────────────────────────────────────────────────────────────────────────────────────  │
│  Configureer welke automatische berichten je klanten ontvangen                          │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │  📧 Email                              💬 WhatsApp                              │   │
│  │  ──────────                            ──────────                               │   │
│  │                                                                                 │   │
│  │  Transactionele berichten worden via email verzonden.                          │   │
│  │  WhatsApp berichten vereisen dat klanten opt-in geven bij checkout.            │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ═══════════════════════════════════════════════════════════════════════════════════   │
│                                                                                         │
│  🛒 BESTELLINGEN                                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                            📧 Email    💬 WhatsApp              │   │
│  │  Bestelbevestiging                         [✓]         [✓]                      │   │
│  │  Automatisch na succesvolle betaling       [Aanpassen] [Aanpassen]              │   │
│  ├─────────────────────────────────────────────────────────────────────────────────┤   │
│  │  Betaling ontvangen                        [✓]         [ ]                      │   │
│  │  Bevestiging wanneer betaling binnenkomt   [Aanpassen]                          │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  📦 VERZENDING                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                            📧 Email    💬 WhatsApp              │   │
│  │  Pakket verzonden                          [✓]         [✓]                      │   │
│  │  Met Track & Trace link                    [Aanpassen] [Aanpassen]              │   │
│  ├─────────────────────────────────────────────────────────────────────────────────┤   │
│  │  Onderweg voor bezorging                   [ ]         [ ]                      │   │
│  │  Wanneer pakket dichtbij is               [Aanpassen] [Aanpassen]              │   │
│  ├─────────────────────────────────────────────────────────────────────────────────┤   │
│  │  Pakket bezorgd                            [✓]         [✓]                      │   │
│  │  Bevestiging van succesvolle levering      [Aanpassen] [Aanpassen]              │   │
│  ├─────────────────────────────────────────────────────────────────────────────────┤   │
│  │  Probleem met zending                      [✓]         [ ]                      │   │
│  │  Bij retour, douane issues, etc.          [Aanpassen]                          │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  📄 FACTUREN & OFFERTES                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                            📧 Email    💬 WhatsApp              │   │
│  │  Factuur automatisch verzenden             [✓]         [ ]                      │   │
│  │  Stuur factuur direct na aanmaken          [Aanpassen]                          │   │
│  ├─────────────────────────────────────────────────────────────────────────────────┤   │
│  │  Betalingsherinnering                      [✓]         [ ]                      │   │
│  │  Bij achterstallige facturen               [Aanpassen]                          │   │
│  ├─────────────────────────────────────────────────────────────────────────────────┤   │
│  │  Offerte verzonden                         [✓]         [ ]                      │   │
│  │  Wanneer een offerte wordt verzonden       [Aanpassen]                          │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  🛒 WINKELWAGEN & MARKETING                                                            │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                            📧 Email    💬 WhatsApp              │   │
│  │  Verlaten winkelwagen                      [✓]         [✓]                      │   │
│  │  Herinner na: [1] uur                      [Aanpassen] [Aanpassen]              │   │
│  ├─────────────────────────────────────────────────────────────────────────────────┤   │
│  │  Review verzoek                            [✓]         [ ]                      │   │
│  │  X dagen na levering                       [Aanpassen]                          │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ─────────────────────────────────────────────────────────────────────────────────────  │
│  ⚠️ WhatsApp berichten zijn alleen beschikbaar als je WhatsApp Business hebt          │
│     gekoppeld. [WhatsApp instellen →]                                                   │
│                                                                                         │
│  💡 Klik op [Aanpassen] om de template te bewerken voor elk berichttype.               │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Bestandsoverzicht

| Bestand | Actie | Beschrijving |
|---------|-------|--------------|
| **Components** | | |
| `src/components/admin/settings/CustomerCommunicationSettings.tsx` | Nieuw | Hoofd component voor klantcommunicatie |
| `src/components/admin/settings/CommunicationTriggerRow.tsx` | Nieuw | Herbruikbare rij component |
| `src/components/admin/settings/CommunicationCategoryCard.tsx` | Nieuw | Categorie wrapper (Bestellingen, Verzending, etc.) |
| **Types** | | |
| `src/types/customerCommunication.ts` | Nieuw | Types voor communication triggers |
| **Hooks** | | |
| `src/hooks/useCustomerCommunicationSettings.ts` | Nieuw | CRUD voor alle klant triggers |
| **Database** | | |
| `supabase/migrations/xxx_customer_communication.sql` | Nieuw | Unified settings tabel |
| **Updates** | | |
| `src/pages/admin/Settings.tsx` | Update | Hernoemen "Notificaties" → "Winkel Notificaties", toevoegen "Klant Communicatie" |
| `src/components/admin/settings/WhatsAppSettings.tsx` | Update | Focus alleen op de technische koppeling, verwijder automations naar nieuwe pagina |

---

## Database: Unified Communication Triggers

```sql
-- Unified table for all customer-facing communication triggers
CREATE TABLE public.customer_communication_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Trigger identification
  trigger_type TEXT NOT NULL,  -- 'order_confirmation', 'shipping_update', etc.
  category TEXT NOT NULL,      -- 'orders', 'shipping', 'invoices', 'marketing'
  
  -- Channel toggles
  email_enabled BOOLEAN DEFAULT true,
  whatsapp_enabled BOOLEAN DEFAULT false,
  
  -- Template references (nullable, uses defaults if not set)
  email_template_id UUID REFERENCES public.email_templates(id),
  whatsapp_template_id UUID REFERENCES public.whatsapp_templates(id),
  
  -- Additional settings per trigger
  delay_hours INTEGER DEFAULT 0,  -- For delayed triggers like abandoned cart
  extra_settings JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(tenant_id, trigger_type)
);

-- Enable RLS
ALTER TABLE public.customer_communication_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.customer_communication_settings
  FOR ALL USING (tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  ));

-- Index for quick lookups
CREATE INDEX idx_customer_comm_tenant ON public.customer_communication_settings(tenant_id);
CREATE INDEX idx_customer_comm_type ON public.customer_communication_settings(trigger_type);
```

---

## Communication Trigger Types

```typescript
// src/types/customerCommunication.ts
export type CommunicationCategory = 'orders' | 'shipping' | 'invoices' | 'marketing';

export interface CommunicationTrigger {
  id: string;
  type: string;
  category: CommunicationCategory;
  label: string;
  description: string;
  supportsEmail: boolean;
  supportsWhatsApp: boolean;
  hasDelay?: boolean;
  defaultEmailEnabled: boolean;
  defaultWhatsAppEnabled: boolean;
}

export const COMMUNICATION_TRIGGERS: CommunicationTrigger[] = [
  // Orders
  {
    id: 'order_confirmation',
    type: 'order_confirmation',
    category: 'orders',
    label: 'Bestelbevestiging',
    description: 'Automatisch na succesvolle betaling',
    supportsEmail: true,
    supportsWhatsApp: true,
    defaultEmailEnabled: true,
    defaultWhatsAppEnabled: true,
  },
  {
    id: 'payment_received',
    type: 'payment_received',
    category: 'orders',
    label: 'Betaling ontvangen',
    description: 'Bevestiging wanneer betaling binnenkomt',
    supportsEmail: true,
    supportsWhatsApp: false,
    defaultEmailEnabled: false,
    defaultWhatsAppEnabled: false,
  },
  
  // Shipping
  {
    id: 'shipping_update',
    type: 'shipping_update',
    category: 'shipping',
    label: 'Pakket verzonden',
    description: 'Met Track & Trace link',
    supportsEmail: true,
    supportsWhatsApp: true,
    defaultEmailEnabled: true,
    defaultWhatsAppEnabled: true,
  },
  {
    id: 'out_for_delivery',
    type: 'out_for_delivery',
    category: 'shipping',
    label: 'Onderweg voor bezorging',
    description: 'Wanneer pakket dichtbij is',
    supportsEmail: true,
    supportsWhatsApp: true,
    defaultEmailEnabled: false,
    defaultWhatsAppEnabled: false,
  },
  {
    id: 'delivery_confirmation',
    type: 'delivery_confirmation',
    category: 'shipping',
    label: 'Pakket bezorgd',
    description: 'Bevestiging van succesvolle levering',
    supportsEmail: true,
    supportsWhatsApp: true,
    defaultEmailEnabled: true,
    defaultWhatsAppEnabled: true,
  },
  {
    id: 'shipping_exception',
    type: 'shipping_exception',
    category: 'shipping',
    label: 'Probleem met zending',
    description: 'Bij retour, douane issues, etc.',
    supportsEmail: true,
    supportsWhatsApp: false,
    defaultEmailEnabled: true,
    defaultWhatsAppEnabled: false,
  },
  
  // Invoices
  {
    id: 'invoice_sent',
    type: 'invoice_sent',
    category: 'invoices',
    label: 'Factuur automatisch verzenden',
    description: 'Stuur factuur direct na aanmaken',
    supportsEmail: true,
    supportsWhatsApp: false,
    defaultEmailEnabled: true,
    defaultWhatsAppEnabled: false,
  },
  {
    id: 'payment_reminder',
    type: 'payment_reminder',
    category: 'invoices',
    label: 'Betalingsherinnering',
    description: 'Bij achterstallige facturen',
    supportsEmail: true,
    supportsWhatsApp: true,
    defaultEmailEnabled: true,
    defaultWhatsAppEnabled: false,
  },
  {
    id: 'quote_sent',
    type: 'quote_sent',
    category: 'invoices',
    label: 'Offerte verzonden',
    description: 'Wanneer een offerte wordt verzonden',
    supportsEmail: true,
    supportsWhatsApp: false,
    defaultEmailEnabled: true,
    defaultWhatsAppEnabled: false,
  },
  
  // Marketing
  {
    id: 'abandoned_cart',
    type: 'abandoned_cart',
    category: 'marketing',
    label: 'Verlaten winkelwagen',
    description: 'Herinner klanten aan achtergelaten items',
    supportsEmail: true,
    supportsWhatsApp: true,
    hasDelay: true,
    defaultEmailEnabled: false,
    defaultWhatsAppEnabled: false,
  },
  {
    id: 'review_request',
    type: 'review_request',
    category: 'marketing',
    label: 'Review verzoek',
    description: 'Vraag om review na levering',
    supportsEmail: true,
    supportsWhatsApp: false,
    hasDelay: true,
    defaultEmailEnabled: true,
    defaultWhatsAppEnabled: false,
  },
];
```

---

## Settings Menu Aanpassingen

```typescript
// Nieuwe structuur in Settings.tsx
const settingsGroups: SettingsGroup[] = [
  // ... bestaande groepen ...
  {
    id: 'channels',
    title: 'Koppelingen & Kanalen',
    description: 'Communicatie en externe koppelingen',
    sections: [
      // HERNOEMEN: Van "Notificaties" naar "Winkel Notificaties"
      { 
        id: 'shop-notifications', 
        title: 'Winkel Notificaties', 
        icon: Bell, 
        component: NotificationSettings,
        description: 'Meldingen die JIJ ontvangt'
      },
      // NIEUW: Klant Communicatie
      { 
        id: 'customer-communication', 
        title: 'Klant Communicatie', 
        icon: MessageSquare, 
        component: CustomerCommunicationSettings,
        description: 'Berichten naar je KLANTEN'
      },
      // WhatsApp wordt alleen de technische koppeling
      { 
        id: 'whatsapp', 
        title: 'WhatsApp Koppeling', 
        icon: MessageCircle, 
        component: WhatsAppConnectionSettings  // Alleen connection, geen automations
      },
      { id: 'newsletter', title: 'Nieuwsbrief', icon: Mail, component: NewsletterSettings },
      { id: 'social', title: 'Social Media', icon: Share2, component: SocialMediaHub },
      { id: 'fulfillment-api', title: 'Fulfillment API', icon: Network, component: FulfillmentAPISettings, adminOnly: true },
    ],
  },
];
```

---

## Voordelen van deze Aanpak

| Aspect | Voordeel |
|--------|----------|
| **Duidelijkheid** | Duidelijk onderscheid tussen interne notificaties en klantcommunicatie |
| **Centrale plek** | Alle klant-triggers (email + WhatsApp) op 1 pagina |
| **Consistente UX** | Zelfde toggle-stijl voor alle communicatietypen |
| **Flexibiliteit** | Makkelijk om kanalen aan/uit te zetten per trigger |
| **Template toegang** | Direct link naar template bewerken per trigger |
| **WhatsApp integratie** | WhatsApp is geen aparte silo meer, maar geintegreerd |
| **Uitbreidbaar** | Eenvoudig nieuwe triggers toevoegen (SMS, push, etc.) |

---

## Migratie van Bestaande Settings

De nieuwe `customer_communication_settings` tabel zal initieel gevuld worden met de huidige waarden uit:
- `tenants.whatsapp_order_confirmation` → `order_confirmation.whatsapp_enabled`
- `tenants.whatsapp_shipping_updates` → `shipping_update.whatsapp_enabled`
- `tenants.whatsapp_abandoned_cart` → `abandoned_cart.whatsapp_enabled`
- `tenants.auto_send_invoice_email` → `invoice_sent.email_enabled`
- `tenant_tracking_settings.notify_on_shipped` → `shipping_update.email_enabled`
- etc.

---

## Implementatie Volgorde

1. **Database Migration** - Nieuwe unified settings tabel
2. **Types & Config** - CommunicationTrigger definities
3. **Hook** - `useCustomerCommunicationSettings` voor CRUD
4. **UI Components** - CustomerCommunicationSettings pagina
5. **Settings Integration** - Menu aanpassingen + hernoemen
6. **WhatsApp Refactor** - Automations verplaatsen naar nieuwe pagina
7. **Data Migration** - Bestaande settings overzetten

