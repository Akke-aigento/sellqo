
<context>
Gebruiker merkt dat AI-inbox antwoordsuggesties “opnieuw” (anders) worden bij refresh, i.p.v. dezelfde suggestie te blijven tonen tot men zelf opnieuw vraagt.

Ik heb de huidige implementatie bekeken:
- Frontend gebruikt `useAISuggestion` + `ReplyComposer` om een suggestie op te halen en eerst een cached suggestie te proberen laden.
- Backend functie `ai-suggest-reply` probeert de suggestie te cachen in de tabel `ai_reply_suggestions` via `upsert`.
</context>

<findings>
1) Caching faalt voor gesprekken waarvan de “conversation id” géén UUID is
- In de database-migratie voor `ai_reply_suggestions` staat:
  - `conversation_id UUID NOT NULL`
- In de inbox wordt een conversatie echter gegroepeerd met:
  - `const key = msg.customer_id || msg.from_email || msg.to_email || 'unknown'`
  - Daardoor kan `conversation.id` een e-mailadres zijn (bv. `"aaron.mercken@hotmail.com"`) wanneer `customer_id` (nog) null is.
- In `ai-suggest-reply` logs zien we expliciet:
  - `Failed to cache suggestion ... invalid input syntax for type uuid: "aaron.mercken@hotmail.com"`
- Resultaat:
  - De suggestion wordt wel gegenereerd, maar niet opgeslagen.
  - Bij refresh is er dus geen cache → gebruiker krijgt (weer) een nieuwe suggestion.

2) De huidige cache lookup is strenger dan nodig
- Zowel frontend als backend zoeken cache op basis van `(tenant_id, conversation_id, message_id)`.
- In de praktijk is “één suggestie per inbound message” voldoende: `(tenant_id, message_id)` is de stabiele sleutel.
</findings>

<goal>
- Een AI-suggestie moet stabiel blijven (zelfde tekst) bij refresh zolang het over dezelfde inbound message gaat.
- Credits mogen niet opnieuw verbruikt worden wanneer een cached suggestion bestaat.
- Dit moet ook werken voor oudere threads/legacy data waar `customer_id` soms nog null is.
</goal>

<solution_overview>
We maken caching “per message”, en we zorgen dat het cache-record altijd kan opgeslagen worden:
1) Database: maak `ai_reply_suggestions.conversation_id` een tekstveld (zodat email/phone keys niet crashen).
2) Database: wijzig uniqueness en indexering naar `(tenant_id, message_id)` (message-based caching).
3) Backend functie `ai-suggest-reply`: cache lookup + upsert op `(tenant_id, message_id)` i.p.v. conversation_id.
4) Frontend hook `useAISuggestion` + `ReplyComposer`: cached suggestion laden op basis van `messageId` (conversationId wordt niet meer gebruikt voor caching).
</solution_overview>

<implementation_steps>
<step number="1" title="Database wijziging (migratie)">
A) Wijzig kolomtype:
- `ALTER TABLE public.ai_reply_suggestions ALTER COLUMN conversation_id TYPE text USING conversation_id::text;`

B) Pas unique constraint aan:
- Verwijder bestaande constraint: `unique_suggestion_per_message UNIQUE (tenant_id, conversation_id, message_id)`
- Maak nieuwe constraint: `UNIQUE (tenant_id, message_id)`  
  (Zo is er exact één suggestion per inbound message per tenant.)

C) Pas indexen aan (performance):
- Vervang/maak index voor snelle lookup:
  - `CREATE INDEX ... ON ai_reply_suggestions(tenant_id, message_id);`
- (Optioneel) extra index op `conversation_id` als we later willen filteren in admin/debug.

Opmerking: deze wijziging is backward-compatible voor bestaande (uuid) conversation_id waarden, omdat UUID → text wordt geconverteerd.
</step>

<step number="2" title="Backend functie aanpassen (ai-suggest-reply)">
In `supabase/functions/ai-suggest-reply/index.ts`:
A) Cache check aanpassen:
- Vervang lookup van:
  - `.eq('conversation_id', conversation_id).eq('message_id', message_id)`
- Naar:
  - `.eq('tenant_id', tenant_id).eq('message_id', message_id)`

B) Cache upsert aanpassen:
- Upsert blijft doen, maar `onConflict` wordt:
  - `onConflict: 'tenant_id,message_id'`
- `conversation_id` blijven opslaan als “context” (string) in de tabel (handig voor debugging/rapportering), maar niet meer nodig voor caching.

C) Verwacht resultaat:
- Geen “invalid uuid” caching errors meer.
- Suggestie wordt consequent als cached teruggegeven bij refresh.
</step>

<step number="3" title="Frontend caching aanpassen (useAISuggestion + ReplyComposer)">
A) `src/hooks/useAISuggestion.ts`
- `loadCachedSuggestion(conversationId, messageId)` ombouwen naar:
  - `loadCachedSuggestion(messageId)`
- Query enkel op:
  - `tenant_id` + `message_id`
- State updates (setSuggestion/setIsCached) blijven hetzelfde.

B) `src/components/admin/inbox/ReplyComposer.tsx`
- In de useEffect die cached suggestions laadt:
  - roep `loadCachedSuggestion(lastInboundMessage.id)` aan
  - i.p.v. `loadCachedSuggestion(conversation.id, messageId)`
- Zo is caching volledig onafhankelijk van hoe conversaties gegroepeerd worden.

C) Klein dependency-detail:
- De useEffect dependencies kunnen we opschonen zodat het gedrag voorspelbaar blijft (geen onverwachte re-triggers), maar functioneel is dit secundair.
</step>

<step number="4" title="Validatie / testen (end-to-end)">
1) Open een conversatie met een inbound bericht.
2) Klik “AI suggestie” (of auto-generate indien aan).
3) Controleer dat de UI “(gecached)” toont bij herladen (refresh).
4) Controleer dat credits niet opnieuw dalen bij refresh.
5) Test ook een legacy thread waarbij eerder `customer_id` null was (bv. gesprek-ID = email string), want daar faalde caching vandaag.
6) Optioneel: kijk in backend logs of “Failed to cache suggestion … invalid uuid …” niet meer voorkomt.
</step>
</implementation_steps>

<edge_cases>
- Als message_id ontbreekt (zou zelden moeten gebeuren), wordt er nog steeds niet gecached (bestaand gedrag).
- Als een gebruiker “Hergenereren” doet:
  - de bestaande cache wordt overschreven (op dezelfde message_id) en credits worden gebruikt (verwacht gedrag).
</edge_cases>

<what_this_fixes>
- De suggestie blijft identiek bij refresh voor dezelfde inbound message.
- Geen cache-fails meer door conversation_id = email/phone.
- Minder “random” gevoel voor de gebruiker: suggestion is stabiel tot men actief hergenereert.
</what_this_fixes>

<files_touched>
- Database migratie: `ai_reply_suggestions` schema (conversation_id type + constraint + index)
- `supabase/functions/ai-suggest-reply/index.ts`
- `src/hooks/useAISuggestion.ts`
- `src/components/admin/inbox/ReplyComposer.tsx`
</files_touched>
