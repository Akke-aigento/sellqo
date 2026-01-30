

# Plan: Voeg Delete Functionaliteit toe aan Support Tickets

## Probleemanalyse

De RLS delete policy is aanwezig in de database, maar de applicatie mist:
1. Een `deleteTicket` mutatie in de `useSupportTickets` hook
2. Een delete knop in de ticket detail UI

## Oplossing

### Stap 1: Voeg deleteTicket toe aan useSupportTickets hook

Voeg een nieuwe mutatie toe aan `src/hooks/useSupportTickets.ts`:

```typescript
const deleteTicketMutation = useMutation({
  mutationFn: async (ticketId: string) => {
    const { error } = await supabase
      .from('support_tickets')
      .delete()
      .eq('id', ticketId);
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
    toast.success('Ticket verwijderd');
  },
  onError: (error: Error) => {
    toast.error(`Fout bij verwijderen: ${error.message}`);
  },
});

// Return ook:
return {
  // ... bestaande returns
  deleteTicket: deleteTicketMutation.mutateAsync,
  isDeleting: deleteTicketMutation.isPending,
};
```

### Stap 2: Voeg delete knop toe aan TicketDetail component

In `src/pages/platform/PlatformSupport.tsx`:

1. Voeg `Trash2` icon import toe
2. Voeg `AlertDialog` import toe voor bevestiging
3. Pas de `TicketDetail` component props aan om `onDelete` te accepteren
4. Voeg een rode delete knop toe naast de status dropdown met bevestigingsdialoog

```typescript
// In TicketDetail header, naast de status dropdown:
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive" size="icon">
      <Trash2 className="h-4 w-4" />
    </Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Ticket verwijderen?</AlertDialogTitle>
      <AlertDialogDescription>
        Dit verwijdert het ticket en alle bijbehorende berichten permanent.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Annuleren</AlertDialogCancel>
      <AlertDialogAction onClick={() => onDelete(ticket.id)}>
        Verwijderen
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Stap 3: Koppel delete in de parent component

Wijzig de `PlatformSupport` component om `deleteTicket` door te geven en na verwijdering de selectie te resetten:

```typescript
const handleDeleteTicket = async (ticketId: string) => {
  await deleteTicket(ticketId);
  setSelectedTicket(null);
};

// In de JSX:
<TicketDetail 
  ticket={selectedTicket} 
  onUpdate={updateTicket}
  onDelete={handleDeleteTicket}
/>
```

## Technische Details

| Bestand | Wijziging |
|---------|-----------|
| `src/hooks/useSupportTickets.ts` | Voeg `deleteTicketMutation` toe + export `deleteTicket` en `isDeleting` |
| `src/pages/platform/PlatformSupport.tsx` | Voeg delete knop met bevestigingsdialoog toe aan `TicketDetail` |

## Resultaat

- Platform eigenaren kunnen tickets verwijderen via een rode prullenbak-knop
- Er is een bevestigingsdialoog om per ongeluk verwijderen te voorkomen
- Na verwijderen wordt de ticket lijst automatisch bijgewerkt
- De geselecteerde ticket wordt gereset na verwijdering

