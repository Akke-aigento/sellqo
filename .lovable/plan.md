

# Plan: Order Verwijderen en Koppeling Verbreekbaar Maken

## Probleem Geïdentificeerd

De console toont een **foreign key constraint error**:
```
"Key is still referenced from table 'orders'"
"violates foreign key constraint 'orders_marketplace_connection_id_fkey'"
```

**Situatie:**
- Er is 1 order geïmporteerd: `#0001` (Pieter Kooistra, €31.95)
- Deze order verwijst naar marketplace_connection `f43bccde-0235-4bc2-b11e-eb9e3806296b`
- Postgres blokkeert het verwijderen van de connection zolang er orders naar verwijzen

## Oplossing in 2 Delen

### Deel 1: Directe Database Opruiming (Nu)

Ik verwijder de geïmporteerde order direct uit de database:

```sql
-- Eerst order_items verwijderen (heeft FK naar orders)
DELETE FROM order_items WHERE order_id = 'd82b657d-ca54-4186-98d2-f84754765901';

-- Dan de order zelf
DELETE FROM orders WHERE id = 'd82b657d-ca54-4186-98d2-f84754765901';
```

### Deel 2: Code Aanpassing (Toekomst-proof)

De `handleDisconnect` functie moet eerst gerelateerde orders opschonen voordat de connection wordt verwijderd:

**Bestand:** `src/hooks/useMarketplaceConnections.ts`

Huidige code:
```typescript
const deleteConnection = useMutation({
  mutationFn: async (id: string) => {
    const { error } = await supabase
      .from('marketplace_connections')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
  ...
});
```

Nieuwe code - 2 opties:

**Optie A: Nullify (behoud orders, verwijder link)**
```typescript
mutationFn: async (id: string) => {
  // Eerst marketplace_connection_id op NULL zetten bij orders
  await supabase
    .from('orders')
    .update({ marketplace_connection_id: null })
    .eq('marketplace_connection_id', id);
  
  // Dan connection verwijderen
  const { error } = await supabase
    .from('marketplace_connections')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
```

**Optie B: Cascade Delete (verwijder alles)** - Via database migratie:
```sql
ALTER TABLE orders 
DROP CONSTRAINT orders_marketplace_connection_id_fkey;

ALTER TABLE orders 
ADD CONSTRAINT orders_marketplace_connection_id_fkey 
FOREIGN KEY (marketplace_connection_id) 
REFERENCES marketplace_connections(id) 
ON DELETE SET NULL;
```

## Aanbevolen Aanpak

| Stap | Actie |
|------|-------|
| 1 | **Nu:** Database migratie om order te verwijderen |
| 2 | **Code:** Update `deleteConnection` om eerst orders te nullifyen |
| 3 | **Database:** FK constraint aanpassen naar `ON DELETE SET NULL` |

Dit zorgt ervoor dat:
- De huidige order wordt verwijderd
- De koppeling verbroken kan worden
- In de toekomst automatisch orders hun link verliezen (maar bewaard blijven) bij disconnect

## Bestanden te Wijzigen

| Bestand | Wijziging |
|---------|-----------|
| Database | DELETE order + order_items |
| `src/hooks/useMarketplaceConnections.ts` | Nullify orders vóór delete connection |
| Database migratie | FK constraint → ON DELETE SET NULL |

