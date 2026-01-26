
# Plan: Intelligente & Lerende AI met Web Research & Gebruikerspersonalisatie

## Samenvatting

Dit plan transformeert de AI van een "domme FAQ bot" naar een **intelligente, lerende assistent** die:
1. **Web research kan doen** via de Perplexity connector wanneer webshop-kennis onvoldoende is
2. **Leert op gebruikersniveau** - onthoudt voorkeuren per medewerker (handtekening, tone, stijl)
3. **Feedback verzamelt** - vraagt klanten na chatbot-gesprekken hoe het was
4. **Reply edits trackt** - leert van wijzigingen aan AI-suggesties

---

## 1. Web Research Integratie

### Probleem
De AI kent alleen webshop-content. Bij algemene vragen of complexe onderwerpen heeft hij geen antwoord.

### Oplossing
Integratie met **Perplexity API** voor web research als fallback/verrijking.

```text
┌─────────────────────────────────────────────────────────────────┐
│  KLANT VRAAG                                                    │
│  ─────────────                                                  │
│  "Wat is het verschil tussen LED en OLED televisies?"          │
│                                                                 │
│  ┌─────────────────────────────────────────────────┐           │
│  │  1️⃣ Check webshop kennis                        │           │
│  │     → Geen relevante producten gevonden         │           │
│  │                                                 │           │
│  │  2️⃣ Web research (Perplexity)                  │           │
│  │     → "LED gebruikt achtergrondverlichting,    │           │
│  │        OLED heeft zelf-verlichtende pixels..." │           │
│  │                                                 │           │
│  │  3️⃣ Combineer met winkel context              │           │
│  │     → "...In onze winkel hebben we OLED       │           │
│  │        modellen vanaf €999. Bekijk onze       │           │
│  │        TV-collectie hier: [link]"             │           │
│  └─────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

### Configuratie in AI Assistent Settings

```text
🔍 WEB RESEARCH
┌─────────────────────────────────────────────────────────────────┐
│  Web research inschakelen                      [✓]              │
│  ─────────────────────────────────────────────────────────────  │
│  Sta de AI toe om het web te doorzoeken voor vragen buiten      │
│  je webshop content. Maakt gebruik van Perplexity AI.           │
│                                                                  │
│  Wanneer gebruiken:                                              │
│  ○ Alleen als webshop-kennis geen antwoord geeft                │
│  ◉ Altijd verrijken met relevante web-info                      │
│                                                                  │
│  Toegestane onderwerpen:                                         │
│  [✓] Productadvies & vergelijkingen                             │
│  [✓] Algemene informatie over productcategorieën                │
│  [ ] Prijsvergelijkingen met concurrenten                       │
│  [ ] Nieuws & actualiteiten                                     │
│                                                                  │
│  ⚠️ Vereist Perplexity koppeling. [Koppelen →]                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Leren op Gebruikersniveau

### Probleem
Huidige learning is alleen op **tenant-niveau**. Maar elke medewerker heeft eigen voorkeuren:
- Medewerker A tekent af met "Met vriendelijke groet, Anna"
- Medewerker B gebruikt altijd emoji's
- Medewerker C is zeer formeel

### Oplossing
**Gebruikers-specifieke learning patterns** die automatisch worden toegepast.

### Database Uitbreiding

```sql
-- User-level learning patterns (naast bestaande tenant-level)
CREATE TABLE public.ai_user_learning_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  pattern_type TEXT NOT NULL,  -- 'signature', 'greeting', 'emoji_usage', 'tone', etc.
  learned_value JSONB NOT NULL DEFAULT '{}',
  confidence_score DECIMAL(3,2) DEFAULT 0.3,  -- 0.0 - 1.0
  sample_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, pattern_type)
);

-- Track repeat behaviors
CREATE TABLE public.ai_user_behavior_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  behavior_type TEXT NOT NULL,  -- 'edit_signature', 'add_greeting', 'change_tone'
  behavior_value TEXT NOT NULL,
  occurrence_count INTEGER DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, behavior_type, behavior_value)
);
```

### Learning Logica

```typescript
// Na 3x dezelfde wijziging → leren
// Na 5x dezelfde wijziging → automatisch toepassen

const LEARN_THRESHOLD = 3;      // Start suggereren
const AUTO_APPLY_THRESHOLD = 5; // Automatisch toepassen
```

