
# Plan: Inbox Verbeteringen - 5 Problemen Oplossen

## Samenvatting Problemen

1. **Vreemde lijn/cid referentie** - `[cid:cc36a120-7edc-4350-b12f-cfe62080a20f]` is een inline afbeelding (email footer/logo) die niet gerenderd wordt
2. **AI antwoord neemt hele scherm in** - Suggestie box te prominent, moet in het antwoordveld staan
3. **Geen notificatie in notificatiecentrum + geen geluid** - Edge function insert faalt (schema mismatch) en geluid/toast werkt alleen op Messages pagina
4. **Geen verwijderen/archiveren** - Gesprekken kunnen niet beheerd worden
5. **Geen mappen** - Organisatie ontbreekt

---

## Deel 1: Inline Afbeeldingen (CID-Probleem)

### Probleem
De tekst `[cid:cc36a120-...]` verschijnt omdat dit een **Content-ID referentie** is naar een inline afbeelding (typisch een logo/footer). Deze afbeeldingen zitten als bijlage in de e-mail en moeten:
1. Opgehaald worden via de Resend Attachments API
2. Opgeslagen worden in storage
3. Getoond worden inline EN als downloadbare bijlage

### Oplossing

**Stap 1: Edge Function aanpassen** (`handle-inbound-email/index.ts`)
- Na het opslaan van de message: haal bijlagen op via `resend.emails.receiving.attachments.list(emailId)`
- Download elke bijlage via de `download_url`
- Upload naar Supabase Storage bucket `message-attachments`
- Sla metadata op in `customer_message_attachments` (inclusief `content_id` veld)
- Vervang `cid:xxx` referenties in `body_html` met de storage URL

**Stap 2: Database migratie**
- Voeg `metadata JSONB` kolom toe aan `customer_message_attachments` (indien nodig, checken of dit al bestaat)
- Maak `storage_path` nullable (sommige attachments zijn nog niet gedownload)

**Stap 3: MessageBubble component**
- Render `body_html` met `dangerouslySetInnerHTML` in een sandbox (sanitized)
- Of: strip CID referenties en toon bijlagen apart

---

## Deel 2: AI Suggestie Beter Positioneren

### Huidige Situatie
De `AISuggestionBox` wordt boven de textarea getoond en neemt te veel ruimte in.

### Oplossing
Wijzig `ReplyComposer.tsx`:
1. Verplaats AI suggestie naar **binnen de textarea** als placeholder/overlay
2. Of: toon als een kleine, intrekbare banner bovenaan de composer
3. Bij "Gebruiken" → vul de textarea automatisch in
4. Bij "Bewerken" → vul in + focus op textarea
5. Voeg "Verberg" toggle toe

**UI Flow**:
```
┌─────────────────────────────────────────┐
│ [Sparkles] AI suggestie beschikbaar     │ ← Compact banner
│ "Dag [naam], bedankt voor..."  [Gebruik]│
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ Typ je antwoord...                      │
│                                         │
│                                    [📎] │
└─────────────────────────────────────────┘
```

---

## Deel 3: Notificaties + Geluid Globaal Werkend

### Probleem A: Edge Function insert faalt
De `handle-inbound-email` edge function probeert:
```javascript
await supabase.from("notifications").insert({
  ...
  is_read: false,  // ← DEZE KOLOM BESTAAT NIET!
  metadata: {...}  // ← KOLOM HEET "data", NIET "metadata"
});
```

De `notifications` tabel heeft:
- `read_at` (TIMESTAMPTZ) - niet `is_read`
- `data` (JSONB) - niet `metadata`

Hetzelfde probleem in `whatsapp-webhook` en `meta-messaging-webhook`.

### Oplossing
Fix alle edge functions die notificaties inserten:
- `handle-inbound-email/index.ts`
- `whatsapp-webhook/index.ts`
- `meta-messaging-webhook/index.ts`

Wijzig:
```javascript
// VOOR (fout)
await supabase.from("notifications").insert({
  ...
  is_read: false,
  metadata: { ... }
});

// NA (correct)
await supabase.from("notifications").insert({
  ...
  // read_at is standaard null (ongelezen)
  data: { ... }
});
```

### Probleem B: Geluid + Toast alleen op Messages pagina
Momenteel worden toast + geluid alleen getriggerd in `useInbox` hook, die alleen actief is op `/admin/messages`.

