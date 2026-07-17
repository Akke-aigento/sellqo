import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useState } from 'react';
import { Download, FileMinus, Loader2, Mail } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { invokeWithErrorBody } from '@/lib/invokeWithErrorBody';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import { PermissionGate } from '@/components/PermissionGate';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditNoteDialog } from '@/components/admin/CreditNoteDialog';
import { invokeWithErrorBody as _dummy } from '@/lib/invokeWithErrorBody'; // keep import path parity

interface Props {
  invoiceId: string;
  invoiceNumber: string;
}

export function OrderCreditNotesSection({ invoiceId, invoiceNumber }: Props) {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const { data: creditNotes = [], isLoading } = useQuery({
    queryKey: ['order-credit-notes', invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_notes')
        .select('*')
        .eq('original_invoice_id', invoiceId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!invoiceId,
  });

  const { data: invoiceLines = [] } = useQuery({
    queryKey: ['invoice-lines', invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_lines')
        .select('id, description, quantity, unit_price, vat_rate, vat_amount, line_total, line_type')
        .eq('invoice_id', invoiceId);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!invoiceId,
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat('nl-NL', { style: 'currency', currency: currentTenant?.currency || 'EUR' }).format(n);

  // Popup-safe download that regenerates a fresh 10-min signed URL every time.
  // Fixes the 24u-bug where `credit_notes.pdf_url` was a stale signed URL.
  const handleDownload = async (cnId: string, existingPath: string | null) => {
    const win = window.open('', '_blank');
    try {
      setBusy(cnId);
      if (!existingPath) {
        await invokeWithErrorBody('generate-credit-note', {
          body: { credit_note_id: cnId },
        });
        await qc.invalidateQueries({ queryKey: ['order-credit-notes', invoiceId] });
      }
      const res = await invokeWithErrorBody<{ url: string }>('get-document-url', {
        body: { doc_type: 'credit_note', doc_id: cnId, kind: 'pdf' },
      });
      if (!res?.url) throw new Error('Geen download-URL ontvangen');
      if (win && !win.closed) win.location.href = res.url;
      else window.location.href = res.url;
    } catch (e: any) {
      try { win?.close(); } catch { /* noop */ }
      toast({ title: 'Downloaden mislukt', description: e?.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const handleResend = async (cnId: string) => {
    try {
      setBusy(cnId);
      await invokeWithErrorBody('send-credit-note-email', { body: { credit_note_id: cnId } });
      qc.invalidateQueries({ queryKey: ['order-credit-notes', invoiceId] });
      toast({ title: 'E-mail verzonden' });
    } catch (e: any) {
      toast({ title: 'E-mail mislukt', description: e?.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <FileMinus className="h-4 w-4" />
          Creditnota's
        </CardTitle>
        <PermissionGate action="write" resource="credit_notes">
          {invoiceLines.length > 0 && (
            <CreditNoteDialog
              invoiceId={invoiceId}
              invoiceNumber={invoiceNumber}
              invoiceLines={invoiceLines}
              onSuccess={() => qc.invalidateQueries({ queryKey: ['order-credit-notes', invoiceId] })}
            />
          )}
        </PermissionGate>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Laden...</p>
        ) : creditNotes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Geen creditnota's voor deze bestelling</p>
        ) : (
          creditNotes.map((cn: any) => (
            <div key={cn.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{cn.credit_note_number}</span>
                  <Badge variant={cn.sent_at ? 'default' : 'secondary'}>
                    {cn.sent_at ? 'Verzonden' : 'Concept'}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {format(new Date(cn.issue_date), 'd MMM yyyy', { locale: nl })} · <span className="text-destructive font-medium">-{fmt(Number(cn.total))}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={busy === cn.id} onClick={() => handleDownload(cn.id, cn.pdf_path ?? null)}>
                  {busy === cn.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                </Button>
                <PermissionGate action="write" resource="credit_notes">
                  <Button size="sm" variant="outline" disabled={busy === cn.id} onClick={() => handleResend(cn.id)}>
                    <Mail className="h-4 w-4" />
                  </Button>
                </PermissionGate>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}