### Voorbeeld Flow

```text
┌─────────────────────────────────────────────────────────────────┐
│  SCENARIO: Anna past 5x haar handtekening aan                   │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  1️⃣ Eerste keer:                                               │
│     AI suggestie: "Groeten, Team Shop"                         │
│     Anna wijzigt naar: "Hartelijke groet, Anna ♥️"              │
│     → Log: signature_edit = "Hartelijke groet, Anna ♥️" (1x)    │
│                                                                 │
│  2️⃣ Tweede keer: idem                                          │
│     → Count: 2x                                                 │
│                                                                 │
│  3️⃣ Derde keer: idem                                           │
│     → Count: 3x ✓ LEARN_THRESHOLD                              │
│     → Sla op als user_pattern: signature                        │
│     → Toast: "We onthouden je handtekening voortaan!"          │
│                                                                 │
│  4️⃣ Vierde keer: AI suggestie bevat al haar handtekening!      │
│     → Anna is blij, geen edit nodig                            │
│                                                                 │
│  5️⃣ Vijfde keer: AUTO_APPLY_THRESHOLD bereikt                  │
│     → Pattern confidence = 0.9 (zeer zeker)                     │
│     → Altijd automatisch toepassen                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Chatbot Feedback Systeem

### Probleem
We weten niet of klanten tevreden zijn met chatbot-antwoorden.

### Oplossing
Na elk chatbot-gesprek een korte feedback vraag.

### UI Flow

```text
┌─────────────────────────────────────────────────────────────────┐
│  🤖 Assistent                                                   │
│  ─────────────────────────────────────────────────────────────  │
│  Ik hoop dat ik je goed heb kunnen helpen! Mag ik je iets       │
│  vragen?                                                        │
│                                                                 │
│  Hoe was dit gesprek?                                           │
│                                                                 │
│  [😊 Goed]  [😐 Neutraal]  [😔 Niet zo goed]                    │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│  💡 Je kunt ook altijd contact opnemen met onze klantenservice  │
└─────────────────────────────────────────────────────────────────┘
```

### Feedback Data Opslag

```sql
-- Chatbot conversation & feedback
CREATE TABLE public.ai_chatbot_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,  -- Browser session
  
  messages JSONB NOT NULL DEFAULT '[]',
  message_count INTEGER DEFAULT 0,
  
  -- Feedback (optioneel)
  feedback_rating INTEGER,  -- 1 = slecht, 2 = neutraal, 3 = goed
  feedback_comment TEXT,
  feedback_submitted_at TIMESTAMPTZ,
  
  -- Context
  initial_question TEXT,
  topics_discussed TEXT[],
  web_research_used BOOLEAN DEFAULT false,
  escalated_to_human BOOLEAN DEFAULT false,
  
  -- Meta
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Learning van Feedback

```typescript
// Bij negatieve feedback:
// 1. Analyseer het gesprek met AI
// 2. Identificeer probleem: 
//    - Antwoord was fout → verbeter kennisbank
//    - Vraag was te complex → pas escalatie drempel aan
//    - Klant wilde menselijk contact → voeg snellere handoff toe
// 3. Update ai_learning_patterns met bevindingen
```

---

## 4. Reply Suggestion Learning (Bestaand + Uitbreiding)

### Huidige Situatie
Er is al een `ai-learn-from-feedback` edge function die tenant-level patronen leert van edits.

### Uitbreiding: User-Level Learning

```typescript
// Bij elke edit aan AI suggestie:
// 1. Log de edit in ai_user_behavior_log
// 2. Check of dit pattern al eerder voorkwam
// 3. Als occurrence_count >= LEARN_THRESHOLD:
//    - Maak/update ai_user_learning_patterns
//    - Volgende keer: pas automatisch toe
```

### Patterns om te Leren

| Pattern Type | Voorbeeld | Auto-apply na |
|--------------|-----------|---------------|
| `signature` | "Met vriendelijke groet, Anna" | 5x |
| `greeting` | "Beste {naam}," vs "Hoi {naam}!" | 5x |
| `emoji_usage` | Veel 👍😊🎉 of geen | 3x |
| `tone` | Formeel vs informeel | 5x |
| `cta_style` | "Klik hier" vs "Je kunt hier..." | 3x |
| `length_preference` | Kort en bondig vs uitgebreid | 5x |

---

## 5. Implementatie Bestandsoverzicht

