import { useState } from 'react';
import { Minus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CreditNoteDialog } from './CreditNoteDialog';
import { useCan } from '@/hooks/useCan';

interface Props {
  invoiceId: string;
  invoiceNumber: string;
  variant?: 'button' | 'menuItem';
  onSuccess?: () => void;
}

interface RawLine {
  id: string;
  description: string | null;
  quantity: number | null;
  unit_price: number | null;
  vat_rate: number | null;
  vat_amount: number | null;
  line_total: number | null;
  line_type: string | null;
}

/**
 * Loads invoice_lines on demand, then opens CreditNoteDialog pre-filled.
 * Used from the invoices list and order detail.
 */
export function CreateCreditNoteFromInvoiceButton({ invoiceId, invoiceNumber, onSuccess }: Props) {
  const { toast } = useToast();
  const canWrite = useCan('write', 'credit_notes');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<any[] | null>(null);

  if (!canWrite) return null;

  const handleClick = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('invoice_lines')
        .select('id, description, quantity, unit_price, vat_rate, vat_amount, line_total, line_type')
        .eq('invoice_id', invoiceId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      const mapped = (data as RawLine[]).map((l) => ({
        id: l.id,
        description: l.description || '',
        quantity: Number(l.quantity || 1),
        unit_price: Number(l.unit_price || 0),
        vat_rate: Number(l.vat_rate || 0),
        vat_amount: Number(l.vat_amount || 0),
        line_total: Number(l.line_total || 0),
        line_type: (l.line_type as any) || 'product',
      }));
      setLines(mapped);
      setOpen(true);
    } catch (e: any) {
      toast({ title: 'Kon factuurregels niet laden', description: e?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleClick} disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Minus className="h-4 w-4 mr-2" />}
        Creditnota
      </Button>
      {lines && (
        <CreditNoteDialog
          invoiceId={invoiceId}
          invoiceNumber={invoiceNumber}
          invoiceLines={lines}
          open={open}
          onOpenChange={(v) => { setOpen(v); if (!v) setLines(null); }}
          hideTrigger
          onSuccess={onSuccess}
        />
      )}
    </>
  );
}