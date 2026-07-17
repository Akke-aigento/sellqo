import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type LedgerEntry = {
  id: string;
  customer_id: string;
  amount: number;
  note: string | null;
  entry_date: string;
  created_at: string;
  updated_at: string;
};

export type LedgerRecurring = {
  id: string;
  customer_id: string;
  amount: number;
  note: string | null;
  interval_months: number;
  next_date: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

function addMonthsISO(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCMonth(dt.getUTCMonth() + months);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function useCustomerLedger(customerId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const entriesKey = ['admin_customer_ledger', customerId];
  const recurringKey = ['admin_customer_ledger_recurring', customerId];

  const { data: entries, isLoading: entriesLoading } = useQuery({
    queryKey: entriesKey,
    queryFn: async () => {
      if (!customerId) return [] as LedgerEntry[];
      const { data, error } = await supabase
        .from('admin_customer_ledger')
        .select('*')
        .eq('customer_id', customerId)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as LedgerEntry[];
    },
    enabled: !!customerId,
  });

  const { data: recurring, isLoading: recurringLoading } = useQuery({
    queryKey: recurringKey,
    queryFn: async () => {
      if (!customerId) return [] as LedgerRecurring[];
      const { data, error } = await supabase
        .from('admin_customer_ledger_recurring')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as LedgerRecurring[];
    },
    enabled: !!customerId,
  });

  const balance = (entries ?? []).reduce((sum, e) => sum + Number(e.amount), 0);

  const invalidateEntries = () => queryClient.invalidateQueries({ queryKey: entriesKey });
  const invalidateRecurring = () => queryClient.invalidateQueries({ queryKey: recurringKey });

  const createEntry = useMutation({
    mutationFn: async (input: { amount: number; note?: string | null; entry_date: string }) => {
      if (!customerId) throw new Error('Geen klant geselecteerd');
      const { data, error } = await supabase
        .from('admin_customer_ledger')
        .insert({
          customer_id: customerId,
          amount: input.amount,
          note: input.note ?? null,
          entry_date: input.entry_date,
        })
        .select()
        .single();
      if (error) throw error;
      return data as LedgerEntry;
    },
    onSuccess: () => {
      invalidateEntries();
      toast({ title: 'Mutatie toegevoegd' });
    },
    onError: (err: any) => {
      toast({ title: 'Toevoegen mislukt', description: err.message, variant: 'destructive' });
    },
  });

  const updateEntry = useMutation({
    mutationFn: async (input: { id: string; data: Partial<Pick<LedgerEntry, 'amount' | 'note' | 'entry_date'>> }) => {
      const { data, error } = await supabase
        .from('admin_customer_ledger')
        .update(input.data)
        .eq('id', input.id)
        .select()
        .single();
      if (error) throw error;
      return data as LedgerEntry;
    },
    onSuccess: () => {
      invalidateEntries();
      toast({ title: 'Mutatie bijgewerkt' });
    },
    onError: (err: any) => {
      toast({ title: 'Bijwerken mislukt', description: err.message, variant: 'destructive' });
    },
  });

  const deleteEntry = useMutation({
    mutationFn: async (input: { id: string }) => {
      const { error } = await supabase
        .from('admin_customer_ledger')
        .delete()
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateEntries();
      toast({ title: 'Mutatie verwijderd' });
    },
    onError: (err: any) => {
      toast({ title: 'Verwijderen mislukt', description: err.message, variant: 'destructive' });
    },
  });

  const createRecurring = useMutation({
    mutationFn: async (input: {
      amount: number;
      note?: string | null;
      interval_months: number;
      next_date: string;
      active?: boolean;
    }) => {
      if (!customerId) throw new Error('Geen klant geselecteerd');
      const { data, error } = await supabase
        .from('admin_customer_ledger_recurring')
        .insert({
          customer_id: customerId,
          amount: input.amount,
          note: input.note ?? null,
          interval_months: input.interval_months,
          next_date: input.next_date,
          active: input.active ?? true,
        })
        .select()
        .single();
      if (error) throw error;
      return data as LedgerRecurring;
    },
    onSuccess: () => {
      invalidateRecurring();
      toast({ title: 'Vaste kost ingesteld' });
    },
    onError: (err: any) => {
      toast({ title: 'Instellen mislukt', description: err.message, variant: 'destructive' });
    },
  });

  const updateRecurring = useMutation({
    mutationFn: async (input: { id: string; data: Partial<Omit<LedgerRecurring, 'id' | 'customer_id' | 'created_at' | 'updated_at'>> }) => {
      const { data, error } = await supabase
        .from('admin_customer_ledger_recurring')
        .update(input.data)
        .eq('id', input.id)
        .select()
        .single();
      if (error) throw error;
      return data as LedgerRecurring;
    },
    onSuccess: () => {
      invalidateRecurring();
      toast({ title: 'Vaste kost bijgewerkt' });
    },
    onError: (err: any) => {
      toast({ title: 'Bijwerken mislukt', description: err.message, variant: 'destructive' });
    },
  });

  const deleteRecurring = useMutation({
    mutationFn: async (input: { id: string }) => {
      const { error } = await supabase
        .from('admin_customer_ledger_recurring')
        .delete()
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateRecurring();
      toast({ title: 'Vaste kost verwijderd' });
    },
    onError: (err: any) => {
      toast({ title: 'Verwijderen mislukt', description: err.message, variant: 'destructive' });
    },
  });

  const applyRecurring = useMutation({
    mutationFn: async (row: LedgerRecurring) => {
      if (!customerId) throw new Error('Geen klant geselecteerd');

      // Idempotency: check for an identical entry (same customer, date, amount, note).
      const noteVal = row.note ?? null;
      let dupQuery = supabase
        .from('admin_customer_ledger')
        .select('id')
        .eq('customer_id', customerId)
        .eq('entry_date', row.next_date)
        .eq('amount', row.amount);
      dupQuery = noteVal === null ? dupQuery.is('note', null) : dupQuery.eq('note', noteVal);

      const { data: dup, error: dupErr } = await dupQuery.maybeSingle();
      if (dupErr) throw dupErr;
      if (dup) {
        return { skipped: true as const };
      }

      const { error: insErr } = await supabase
        .from('admin_customer_ledger')
        .insert({
          customer_id: customerId,
          amount: row.amount,
          note: row.note,
          entry_date: row.next_date,
        });
      if (insErr) throw insErr;

      const newNext = addMonthsISO(row.next_date, row.interval_months);
      const { error: updErr } = await supabase
        .from('admin_customer_ledger_recurring')
        .update({ next_date: newNext })
        .eq('id', row.id);
      if (updErr) throw updErr;

      return { skipped: false as const };
    },
    onSuccess: (result) => {
      invalidateEntries();
      invalidateRecurring();
      if (result?.skipped) {
        toast({ title: 'Deze maand is al toegevoegd' });
      } else {
        toast({ title: 'Maandbedrag toegevoegd' });
      }
    },
    onError: (err: any) => {
      toast({ title: 'Toevoegen mislukt', description: err.message, variant: 'destructive' });
    },
  });

  return {
    entries: entries ?? [],
    balance,
    isLoading: entriesLoading || recurringLoading,
    recurring: recurring ?? [],
    createEntry,
    updateEntry,
    deleteEntry,
    createRecurring,
    updateRecurring,
    deleteRecurring,
    applyRecurring,
  };
}