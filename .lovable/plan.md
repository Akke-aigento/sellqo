

# Fix: Bol VVB Settings Worden Niet Opgeslagen

## Probleem Geïdentificeerd

De VVB instellingen (`vvbEnabled`, `vvbMaxAmount`, etc.) die je aanpast worden **niet opgeslagen** in de database.

### Oorzaak

De `updateConnection` mutatie in `useMarketplaceConnections.ts` stuurt **altijd alle velden mee**, ook als ze `undefined` zijn:

```typescript
.update({
  marketplace_name: params.updates.marketplace_name,  // undefined → overschrijft!
  credentials: params.updates.credentials,            // undefined → overschrijft!
  settings: params.updates.settings,                  // wordt wel gestuurd
  is_active: params.updates.is_active,                // undefined → overschrijft!
})
```

Wanneer je alleen `settings` update, worden `marketplace_name`, `credentials` en `is_active` als `undefined` meegestuurd, wat de bestaande waarden kan overschrijven of tot onverwacht gedrag leidt.

### Database Bewijs

De huidige settings in de database:
```json
{
  "autoImport": true,
  "syncInterval": 15,
  // GEEN vvbEnabled, vvbMaxAmount, etc.!
}
```

---

## Oplossing

### Stap 1: Alleen gedefinieerde velden updaten

Wijzig `updateConnection` om alleen velden mee te sturen die daadwerkelijk zijn opgegeven:

**Bestand:** `src/hooks/useMarketplaceConnections.ts`

```typescript
const updateConnection = useMutation({
  mutationFn: async (params: {
    id: string;
    updates: Partial<Pick<MarketplaceConnection, 'marketplace_name' | 'credentials' | 'settings' | 'is_active'>>;
  }) => {
    // Build update object with only defined fields
    const updateData: Record<string, unknown> = {};
    
    if (params.updates.marketplace_name !== undefined) {
      updateData.marketplace_name = params.updates.marketplace_name;
    }
    if (params.updates.credentials !== undefined) {
      updateData.credentials = params.updates.credentials;
    }
    if (params.updates.settings !== undefined) {
      updateData.settings = params.updates.settings;
    }
    if (params.updates.is_active !== undefined) {
      updateData.is_active = params.updates.is_active;
    }

    const { data, error } = await supabase
      .from('marketplace_connections')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as MarketplaceConnection;
  },
  // ... rest blijft hetzelfde
});
```

### Stap 2: Query cache correct invalideren

Voeg ook invalidatie toe voor de specifieke connection query:

```typescript
onSuccess: (data) => {
  queryClient.invalidateQueries({ queryKey: ['marketplace-connections'] });
  queryClient.invalidateQueries({ queryKey: ['marketplace-connection', data.id] });
  toast.success('Instellingen opgeslagen!');
},
```

---

## Verwacht Resultaat

| Vóór Fix | Na Fix |
|----------|--------|
| VVB settings verdwijnen na opslaan | VVB settings blijven behouden |
| `undefined` velden overschrijven data | Alleen gewijzigde velden worden geüpdatet |
| Cache niet correct geïnvalideerd | Beide queries worden geïnvalideerd |

---

## Bestanden te Wijzigen

| Bestand | Wijziging |
|---------|-----------|
| `src/hooks/useMarketplaceConnections.ts` | Filter `undefined` velden uit update, verbeter cache invalidatie |

