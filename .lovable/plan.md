
# Plan: AI Suggesties Cachen per Conversatie

## Probleem

Momenteel wordt bij elke page refresh of navigatie naar een conversatie de AI suggestie opnieuw gegenereerd:
1. React state (`useState`) is leeg na refresh
2. `useEffect` triggert en roept `fetchSuggestion` aan → kost credits
3. Dit gebeurt telkens, zelfs als de suggestie al eerder is gegenereerd

## Oplossing

AI suggesties opslaan in de database, gekoppeld aan het laatste inbound bericht. Zo wordt:
- Suggestie slechts 1x gegenereerd per klantbericht
- Bij refresh wordt de gecachte suggestie geladen (gratis)
- Regenereren is mogelijk (overschrijft de cache)

---

## Technische Aanpak

### 1. Nieuwe Database Tabel: `ai_reply_suggestions`

| Kolom | Type | Beschrijving |
|-------|------|--------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | FK naar tenants |
| `conversation_id` | UUID | Unieke ID van het gesprek |
| `message_id` | UUID | FK naar customer_messages (het klantbericht) |
| `suggestion_text` | TEXT | De gegenereerde suggestie |
| `model_used` | TEXT | Welk AI model is gebruikt |
| `created_at` | TIMESTAMPTZ | Wanneer gegenereerd |
| `regenerated_at` | TIMESTAMPTZ | Laatste regeneratie (nullable) |

**Unique constraint:** `(tenant_id, conversation_id, message_id)` → max 1 suggestie per klantbericht

### 2. Edge Function Aanpassen: `ai-suggest-reply`

```text
HUIDIGE FLOW:
┌─────────────────────────────┐
│ 1. Ontvang request          │
│ 2. Check credits            │
│ 3. Genereer met AI          │
│ 4. Return suggestie         │
└─────────────────────────────┘

NIEUWE FLOW:
┌──────────────────────────────────────────┐
│ 1. Ontvang request                       │
│ 2. Check of gecachte suggestie bestaat   │
│    → JA + niet force_regenerate?         │
│      Return cached (GEEN credits)        │
│ 3. Check credits                         │
│ 4. Genereer met AI                       │
│ 5. Sla op in ai_reply_suggestions        │
│ 6. Return suggestie                      │
└──────────────────────────────────────────┘
```

### 3. Frontend Hook Aanpassen: `useAISuggestion.ts`

- Bij het laden van een conversatie: eerst gecachte suggestie ophalen
- `fetchSuggestion` krijgt optionele `forceRegenerate` parameter
- Regenereer-knop roept `fetchSuggestion({ forceRegenerate: true })` aan

### 4. UI Aanpassing: Regenereer-knop

In `AISuggestionBox.tsx` of `ReplyComposer.tsx`:
- Voeg "Hergenereren" knop toe naast de AI-suggestie
- Toont duidelijk dat dit credits kost

---

## Bestanden te Wijzigen

| Bestand | Actie |
|---------|-------|
| Database | Nieuwe tabel `ai_reply_suggestions` |
| `supabase/functions/ai-suggest-reply/index.ts` | Cache check + opslaan |
| `src/hooks/useAISuggestion.ts` | Cache laden, `forceRegenerate` param |
| `src/components/admin/inbox/ReplyComposer.tsx` | Regenereer-knop toevoegen |
| `src/components/admin/inbox/AISuggestionBox.tsx` | Regenereer-knop styling |

---

## Resultaat

| Scenario | Gedrag | Credits |
|----------|--------|---------|
| Eerste keer suggestie | Genereren + opslaan | 1 credit |
| Page refresh | Gecachte suggestie laden | 0 credits |
| Klik "Hergenereren" | Nieuwe genereren + overschrijven | 1 credit |
| Nieuw klantbericht | Genereren + opslaan | 1 credit |

Dit zorgt voor aanzienlijke creditbesparing voor zowel tenants als het platform.
