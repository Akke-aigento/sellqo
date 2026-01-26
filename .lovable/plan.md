

# Plan: AI-Gestuurde Klantinteractie & Contact Functies

## Samenvatting

Dit plan implementeert drie grote verbeteringen:
1. **Interactieve Contact Pagina** met configureerbare WhatsApp/Email knoppen
2. **Floating WhatsApp Widget** als toggle voor de hele webshop  
3. **AI Assistentie Centrum** - gecentraliseerde AI instellingen voor:
   - AI Chatbot (kent de hele webshop content)
   - AI Suggesties voor klantgesprekken

---

## 1. Contact Pagina Configuratie

### Probleem
De huidige `StorefrontPagesManager` maakt alleen statische pagina's met HTML content. Er is geen manier om interactieve elementen (WhatsApp/Email knoppen) toe te voegen die per winkel aan/uit gezet kunnen worden.

### Oplossing
Een speciale "Contact" pagina template met configureerbare velden die de storefront automatisch rendert met knoppen.

### Database Schema

```sql
-- Contact Page Configuration (als onderdeel van tenant_theme_settings)
ALTER TABLE public.tenant_theme_settings ADD COLUMN IF NOT EXISTS contact_config JSONB DEFAULT '{
  "show_email_button": true,
  "show_whatsapp_button": false,
  "show_phone_button": true,
  "show_address": true,
  "show_map": false,
  "show_contact_form": true,
  "whatsapp_prefill_message": "Hallo, ik heb een vraag over...",
  "opening_hours": null,
  "custom_intro_text": null
}'::jsonb;
```

### UI Ontwerp

In de `StorefrontFeaturesSettings` voegen we een nieuwe sectie toe:

```text
📬 CONTACT PAGINA
┌─────────────────────────────────────────────────────────────────────┐
│  Configureer welke contact opties zichtbaar zijn op je contact pagina │
│                                                                       │
│  📧 Email knop                                    [✓]                │
│  └── Opent email client met winkel email                             │
│                                                                       │
│  💬 WhatsApp knop                                 [✓]                │
│  └── Prefill bericht: [Hallo, ik heb een vraag over...            ] │
│                                                                       │
│  📞 Telefoon knop                                 [✓]                │
│  └── Click-to-call functionaliteit                                   │
│                                                                       │
│  📍 Adres tonen                                   [✓]                │
│  🗺️ Google Maps embed                            [ ]                │
│                                                                       │
│  📝 Contactformulier                              [✓]                │
│  └── Stuurt email naar winkel email                                  │
│                                                                       │
│  🕐 Openingstijden                                [ ]                │
│  └── [Tekst veld voor openingstijden]                               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Floating WhatsApp Widget

### Probleem
Winkels willen optioneel een floating WhatsApp knop tonen op elke pagina.

### Oplossing
Toggle in Storefront Functies + configuratie voor gedrag.

### Database Schema

```sql
-- Floating Widget Configuration (als onderdeel van tenant_theme_settings)
ALTER TABLE public.tenant_theme_settings ADD COLUMN IF NOT EXISTS floating_widget_config JSONB DEFAULT '{
  "whatsapp_enabled": false,
  "whatsapp_position": "bottom-right",
  "whatsapp_prefill_message": "Hallo!",
  "whatsapp_show_on_mobile": true,
  "whatsapp_delay_seconds": 3
}'::jsonb;
```

### UI Ontwerp

```text
💬 FLOATING WIDGETS
┌─────────────────────────────────────────────────────────────────────┐
│  WhatsApp Chat Bubble                              [✓]              │
│  ─────────────────────────────────────────────────────────────────  │
│  Toon een floating WhatsApp knop op elke pagina                      │
│                                                                       │
│  Positie:          [Bottom Right ▼]                                  │
│  Vertraging:       [3] seconden                                      │
│  Prefill bericht:  [Hallo! Hoe kan ik je helpen?                  ] │
│  Toon op mobiel:   [✓]                                              │
│                                                                       │
│  ⚠️ Vereist dat WhatsApp Business is gekoppeld                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. AI Assistentie Centrum

Dit is het meest complexe onderdeel - een nieuwe settings sectie die alle AI-gerelateerde klantinteractie configureert.

### Nieuwe Settings Sectie

```typescript
// In Settings.tsx toevoegen aan 'channels' groep:
{
  id: 'ai-assistant',
  title: 'AI Assistent',
  icon: Bot,
  component: AIAssistantSettings
}
```

