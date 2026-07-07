# Fix AI-hulpchatbot

## Probleem
1. **Backend crasht** met `tenant_id is not defined` — in `supabase/functions/ai-help-assistant/index.ts` regel 55 wordt `tenant_id` gebruikt (bestaat niet), de variabele heet `tenantId`. Elke chatvraag geeft nu 500.
2. **Onleesbare berichten** — de chat rendert markdown via naïeve regex + `dangerouslySetInnerHTML`. Lijsten, kopjes, codeblokken, links werken niet, en `prose` op een `bg-muted` bubbel geeft slechte contrast/kleuren.

## Wijzigingen

### 1. `supabase/functions/ai-help-assistant/index.ts`
- Regel 55: `authenticateRequest(req, tenant_id)` → `authenticateRequest(req, tenantId)`.

### 2. `src/components/admin/help/AIHelpChatWindow.tsx`
- Vervang de regex + `dangerouslySetInnerHTML` blok door `react-markdown` (met `remark-gfm` voor lijsten/tabellen/links). Beide zijn al in het project aanwezig — geen nieuwe dependency.
- Alleen op assistant-berichten markdown renderen; user-berichten blijven platte tekst (regel-breaks via `whitespace-pre-wrap`).
- Prose-styling aanpassen zodat tekst goed contrasteert op `bg-muted`: kleinere marges, `prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-headings:mt-2 prose-headings:mb-1`, en tekstkleur erven (`prose-invert` weg, `text-foreground` behouden).

## Geen andere wijzigingen
- Geen DB-migratie.
- Geen aanpassing aan credits/model/prompt.
- Geen aanpassingen aan `AIHelpWidget.tsx`.
