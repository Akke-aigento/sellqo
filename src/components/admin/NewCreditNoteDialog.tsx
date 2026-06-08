import { useMemo, useState } from 'react';
import { Plus, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useInvoices } from '@/hooks/useInvoices';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CreditNoteDialog } from './CreditNoteDialog';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

/**
 * Top-level "Nieuwe creditnota" entrypoint.
 * Step 1: select an invoice. Step 2: opens CreditNoteDialog pre-filled with its lines.
 */
export function NewCreditNoteDialog({ onSuccess }: { onSuccess?: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [picked, setPicked] = useState<{ id: string; number: string; lines: any[] } | null>(null);
  const [cnOpen, setCnOpen] = useState(false);

  const { invoices } = useInvoices({ search: search || undefined });

  const filtered = useMemo(() => invoices.slice(0, 30), [invoices]);

  const pickInvoice = async (id: string, number: string) => {
    setLoadingId(id);
    try {
      const { data, error } = await supabase
        .from('invoice_lines')
        .select('id, description, quantity, unit_price, vat_rate, vat_amount, line_total, line_type')
        .eq('invoice_id', id)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      const lines = (data || []).map((l: any) => ({
        id: l.id,
        description: l.description || '',
        quantity: Number(l.quantity || 1),
        unit_price: Number(l.unit_price || 0),
        vat_rate: Number(l.vat_rate || 0),
        vat_amount: Number(l.vat_amount || 0),
        line_total: Number(l.line_total || 0),
        line_type: l.line_type || 'product',
      }));
      setPicked({ id, number, lines });
      setOpen(false);
      setCnOpen(true);
    } catch (e: any) {
      toast({ title: 'Kon factuurregels niet laden', description: e?.message, variant: 'destructive' });
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nieuwe creditnota
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Kies factuur om te crediteren</DialogTitle>
            <DialogDescription>
              Selecteer de oorspronkelijke factuur. Daarna kun je een volledige of gedeeltelijke creditnota opmaken.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Zoek op factuurnummer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <ScrollArea className="h-[360px] rounded-md border">
            <div className="divide-y">
              {filtered.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground text-center">Geen facturen gevonden.</div>
              ) : filtered.map((inv) => (
                <button
                  key={inv.id}
                  className="w-full text-left p-3 hover:bg-muted/50 flex items-center justify-between gap-3"
                  onClick={() => pickInvoice(inv.id, inv.invoice_number)}
                  disabled={loadingId === inv.id}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-medium">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {inv.invoice_number}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {format(new Date(inv.created_at), 'd MMM yyyy', { locale: nl })}
                      {' · '}
                      {(inv as any).customers
                        ? `${(inv as any).customers.first_name || ''} ${(inv as any).customers.last_name || ''}`.trim() || (inv as any).customers.email
                        : (inv as any).orders?.customer_name || '—'}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">€ {Number(inv.total || 0).toFixed(2)}</span>
                    {loadingId === inv.id && <Loader2 className="h-4 w-4 animate-spin" />}
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuleren</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {picked && (
        <CreditNoteDialog
          invoiceId={picked.id}
          invoiceNumber={picked.number}
          invoiceLines={picked.lines}
          open={cnOpen}
          onOpenChange={(v) => { setCnOpen(v); if (!v) setPicked(null); }}
          hideTrigger
          onSuccess={onSuccess}
        />
      )}
    </>
  );
}