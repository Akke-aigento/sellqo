import { useState } from 'react';
import { Check, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type PaymentMethodType = 'bank_transfer' | 'cash' | 'card_manual' | 'other';

interface MarkAsPaidButtonProps {
  orderId: string;
  orderNumber: string;
  isDisabled?: boolean;
  isPending?: boolean;
  onConfirm: (data: {
    paymentMethod: PaymentMethodType;
    reference?: string;
    notes?: string;
  }) => void;
}

const paymentMethodLabels: Record<PaymentMethodType, string> = {
  bank_transfer: 'Bankoverschrijving',
  cash: 'Contant',
  card_manual: 'Kaart (handmatig)',
  other: 'Anders',
};

export function MarkAsPaidButton({
  orderId,
  orderNumber,
  isDisabled,
  isPending,
  onConfirm,
}: MarkAsPaidButtonProps) {
  const [open, setOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('bank_transfer');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const handleConfirm = () => {
    onConfirm({
      paymentMethod,
      reference: reference.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    setOpen(false);
    // Reset form
    setPaymentMethod('bank_transfer');
    setReference('');
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="default" 
          className="w-full" 
          disabled={isDisabled || isPending}
        >
          <CreditCard className="h-4 w-4 mr-2" />
          Markeer als betaald
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Betaling bevestigen
          </DialogTitle>
          <DialogDescription>
            Bevestig de ontvangen betaling voor bestelling {orderNumber}.
            Dit markeert de order als betaald en wordt gelogd voor audit doeleinden.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="payment-method">Betaalmethode</Label>
            <Select
              value={paymentMethod}
              onValueChange={(value) => setPaymentMethod(value as PaymentMethodType)}
            >
              <SelectTrigger id="payment-method">
                <SelectValue placeholder="Selecteer betaalmethode" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(paymentMethodLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="reference">
              Referentie <span className="text-muted-foreground text-xs">(optioneel)</span>
            </Label>
            <Input
              id="reference"
              placeholder="Bijv. transactie-ID of OGM"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="notes">
              Notities <span className="text-muted-foreground text-xs">(optioneel)</span>
            </Label>
            <Textarea
              id="notes"
              placeholder="Extra informatie over de betaling..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuleren
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            <Check className="h-4 w-4 mr-2" />
            Bevestigen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