| Bestand | Actie | Beschrijving |
|---------|-------|--------------|
| **Database** | | |
| `supabase/migrations/xxx_ai_learning.sql` | Nieuw | User patterns + behavior log + chatbot conversations |
| **Types** | | |
| `src/types/ai-assistant.ts` | Update | Web research config + user learning types |
| `src/types/aiActions.ts` | Update | User learning pattern types |
| **Hooks** | | |
| `src/hooks/useUserLearningPatterns.ts` | Nieuw | CRUD voor user-specifieke learning |
| `src/hooks/useAIFeedback.ts` | Update | User-level tracking toevoegen |
| **Edge Functions** | | |
| `supabase/functions/ai-suggest-reply/index.ts` | Nieuw | Reply suggesties met user patterns |
| `supabase/functions/ai-chatbot-respond/index.ts` | Nieuw | Chatbot met web research |
| `supabase/functions/ai-build-knowledge-index/index.ts` | Nieuw | Knowledge indexering |
| `supabase/functions/ai-learn-from-feedback/index.ts` | Update | User-level learning toevoegen |
| **Components** | | |
| `src/components/admin/settings/AIAssistantSettings.tsx` | Update | Web research config sectie |
| `src/components/admin/settings/AILearningInsights.tsx` | Nieuw | Toon wat AI heeft geleerd |
| `src/components/admin/inbox/AISuggestionBox.tsx` | Update | Toon user-specific aanpassingen |
| **Storefront** | | |
| `src/components/storefront/AIChatbotWidget.tsx` | Nieuw | Chatbot widget met feedback |

---

## 6. Edge Function: ai-suggest-reply (Slim)

```typescript
// supabase/functions/ai-suggest-reply/index.ts

// STAP 1: Haal context
// - Tenant knowledge (producten, FAQ, etc.)
// - User learning patterns (handtekening, tone, etc.)
// - Conversatie history

// STAP 2: Bouw prompt met user patterns
const userPatterns = await getUserPatterns(userId, tenantId);
const systemPrompt = `
Je bent een klantenservice assistent voor ${tenantName}.

## Kennisbank
${knowledgeContext}

## Stijlvoorkeuren van deze medewerker
${userPatterns.signature ? `- Ondertekent altijd met: "${userPatterns.signature}"` : ''}
${userPatterns.tone ? `- Voorkeurstooon: ${userPatterns.tone}` : ''}
${userPatterns.emoji_usage ? `- Emoji gebruik: ${userPatterns.emoji_usage}` : ''}
${userPatterns.greeting ? `- Begroeting: ${userPatterns.greeting}` : ''}

## Verboden onderwerpen
${forbiddenTopics}
`;

// STAP 3: Genereer reply
// STAP 4: Track voor learning (als user edit, update patterns)
```

---

## 7. Edge Function: ai-chatbot-respond (Met Web Research)

```typescript
// supabase/functions/ai-chatbot-respond/index.ts

// STAP 1: Check webshop kennis
const relevantKnowledge = await searchKnowledgeIndex(question, tenantId);

// STAP 2: Als onvoldoende, doe web research
let webResearch = null;
if (config.web_research_enabled && relevantKnowledge.confidence < 0.5) {
  webResearch = await searchPerplexity(question, config.allowed_topics);
}

// STAP 3: Bouw antwoord
const systemPrompt = `
Je bent ${config.chatbot_name}, de AI assistent van ${tenantName}.

## Beschikbare kennis
${relevantKnowledge.content}

## Aanvullende informatie (web research)
${webResearch ? webResearch.answer : 'Geen aanvullende info beschikbaar.'}

## Regels
- Wees behulpzaam en vriendelijk
- Verwijs naar producten waar relevant
- Bij complexe vragen: bied menselijk contact aan
- NOOIT bespreken: ${config.forbidden_topics}
`;

// STAP 4: Track conversatie
await saveConversation(sessionId, messages);

// STAP 5: Na X berichten, vraag feedback
if (messageCount >= 3 && !feedbackAsked) {
  response.askFeedback = true;
}
```

---

