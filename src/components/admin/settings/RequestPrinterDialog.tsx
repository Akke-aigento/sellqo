import { useState } from 'react';
import { Loader2, PrinterCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RequestPrinterDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [paperSize, setPaperSize] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setBrand('');
    setModel('');
    setPaperSize('');
    setNotes('');
  };

  const handleSubmit = async () => {
    if (!brand.trim() || !model.trim()) {
      toast.error('Vul minstens merk en model in');
      return;
    }
    setSubmitting(true);
    try {
      const subject = `Printer toevoegen: ${brand.trim()} ${model.trim()}`;
      const body = [
        `**Merk:** ${brand.trim()}`,
        `**Model:** ${model.trim()}`,
        paperSize.trim() && `**Labelformaat / paper-size:** ${paperSize.trim()}`,
        notes.trim() && `\n**Extra info:**\n${notes.trim()}`,
      ]
        .filter(Boolean)
        .join('\n');

      const { data: ticket, error } = await supabase
        .from('support_tickets')
        .insert({
          tenant_id: currentTenant?.id ?? null,
          requester_email: user?.email ?? '',
          requester_name: user?.user_metadata?.full_name ?? null,
          subject,
          category: 'feature',
          priority: 'low',
          status: 'open',
          tags: ['printer-request'],
          metadata: {
            type: 'printer_request',
            brand: brand.trim(),
            model: model.trim(),
            paper_size: paperSize.trim() || null,
          },
        } as any)
        .select()
        .single();
      if (error) throw error;

      // Initial message with full body
      if (ticket?.id) {
        await supabase.from('support_messages').insert({
          ticket_id: ticket.id,
          sender_type: 'merchant',
          sender_id: user?.id ?? null,
          sender_email: user?.email ?? null,
          message: body,
          is_internal_note: false,
          attachments: [],
        } as any);
      }

      toast.success('Bedankt! We bekijken je verzoek en voegen je printer toe waar mogelijk.');
      reset();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error('Verzoek versturen mislukt');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PrinterCheck className="h-5 w-5" />
            Vraag een printer / labelformaat aan
          </DialogTitle>
          <DialogDescription>
            Staat jouw printer of labelformaat er niet tussen? Laat het ons weten en we
            voegen het toe waar mogelijk.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="printer-brand">Merk *</Label>
              <Input
                id="printer-brand"
                placeholder="bv. Dymo, Zebra, Brother"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="printer-model">Model *</Label>
              <Input
                id="printer-model"
                placeholder="bv. LW650XL PRO"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="paper-size">Labelformaat / paper-size</Label>
            <Input
              id="paper-size"
              placeholder="bv. S0904980, 102 × 210 mm"
              value={paperSize}
              onChange={(e) => setPaperSize(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Naam van de papierrol of label, en bij voorkeur de afmetingen in mm.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="printer-notes">Extra info (optioneel)</Label>
            <Textarea
              id="printer-notes"
              placeholder="Link naar specs, bijzonderheden, etc."
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annuleren
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Verzoek versturen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}