### Oplossing: Globale Notification Listener
Maak een nieuwe hook `useGlobalNotificationListener` die:
1. Realtime subscription heeft op `notifications` tabel (voor alle pagina's)
2. Bij `INSERT` event: toast toont + geluid afspeelt
3. Wrap in een provider die in `App.tsx` of `AdminLayout` wordt toegevoegd

**Nieuwe bestanden**:
- `src/hooks/useGlobalNotificationListener.ts`
- Update `src/components/admin/AdminLayout.tsx` om hook te gebruiken

---

## Deel 4: Gesprekken Verwijderen (Prullenbak)

### Database Uitbreiding
Voeg kolommen toe aan `customer_messages`:
```sql
ALTER TABLE customer_messages
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS folder_id UUID;
```

Status waarden: `active`, `archived`, `deleted`

### UI Wijzigingen

**ConversationItem.tsx**
- Voeg context menu toe (rechtermuisklik of swipe)
- Opties: Archiveren, Verwijderen, Naar map verplaatsen

**ConversationDetail.tsx Header**
- Voeg dropdown menu met acties: Archiveren, Verwijderen

**useInbox hook**
- Filter standaard op `status = 'active'`
- Voeg `archiveConversation`, `deleteConversation`, `restoreConversation` mutations toe

**InboxFilters.tsx**
- Voeg statusfilter toe: Inbox / Gearchiveerd / Prullenbak

---

## Deel 5: Mappen Systeem (3 standaard + custom)

### Database
Nieuwe tabel `inbox_folders`:
```sql
CREATE TABLE inbox_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  icon TEXT DEFAULT 'folder',
  is_system BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

Systeem mappen (automatisch aangemaakt per tenant):
- Inbox (is_system: true)
- Gearchiveerd (is_system: true)
- Prullenbak (is_system: true)

### UI
**Sidebar binnen Messages pagina**:
```
📥 Inbox (5)
📁 Gearchiveerd (12)
🗑️ Prullenbak (3)
─────────────
📁 Retour (eigen map)
📁 VIP Klanten (eigen map)
[+ Nieuwe map]
```

**FolderList.tsx component**
- Toon alle mappen
- Drag-and-drop gesprekken naar mappen
- CRUD voor custom mappen

---

## Technische Details

### Database Migratie SQL
```sql
-- 1. Voeg 'messages' toe aan notification_category enum
ALTER TYPE notification_category ADD VALUE IF NOT EXISTS 'messages';

-- 2. Update customer_messages voor status/folder tracking
ALTER TABLE customer_messages
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS folder_id UUID;

-- 3. Inbox folders tabel
CREATE TABLE IF NOT EXISTS inbox_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  icon TEXT DEFAULT 'folder',
  is_system BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, name)
);

-- 4. RLS voor inbox_folders
ALTER TABLE inbox_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their tenant folders"
  ON inbox_folders FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- 5. Foreign key voor folder_id
ALTER TABLE customer_messages
ADD CONSTRAINT fk_folder
FOREIGN KEY (folder_id) REFERENCES inbox_folders(id) ON DELETE SET NULL;

-- 6. Metadata kolom voor attachments (indien niet bestaat)
ALTER TABLE customer_message_attachments
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 7. Maak storage_path nullable (voor attachments die nog niet gedownload zijn)
ALTER TABLE customer_message_attachments
ALTER COLUMN storage_path DROP NOT NULL;

-- 8. Index voor snelle filtering
CREATE INDEX IF NOT EXISTS idx_messages_status ON customer_messages(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_messages_folder ON customer_messages(folder_id);

-- 9. Functie om standaard mappen aan te maken voor nieuwe tenants
CREATE OR REPLACE FUNCTION ensure_inbox_folders()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO inbox_folders (tenant_id, name, icon, is_system, sort_order)
  VALUES 
    (NEW.id, 'Inbox', 'inbox', true, 0),
    (NEW.id, 'Gearchiveerd', 'archive', true, 1),
    (NEW.id, 'Prullenbak', 'trash-2', true, 2)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_inbox_folders
  AFTER INSERT ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION ensure_inbox_folders();
```

### Bestanden om te Wijzigen/Maken

| Bestand | Actie | Beschrijving |
|---------|-------|--------------|
| `supabase/functions/handle-inbound-email/index.ts` | Wijzigen | Fix notification insert (data vs metadata), download attachments |
| `supabase/functions/whatsapp-webhook/index.ts` | Wijzigen | Fix notification insert schema |
| `supabase/functions/meta-messaging-webhook/index.ts` | Wijzigen | Fix notification insert schema |
| `src/hooks/useGlobalNotificationListener.ts` | Nieuw | Globale realtime listener voor notifications + geluid |
| `src/hooks/useInbox.ts` | Wijzigen | Voeg status filter, archive/delete mutations toe |
| `src/hooks/useInboxFolders.ts` | Nieuw | CRUD voor mappen |
| `src/components/admin/inbox/ReplyComposer.tsx` | Wijzigen | Compactere AI suggestie UI |
| `src/components/admin/inbox/AISuggestionBox.tsx` | Wijzigen | Compacter ontwerp |
| `src/components/admin/inbox/ConversationItem.tsx` | Wijzigen | Context menu voor acties |
| `src/components/admin/inbox/InboxFilters.tsx` | Wijzigen | Folder selector toevoegen |
| `src/components/admin/inbox/FolderList.tsx` | Nieuw | Mappen sidebar |
| `src/pages/admin/Messages.tsx` | Wijzigen | Layout met mappen sidebar |
| `src/components/admin/AdminLayout.tsx` | Wijzigen | Gebruik global notification listener |
| Database migratie | Nieuw | Alle schema wijzigingen |

---

## Implementatie Volgorde

1. **Database migratie** - Eerst schema uitbreiden
2. **Edge functions fixen** - Notification inserts corrigeren
3. **Global notification listener** - Geluid + toast overal
4. **Inbox status/archiveren** - Core functionaliteit
5. **Mappen systeem** - Folders + UI
6. **Attachments ophalen** - CID images fixen
7. **AI suggestie UI** - Compacter maken