## 8. AI Assistent Settings UI Update

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  🤖 AI Assistent                                                                        │
│  ─────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                         │
│  [Bestaande secties: Chatbot, Reply Suggesties, Kennisbank]                            │
│                                                                                         │
│  ═══════════════════════════════════════════════════════════════════════════════════   │
│                                                                                         │
│  🔍 WEB RESEARCH (NIEUW)                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  Web research inschakelen                               [✓]                     │   │
│  │  ──────────────────────────────────────────────────────────────────────────     │   │
│  │  De AI kan het web doorzoeken voor vragen buiten je webshop content.            │   │
│  │                                                                                 │   │
│  │  ⚠️ Vereist Perplexity koppeling [Koppelen →]                                  │   │
│  │                                                                                 │   │
│  │  Toegestane onderwerpen:                                                        │   │
│  │  [✓] Productadvies                                                             │   │
│  │  [✓] Algemene kennis                                                           │   │
│  │  [ ] Prijsvergelijkingen                                                       │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ═══════════════════════════════════════════════════════════════════════════════════   │
│                                                                                         │
│  🧠 LEERGEDRAG (NIEUW)                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  De AI leert van je team's interacties:                                         │   │
│  │                                                                                 │   │
│  │  📊 Geleerde patronen                                                          │   │
│  │  ──────────────────────────────────────────────────────────────────────────     │   │
│  │                                                                                 │   │
│  │  👤 Anna (12 patronen geleerd)                                                 │   │
│  │     ├── Handtekening: "Hartelijke groet, Anna ♥️" (100% zeker)                 │   │
│  │     ├── Tone: Vriendelijk en informeel (85% zeker)                             │   │
│  │     └── Emoji's: Veel gebruikt (90% zeker)                                     │   │
│  │                                                                                 │   │
│  │  👤 Mark (3 patronen geleerd)                                                  │   │
│  │     ├── Handtekening: "Met vriendelijke groet, M. Jansen" (75% zeker)          │   │
│  │     └── Tone: Zakelijk (60% zeker)                                             │   │
│  │                                                                                 │   │
│  │  [Patronen bekijken] [Wissen]                                                  │   │
│  │                                                                                 │   │
│  │  ┌───────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │  ℹ️ Patronen worden automatisch geleerd na 3+ herhalingen.               │ │   │
│  │  │     Na 5+ herhalingen worden ze automatisch toegepast.                    │ │   │
│  │  └───────────────────────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ═══════════════════════════════════════════════════════════════════════════════════   │
│                                                                                         │
│  😊 CHATBOT FEEDBACK (NIEUW)                                                           │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  Feedback vragen na gesprek                             [✓]                     │   │
│  │  ──────────────────────────────────────────────────────────────────────────     │   │
│  │  Vraag klanten om feedback na chatbot-gesprekken.                               │   │
│  │                                                                                 │   │
│  │  Laatste 7 dagen:                                                               │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐           │   │
│  │  │  😊 Goed: 45 (72%)                                              │           │   │
│  │  │  😐 Neutraal: 12 (19%)                                          │           │   │
│  │  │  😔 Niet goed: 6 (9%)                                           │           │   │
│  │  │                                                                 │           │   │
│  │  │  Totaal gesprekken: 89 | Met feedback: 63 (71%)                │           │   │
│  │  └─────────────────────────────────────────────────────────────────┘           │   │
│  │                                                                                 │   │
│  │  [📊 Gedetailleerde feedback bekijken]                                         │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Implementatie Volgorde

1. **Database Migration** - User learning tables + chatbot conversations
2. **Types Update** - Web research + user learning types
3. **Edge Function: ai-suggest-reply** - Reply suggesties met user patterns
4. **Edge Function: ai-chatbot-respond** - Chatbot met web research
5. **Edge Function: ai-build-knowledge-index** - Content indexering
6. **Hooks** - useUserLearningPatterns + update useAIFeedback
7. **Settings UI** - Web research config + learning insights
8. **Storefront Widget** - Chatbot met feedback

---

## 10. AI Credits Verbruik (Geüpdatet)

| Feature | Credits per actie |
|---------|-------------------|
| Chatbot conversatie (zonder web) | 1 credit |
| Chatbot conversatie (met web research) | 2 credits |
| Reply suggestie | 1 credit |
| Learning analyse (bij edit) | 0 credits (achtergrond) |
| Knowledge index rebuild | 0 credits |

---

## 11. Connector Vereiste

- **Perplexity** connector nodig voor web research functionaliteit
- Zonder connector werkt de chatbot nog steeds, maar alleen met webshop-kennis
- Toggle in settings is gedisabled zonder actieve connector