### Database Schema

```sql
-- AI Assistant Configuration
CREATE TABLE public.ai_assistant_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Chatbot Settings
  chatbot_enabled BOOLEAN DEFAULT false,
  chatbot_name TEXT DEFAULT 'Assistent',
  chatbot_avatar_url TEXT,
  chatbot_welcome_message TEXT DEFAULT 'Hallo! Hoe kan ik je helpen?',
  chatbot_position TEXT DEFAULT 'bottom-right',
  chatbot_theme_color TEXT,  -- null = use primary color
  
  -- Knowledge Base Settings
  knowledge_include_products BOOLEAN DEFAULT true,
  knowledge_include_categories BOOLEAN DEFAULT true,
  knowledge_include_pages BOOLEAN DEFAULT true,  -- Incl. FAQ, About, etc.
  knowledge_include_legal BOOLEAN DEFAULT true,
  knowledge_include_shipping BOOLEAN DEFAULT true,
  knowledge_custom_instructions TEXT,  -- Extra regels/content
  knowledge_forbidden_topics TEXT,     -- Wat NIET besproken mag worden
  
  -- Reply Suggestions Settings
  reply_suggestions_enabled BOOLEAN DEFAULT false,
  reply_suggestions_auto_draft BOOLEAN DEFAULT false,  -- Auto-fill of als suggestie tonen
  reply_suggestions_tone TEXT DEFAULT 'professional',  -- professional, friendly, formal
  reply_suggestions_language TEXT DEFAULT 'nl',
  
  -- Usage & Limits
  daily_limit INTEGER DEFAULT 50,  -- Antwoorden per dag
  response_delay_ms INTEGER DEFAULT 500,  -- Typing indicator delay
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(tenant_id)
);

-- Knowledge Index Cache (voor snelle context retrieval)
CREATE TABLE public.ai_knowledge_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  source_type TEXT NOT NULL,  -- 'product', 'page', 'faq', 'legal', 'shipping', 'custom'
  source_id UUID,  -- Reference naar originele record
  title TEXT NOT NULL,
  content_summary TEXT NOT NULL,  -- Gecomprimeerde versie voor context window
  content_hash TEXT NOT NULL,  -- Voor change detection
  keywords TEXT[],
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(tenant_id, source_type, source_id)
);

-- Enable RLS
ALTER TABLE public.ai_assistant_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_knowledge_index ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Tenant isolation" ON public.ai_assistant_config
  FOR ALL USING (tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant isolation" ON public.ai_knowledge_index
  FOR ALL USING (tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  ));
```

