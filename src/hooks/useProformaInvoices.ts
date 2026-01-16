import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';

export interface ProformaInvoice {
  id: string;
  tenant_id: string;
  proforma_number: string;
  customer_id: string | null;
  shipping_method_id: string | null;
  subtotal: number;
  discount_total: number;
  tax_amount: number;
  total: number;
  valid_until: string | null;
  notes: string | null;
  status: 'draft' | 'sent' | 'converted' | 'expired';
  converted_to_invoice_id: string | null;
  created_at: string;
  updated_at: string;
  customer?: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
  };
}

export interface ProformaInvoiceLine {
  id: string;
  proforma_id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  vat_amount: number;
  line_total: number;
  line_type: string;
  discount_percentage: number | null;
  discount_amount: number | null;
  sort_order: number;
}

export function useProformaInvoices() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();

  const { data: proformaInvoices = [], isLoading } = useQuery({
    queryKey: ['proforma-invoices', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      
      const { data, error } = await supabase
        .from('proforma_invoices')
        .select(`
          *,
          customer:customers(id, email, first_name, last_name, company_name)
        `)
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ProformaInvoice[];
    },
    enabled: !!currentTenant?.id,
  });

  const createProforma = useMutation({
    mutationFn: async (data: {
      customer_id: string;
      lines: Omit<ProformaInvoiceLine, 'id' | 'proforma_id'>[];
      notes?: string;
      valid_until?: string;
    }) => {
      if (!currentTenant?.id) throw new Error('No tenant');

      // Generate proforma number
      const { data: proformaNumber } = await supabase
        .rpc('generate_proforma_number', { _tenant_id: currentTenant.id });

      // Calculate totals
      const subtotal = data.lines.reduce((sum, line) => sum + line.line_total, 0);
      const taxAmount = data.lines.reduce((sum, line) => sum + line.vat_amount, 0);
      const total = subtotal + taxAmount;

      // Default validity: 30 days from now
      const validUntil = data.valid_until || new Date(
        Date.now() + (currentTenant.proforma_validity_days || 30) * 24 * 60 * 60 * 1000
      ).toISOString().split('T')[0];

      // Create proforma invoice
      const { data: proforma, error } = await supabase
        .from('proforma_invoices')
        .insert({
          tenant_id: currentTenant.id,
          proforma_number: proformaNumber,
          customer_id: data.customer_id,
          subtotal,
          tax_amount: taxAmount,
          total,
          valid_until: validUntil,
          notes: data.notes,
          status: 'draft',
        })
        .select()
        .single();

      if (error) throw error;

      // Create lines
      const lines = data.lines.map((line, index) => ({
        ...line,
        proforma_id: proforma.id,
        sort_order: index,
      }));

      await supabase
        .from('proforma_invoice_lines')
        .insert(lines);

      return proforma;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proforma-invoices'] });
      toast.success('Pro-forma factuur aangemaakt');
    },
    onError: (error: Error) => {
      toast.error('Fout bij aanmaken pro-forma', { description: error.message });
    },
  });

  const convertToInvoice = useMutation({
    mutationFn: async (proformaId: string) => {
      if (!currentTenant?.id) throw new Error('No tenant');

      // Get proforma with lines
      const { data: proforma, error: proformaError } = await supabase
        .from('proforma_invoices')
        .select('*')
        .eq('id', proformaId)
        .single();

      if (proformaError) throw proformaError;
      if (proforma.status === 'converted') {
        throw new Error('Pro-forma is al omgezet naar factuur');
      }

      const { data: lines } = await supabase
        .from('proforma_invoice_lines')
        .select('*')
        .eq('proforma_id', proformaId);

      // Generate invoice number
      const { data: invoiceNumber } = await supabase
        .rpc('generate_invoice_number', { _tenant_id: currentTenant.id });

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          tenant_id: currentTenant.id,
          customer_id: proforma.customer_id,
          invoice_number: invoiceNumber,
          status: 'draft',
          subtotal: proforma.subtotal,
          tax_amount: proforma.tax_amount,
          total: proforma.total,
          proforma_reference: proforma.proforma_number,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create invoice lines
      if (lines?.length) {
        const invoiceLines = lines.map((line: ProformaInvoiceLine) => ({
          invoice_id: invoice.id,
          product_id: line.product_id,
          description: line.description,
          quantity: line.quantity,
          unit_price: line.unit_price,
          vat_rate: line.vat_rate,
          vat_amount: line.vat_amount,
          line_total: line.line_total,
          line_type: line.line_type,
          sort_order: line.sort_order,
        }));

        await supabase
          .from('invoice_lines')
          .insert(invoiceLines);
      }

      // Update proforma status
      await supabase
        .from('proforma_invoices')
        .update({
          status: 'converted',
          converted_to_invoice_id: invoice.id,
        })
        .eq('id', proformaId);

      return invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proforma-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Pro-forma omgezet naar factuur');
    },
    onError: (error: Error) => {
      toast.error('Fout bij omzetten', { description: error.message });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'draft' | 'sent' | 'expired' }) => {
      const { error } = await supabase
        .from('proforma_invoices')
        .update({ status })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proforma-invoices'] });
    },
  });

  return {
    proformaInvoices,
    isLoading,
    createProforma,
    convertToInvoice,
    updateStatus,
  };
}
