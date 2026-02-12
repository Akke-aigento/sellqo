

# In-App AI Hulp Assistent voor Tenants

## Overzicht

Een chatbot widget rechtsonder in het admin dashboard die tenant-gebruikers kunnen gebruiken om vragen te stellen over het platform. De bot leest direct uit de `doc_articles` tabel (tenant-level) als kennisbank, waardoor hij automatisch up-to-date is bij elke documentatiewijziging.

---

## Architectuur

```text
Gebruiker typt vraag in widget
       |
       v
Frontend stuurt: { message, conversation_history, current_route }
       |
       v
Edge Function: "ai-help-assistant"
       |
       +--> Haalt tenant docs op uit doc_articles (doc_level='tenant', is_published=true)
       +--> Haalt tenant context op (plan, features)
       +--> Stuurt alles naar Lovable AI (gemini-3-flash-preview)
       +--> Slaat onbeantwoorde vragen op als de bot het niet weet
       |
       v
Streaming response terug naar widget
```

Belangrijk verschil met de bestaande `ai-chatbot-respond`: die is bedoeld voor de **storefront** (klant-facing chatbot). Deze nieuwe functie is voor het **admin dashboard** (tenant-facing helpbot). Volledig gescheiden systemen.

---

## Database

### Nieuwe tabel: `ai_help_conversations`

| Kolom | Type | Beschrijving |
|-------|------|-------------|
| id | UUID PK | |
| tenant_id | UUID FK | |
| user_id | UUID | De admin-gebruiker die de vraag stelt |
| messages | JSONB | Volledige conversatiegeschiedenis |
| current_route | TEXT | Laatst bekende route voor context |
| message_count | INT | Aantal berichten |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### Nieuwe tabel: `ai_help_unanswered`

| Kolom | Type | Beschrijving |
|-------|------|-------------|
| id | UUID PK | |
| tenant_id | UUID FK | |
| user_id | UUID | |
| question | TEXT | De onbeantwoorde vraag |
| current_route | TEXT | Waar de gebruiker was |
| created_at | TIMESTAMPTZ | |
| resolved | BOOLEAN default false | Of we het later hebben opgelost |

### RLS
- `ai_help_conversations`: gebruiker kan alleen eigen conversaties lezen/schrijven
- `ai_help_unanswered`: schrijfbaar door authenticated users, leesbaar alleen door platform admins

---

## Edge Function: `ai-help-assistant`

### Werking
1. Ontvangt `{ message, conversation_history, current_route }` + auth token
2. Haalt de gebruiker's `tenant_id` op via auth
3. Haalt **alle gepubliceerde tenant docs** op: `SELECT title, content, excerpt, tags, context_path FROM doc_articles WHERE doc_level = 'tenant' AND is_published = true`
4. Sorteert artikelen op relevantie: artikelen waarvan `context_path` matcht met `current_route` krijgen prioriteit
5. Haalt tenant context op: abonnement/plan, actieve features
6. Bouwt systeemprompt met strikte regels (geen technische info, geen platform admin info)
7. Streamt response via SSE terug naar frontend
8. Als het antwoord een "ik weet het niet" bevat, slaat de vraag op in `ai_help_unanswered`

### Systeemprompt (kern)
- "Je bent de SellQo Hulp Assistent"
- Kennisbank = alle tenant doc_articles content
- Contextbewust: "De gebruiker bevindt zich momenteel op: [route]"
- Tenant context: "Dit account heeft het [plan] abonnement met deze features: [...]"
- Strikte verboden: technische details, API info, platform admin, andere tenants, bedrijfsdata
- Bij onbekende vragen: eerlijk aangeven + verwijzen naar support

### Streaming
Dezelfde SSE-aanpak als bestaande AI functies. Response wordt token-voor-token gestreamd.

---

## Frontend Componenten

### `AIHelpWidget.tsx` (floating widget)
- Vaste positie rechtsonder in het dashboard (z-index boven alles)
- Klein icoon (MessageCircleQuestion) dat uitklapt tot chatvenster
- Chat interface met:
  - Berichtenlijst met markdown rendering
  - Input veld
  - Streaming response weergave
  - "Vraag het de assistent" knop op de Help pagina
- Stuurt automatisch `window.location.pathname` mee als context
- Conversatiegeschiedenis wordt in lokale state bijgehouden (reset bij nieuwe sessie)
- Toegevoegd in `AdminLayout.tsx` zodat het op elke admin pagina beschikbaar is

### `AIHelpChatWindow.tsx` (het chatvenster zelf)
- Maximaal ~400px breed, ~500px hoog
- Scrollable berichtenlijst
- Berichten renderen met `react-markdown` (of dangerouslySetInnerHTML met basis HTML)
- Loading indicator tijdens streaming
- Optie om conversatie te sluiten/resetten

### Integratie met Help pagina
- Een "Vraag het de assistent" knop op `Help.tsx` die de widget opent
- Optioneel: als gebruiker vanuit een specifiek artikel de assistent opent, wordt de artikeltitel als context meegegeven

---

## Bestanden

| Bestand | Actie |
|---------|-------|
| `supabase/migrations/XXXX.sql` | Nieuwe tabellen + RLS |
| `supabase/functions/ai-help-assistant/index.ts` | Edge function met streaming |
| `supabase/config.toml` | Registreer nieuwe functie (verify_jwt = false, auth in code) |
| `src/components/admin/help/AIHelpWidget.tsx` | Floating chat widget |
| `src/components/admin/help/AIHelpChatWindow.tsx` | Chat venster component |
| `src/components/admin/AdminLayout.tsx` | Widget toevoegen |
| `src/pages/admin/Help.tsx` | "Vraag het de assistent" knop |

---

## Technische Details

### Context-detectie
De `current_route` wordt vergeleken met `context_path` van artikelen. Artikelen die matchen worden bovenaan in de kennisbank-context geplaatst, zodat het AI-model deze eerst ziet en relevantere antwoorden geeft.

### Credits
Gebruikt het bestaande `tenant_ai_credits` systeem (1 credit per vraag). De edge function roept `use_ai_credits` aan voor elke vraag.

### Veiligheid
- Auth token vereist (alleen ingelogde dashboard-gebruikers)
- Tenant-isolatie: bot ziet alleen docs van `doc_level = 'tenant'`
- Platform docs zijn onbereikbaar voor de bot -- de query filtert expliciet op `doc_level = 'tenant'`
- Systeemprompt bevat harde instructies om technische/admin info te weigeren
- Onbeantwoorde vragen zijn alleen leesbaar door platform admins

### Autonome kennisbank
Geen sync nodig. De edge function leest bij elke vraag direct uit `doc_articles`. Wanneer documentatie wordt bijgewerkt, heeft de bot direct de nieuwe kennis. Dit is de "harde koppeling" die gevraagd wordt.

