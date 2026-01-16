import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useToast } from './use-toast';
import { CreditNote, CreditNoteLine, CreditNoteWithRelations, CreditNoteType, CreditNoteStatus } from '@/types/creditNote';
import { generateOGM } from '@/lib/ogm';

interface CreditNoteFilters {
  status?: CreditNoteStatus;
  search?: string;
}

interface CreateCreditNoteData {
  original_invoice_id: string;
  type: CreditNoteType;
  reason: string;
  lines: Omit<CreditNoteLine, 'id' | 'credit_note_id' | 'created_at'>[];
}

export function useCreditNotes(filters?: CreditNoteFilters) {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: creditNotes = [], isLoading, error, refetch } = useQuery({
    queryKey: ['credit-notes', currentTenant?.id, filters],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      let query = supabase
        .from('credit_notes')
        .select(`
          *,
          original_invoice:invoices!original_invoice_id(id, invoice_number, total, customer_id),
          customer:customers(id, first_name, last_name, email, company_name)
        `)
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.search) {
        query = query.or(`credit_note_number.ilike.%${filters.search}%,reason.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as CreditNoteWithRelations[];
    },
    enabled: !!currentTenant?.id,
  });

  const createCreditNote = useMutation({
    mutationFn: async (data: CreateCreditNoteData) => {
      if (!currentTenant?.id) throw new Error('No tenant selected');

      // Generate credit note number
      const { data: numberData, error: numberError } = await supabase
        .rpc('generate_credit_note_number', { _tenant_id: currentTenant.id });
      
      if (numberError) throw numberError;

      const creditNoteNumber = numberData as string;

      // Calculate totals
      const subtotal = data.lines.reduce((sum, line) => sum + line.line_total, 0);
      const taxAmount = data.lines.reduce((sum, line) => sum + (line.vat_amount || 0), 0);
      const total = subtotal + taxAmount;

      // Generate OGM
      const ogmReference = generateOGM(creditNoteNumber);

      // Get customer_id from original invoice
      const { data: invoice } = await supabase
        .from('invoices')
        .select('customer_id')
        .eq('id', data.original_invoice_id)
        .single();

      // Create credit note
      const { data: creditNote, error: creditNoteError } = await supabase
        .from('credit_notes')
        .insert({
          tenant_id: currentTenant.id,
          credit_note_number: creditNoteNumber,
          original_invoice_id: data.original_invoice_id,
          customer_id: invoice?.customer_id || null,
          type: data.type,
          reason: data.reason,
          subtotal,
          tax_amount: taxAmount,
          total,
          ogm_reference: ogmReference,
          status: 'draft',
        })
        .select()
        .single();

      if (creditNoteError) throw creditNoteError;

      // Create credit note lines
      const linesWithCreditNoteId = data.lines.map(line => ({
        ...line,
        credit_note_id: creditNote.id,
      }));

      const { error: linesError } = await supabase
        .from('credit_note_lines')
        .insert(linesWithCreditNoteId);

      if (linesError) throw linesError;

      return creditNote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-notes'] });
      toast({
        title: 'Creditnota aangemaakt',
        description: 'De creditnota is succesvol aangemaakt.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij aanmaken',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateCreditNoteStatus = useMutation({
    mutationFn: async ({ creditNoteId, status }: { creditNoteId: string; status: CreditNoteStatus }) => {
      const { data, error } = await supabase
        .from('credit_notes')
        .update({ status })
        .eq('id', creditNoteId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-notes'] });
    },
  });

  return {
    creditNotes,
    isLoading,
    error,
    refetch,
    createCreditNote,
    updateCreditNoteStatus,
  };
}

export function useCreditNote(creditNoteId: string | undefined) {
  const { data: creditNote, isLoading, error } = useQuery({
    queryKey: ['credit-note', creditNoteId],
    queryFn: async () => {
      if (!creditNoteId) return null;

      const { data, error } = await supabase
        .from('credit_notes')
        .select(`
          *,
          original_invoice:invoices!original_invoice_id(id, invoice_number, total, customer_id),
          customer:customers(id, first_name, last_name, email, company_name),
          lines:credit_note_lines(*)
        `)
        .eq('id', creditNoteId)
        .single();

      if (error) throw error;
      return data as unknown as CreditNoteWithRelations;
    },
    enabled: !!creditNoteId,
  });

  return { creditNote, isLoading, error };
}