### UI Ontwerp: AI Assistent Instellingen

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  🤖 AI Assistent                                                                        │
│  ─────────────────────────────────────────────────────────────────────────────────────  │
│  Configureer AI-gestuurde klantondersteuning voor je webshop                            │
│                                                                                         │
│  ═══════════════════════════════════════════════════════════════════════════════════   │
│                                                                                         │
│  💬 AI CHATBOT VOOR WEBSHOP                                                            │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  Chatbot inschakelen                                    [✓]                     │   │
│  │  ──────────────────────────────────────────────────────────────────────────     │   │
│  │  Een slimme AI chatbot die je klanten helpt met vragen over producten,          │   │
│  │  verzending, retourneren en meer. Werkt 24/7 en kent je hele webshop.           │   │
│  │                                                                                 │   │
│  │  Naam:                [Assistent                                             ]  │   │
│  │  Welkomstbericht:     [Hallo! Hoe kan ik je helpen vandaag?                  ]  │   │
│  │  Positie:             [Rechtsonder ▼]                                           │   │
│  │  Themakleur:          [◼️ Gebruik primaire kleur]                               │   │
│  │                                                                                 │   │
│  │  💳 Verbruikt [1] AI credit per gesprek                                        │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ═══════════════════════════════════════════════════════════════════════════════════   │
│                                                                                         │
│  📨 AI ANTWOORD SUGGESTIES                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  Suggesties inschakelen                                 [✓]                     │   │
│  │  ──────────────────────────────────────────────────────────────────────────     │   │
│  │  Krijg AI-gegenereerde antwoordsuggesties in je Klantgesprekken inbox.          │   │
│  │  Je kunt suggesties accepteren, bewerken of negeren.                            │   │
│  │                                                                                 │   │
│  │  Toon als:            ○ Suggestie boven input veld                             │   │
│  │                       ◉ Concept in input veld (bewerkbaar)                     │   │
│  │                                                                                 │   │
│  │  Toon voor:           [✓] Email berichten                                      │   │
│  │                       [✓] WhatsApp berichten                                   │   │
│  │                                                                                 │   │
│  │  Tone of voice:       [Professioneel maar vriendelijk ▼]                       │   │
│  │                                                                                 │   │
│  │  💳 Verbruikt [1] AI credit per suggestie                                      │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ═══════════════════════════════════════════════════════════════════════════════════   │
│                                                                                         │
│  📚 KENNISBANK                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  De AI leert automatisch van je webshop content:                                │   │
│  │                                                                                 │   │
│  │  [✓] Producten (naam, beschrijving, prijs, voorraad)                           │   │
│  │      └── 127 producten geïndexeerd                                             │   │
│  │                                                                                 │   │
│  │  [✓] Categorieën                                                               │   │
│  │      └── 12 categorieën geïndexeerd                                            │   │
│  │                                                                                 │   │
│  │  [✓] Pagina's (Over ons, FAQ, Contact, etc.)                                   │   │
│  │      └── 5 pagina's geïndexeerd                                                │   │
│  │                                                                                 │   │
│  │  [✓] Juridische pagina's (Retourbeleid, Verzendbeleid, etc.)                   │   │
│  │      └── 7 pagina's geïndexeerd                                                │   │
│  │                                                                                 │   │
│  │  [✓] Verzendmethoden & prijzen                                                 │   │
│  │      └── 4 methoden geïndexeerd                                                │   │
│  │                                                                                 │   │
│  │  [🔄 Index vernieuwen] Laatste update: 2 uur geleden                           │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  📝 EXTRA INSTRUCTIES                                                          │   │
│  │  ──────────────────────────────────────────────────────────────────────────     │   │
│  │  Voeg extra context of regels toe die de AI moet weten:                        │   │
│  │                                                                                 │   │
│  │  [                                                                           ] │   │
│  │  [  Wij leveren alleen binnen Nederland en België.                           ] │   │
│  │  [  Bij bestellingen boven €50 is verzending gratis.                         ] │   │
│  │  [  Wij zijn geen dropshipper, alles komt uit eigen voorraad.                ] │   │
│  │  [                                                                           ] │   │
│  │                                                                                 │   │
│  │  🚫 VERBODEN ONDERWERPEN                                                       │   │
│  │  Onderwerpen waar de AI NIET over mag praten:                                  │   │
│  │                                                                                 │   │
│  │  [                                                                           ] │   │
│  │  [  - Concurrenten of prijsvergelijkingen                                    ] │   │
│  │  [  - Inkoopprijzen of marges                                                ] │   │
│  │  [  - Persoonlijke gegevens van medewerkers                                  ] │   │
│  │  [                                                                           ] │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ─────────────────────────────────────────────────────────────────────────────────────  │
│  ℹ️ De AI respecteert altijd je instructies en weigert verboden onderwerpen.           │
│     Bij complexe vragen verwijst de chatbot naar menselijk contact.                     │
│                                                                                         │
│                                                    [Opslaan]                            │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Edge Functions

### 4.1 `ai-build-knowledge-index`

Indexeert alle content van de webshop voor snelle context retrieval.

```typescript
// supabase/functions/ai-build-knowledge-index/index.ts
// Verzamelt:
// - Producten (naam, beschrijving, prijs, voorraad status)
// - Categorieën
// - Storefront pagina's
// - Legal pages
// - Shipping methods
// - FAQs
// Comprimeert naar ~500 tokens per item
// Slaat op in ai_knowledge_index
```

### 4.2 `ai-chatbot-respond`

Verwerkt chatbot berichten van klanten.

```typescript
// supabase/functions/ai-chatbot-respond/index.ts
// 1. Haalt ai_assistant_config op
// 2. Haalt relevante knowledge op basis van vraag
// 3. Bouwt context met custom_instructions + forbidden_topics
// 4. Genereert antwoord via Lovable AI
// 5. Logt conversatie + credit verbruik
```

### 4.3 `ai-suggest-reply`

Genereert antwoordsuggesties voor de inbox.

```typescript
// supabase/functions/ai-suggest-reply/index.ts
// 1. Haalt klantbericht + conversatie history
// 2. Haalt relevante knowledge
// 3. Genereert suggestie in gewenste tone
// 4. Returned als draft (niet verzonden!)
```

