import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import type { OrderStatus } from '@/types/order';

const ALL_STATUSES: { value: OrderStatus; label: string }[] = [
  { value: 'pending', label: 'In afwachting' },
  { value: 'processing', label: 'In behandeling' },
  { value: 'shipped', label: 'Verzonden' },
  { value: 'delivered', label: 'Afgeleverd' },
  { value: 'cancelled', label: 'Geannuleerd' },
  { value: 'returned', label: 'Geretourneerd' },
  { value: 'partially_returned', label: 'Deels geretourneerd' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  currentStatus: OrderStatus;
}

/**
 * Admin-only correctie-dialog. Bypasst de transition-matrix in
 * update-order-fulfillment-status via `is_correction: true`. Vereist een
 * reden voor de audit-log (action_type = 'order_status_correction').
 */
export function OrderStatusCorrectionDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  currentStatus,
}: Props) {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newStatus, setNewStatus] = useState<OrderStatus>(currentStatus);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!currentTenant?.id) return;
    if (reason.trim().length < 3) {
      toast({
        title: 'Reden verplicht',
        description: 'Geef een korte reden voor deze correctie.',
        variant: 'destructive',
      });
      return;
    }
    if (newStatus === currentStatus) {
      toast({ title: 'Geen wijziging', description: 'Nieuwe status is gelijk aan huidige.' });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        'update-order-fulfillment-status',
        {
          body: {
            tenant_id: currentTenant.id,
            order_id: orderId,
            new_status: newStatus,
            is_correction: true,
            reason: reason.trim(),
          },
        },
      );
      if (error) throw error;
      if (data && (data as { success?: boolean }).success === false) {
        throw new Error((data as { error?: string }).error || 'Correctie mislukt');
      }
      toast({ title: 'Status gecorrigeerd', description: `Order ${orderNumber} → ${newStatus}` });
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['fulfillment-orders'] });
      setReason('');
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Fout bij correctie',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Status corrigeren
          </DialogTitle>
          <DialogDescription>
            Forceert een status-wijziging buiten de normale flow. Wordt vastgelegd
            in de audit-log met je reden.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Huidige status</Label>
            <Input value={currentStatus} readOnly disabled />
          </div>
          <div className="space-y-2">
            <Label>Nieuwe status</Label>
            <Select value={newStatus} onValueChange={(v) => setNewStatus(v as OrderStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label} ({s.value})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>
              Reden <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Bijv. Per ongeluk geannuleerd door klant, terug naar in behandeling"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annuleren
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Correctie bevestigen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}