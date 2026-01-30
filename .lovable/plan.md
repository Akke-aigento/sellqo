
# Plan: Fix Drag-and-Drop naar Custom Mappen

## Probleem Geïdentificeerd

De drag-and-drop naar custom mappen werkt niet correct door een logica-fout in de `moveToFolder` functie en de query filters.

### Oorzaak

1. **De `moveToFolder` mutatie** (useInbox.ts, regel 425-430):
   - Update ALLEEN `folder_id` op de berichten
   - Zet `message_status` NIET naar `'active'`

2. **De query filter voor custom folders** (useInbox.ts, regel 137-138):
   ```typescript
   query = query.eq('folder_id', filters.folderId).eq('message_status', 'active');
   ```
   - Vereist dat `message_status = 'active'`

3. **Consequentie**: Als een gesprek eerder is gearchiveerd (`message_status = 'archived'`), en daarna naar een custom folder wordt gesleept, wordt de `folder_id` wel correct gezet, maar de `message_status` blijft `'archived'`. Hierdoor wordt het gesprek niet getoond in de custom folder.

### Database Bewijs

Het bericht met subject "Sellqo app" in de database:
- `folder_id = 78a28f80-...` (Retours folder) ✓
- `message_status = 'archived'` ✗ (zou 'active' moeten zijn)

---

## Oplossing

De `moveToFolder` functie moet niet alleen de `folder_id` updaten, maar ook:
1. `message_status` naar `'active'` zetten (zodat het zichtbaar is in custom folders)
2. `deleted_at` naar `null` zetten (voor het geval het uit de prullenbak komt)

### Code Wijziging

**Bestand:** `src/hooks/useInbox.ts`

```text
HUIDIGE CODE (regel 425-430):
const { error } = await supabase
  .from('customer_messages')
  .update({ folder_id: folderId })
  .in('id', messageIds);

NIEUWE CODE:
const { error } = await supabase
  .from('customer_messages')
  .update({ 
    folder_id: folderId,
    message_status: 'active',  // ← TOEVOEGEN
    deleted_at: null,          // ← TOEVOEGEN
  })
  .in('id', messageIds);
```

---

## Bestand te Wijzigen

| Bestand | Actie |
|---------|-------|
| `src/hooks/useInbox.ts` | Fix `moveToFolder` mutatie om ook `message_status` te updaten |

## Extra: Data Reparatie

Het bestaande bericht in de "Retours" map moet ook gerepareerd worden. Dit kan met een eenvoudige SQL update:

```sql
UPDATE customer_messages 
SET message_status = 'active', deleted_at = null 
WHERE folder_id IS NOT NULL 
  AND message_status != 'active';
```

---

## Verwacht Resultaat

| Actie | Resultaat |
|-------|-----------|
| Sleep van Inbox → Custom folder | Gesprek verplaatst correct |
| Sleep van Archief → Custom folder | Gesprek verplaatst correct (status wordt 'active') |
| Sleep van Prullenbak → Custom folder | Gesprek verplaatst correct (status wordt 'active') |
| Bestaande gesprekken in Retours | Nu zichtbaar na data reparatie |