---

## 5. Inbox Integratie

### Aangepaste ReplyComposer

```text
┌─────────────────────────────────────────────────────────────────────┐
│  💡 AI Suggestie                                         [Negeren] │
│  ──────────────────────────────────────────────────────────────────│
│  "Bedankt voor je bericht! Je bestelling #1234 is vandaag          │
│   verzonden met PostNL. Je kunt de track & trace hier volgen:      │
│   [link]. Mocht je nog vragen hebben, laat het gerust weten!"      │
│                                                                     │
│                                    [✏️ Bewerken] [✓ Gebruiken]     │
└─────────────────────────────────────────────────────────────────────┘
│                                                                     │
│  [Typ je antwoord of gebruik de AI suggestie...                  ] │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. Bestandsoverzicht

| Bestand | Actie | Beschrijving |
|---------|-------|--------------|
| **Database** | | |
| `supabase/migrations/xxx_ai_assistant.sql` | Nieuw | AI config + knowledge index tabellen |
| **Types** | | |
| `src/types/ai-assistant.ts` | Nieuw | TypeScript types voor AI configuratie |
| **Hooks** | | |
| `src/hooks/useAIAssistant.ts` | Nieuw | CRUD voor AI instellingen |
| `src/hooks/useAISuggestion.ts` | Nieuw | Fetch suggesties voor inbox |
| **Components - Settings** | | |
| `src/components/admin/settings/AIAssistantSettings.tsx` | Nieuw | Hoofd AI settings component |
| `src/components/admin/settings/AIKnowledgeConfig.tsx` | Nieuw | Kennisbank configuratie |
| `src/components/admin/settings/AIChatbotConfig.tsx` | Nieuw | Chatbot specifieke settings |
| `src/components/admin/settings/AIReplyConfig.tsx` | Nieuw | Reply suggesties config |
| **Components - Inbox** | | |
| `src/components/admin/inbox/AISuggestionBox.tsx` | Nieuw | Suggestie weergave boven input |
| `src/components/admin/inbox/ReplyComposer.tsx` | Update | Integratie met AI suggesties |
| **Components - Storefront** | | |
| `src/components/admin/storefront/ContactPageConfig.tsx` | Nieuw | Contact pagina instellingen |
| `src/components/admin/storefront/FloatingWidgetConfig.tsx` | Nieuw | Floating widget settings |
| `src/components/admin/storefront/StorefrontFeaturesSettings.tsx` | Update | Toevoegen contact + widget secties |
| **Edge Functions** | | |
| `supabase/functions/ai-build-knowledge-index/` | Nieuw | Indexeer webshop content |
| `supabase/functions/ai-chatbot-respond/` | Nieuw | Chatbot antwoorden |
| `supabase/functions/ai-suggest-reply/` | Nieuw | Reply suggesties |
| **Updates** | | |
| `src/pages/admin/Settings.tsx` | Update | Toevoegen AI Assistent sectie |
| `src/types/storefront-config.ts` | Update | Contact + widget config types |

---

## 7. Implementatie Volgorde

1. **Database Migration** - AI config tabellen + storefront config uitbreidingen
2. **Types** - TypeScript interfaces voor alle nieuwe data
3. **Storefront Config** - Contact pagina + floating widget toggles
4. **AI Settings UI** - Volledige AI Assistent settings pagina
5. **Knowledge Index** - Edge function voor content indexering
6. **Chatbot Backend** - Edge function voor chatbot responses
7. **Reply Suggestions** - Edge function + inbox integratie
8. **Frontend Widgets** - Chatbot widget + floating WhatsApp voor storefront

---

## 8. AI Credit Verbruik

| Feature | Credits per actie |
|---------|-------------------|
| Chatbot conversatie | 1 credit |
| Reply suggestie | 1 credit |
| Knowledge index rebuild | 0 credits (achtergrond taak) |

---

## 9. Veiligheid & Privacy

- **Forbidden topics** worden strikt afgedwongen in system prompt
- **Custom instructions** worden als context meegegeven, niet als user input
- Chatbot maakt duidelijk dat het een AI is
- Bij complexe vragen: "Neem contact op met onze klantenservice"
- Alle conversaties worden gelogd voor review
- GDPR: klanten kunnen hun chatgeschiedenis opvragen/verwijderen

