import { useState } from 'react';
import { Plus, Trash2, FilePlus } from 'lucide-react';
import { useCustomers } from '@/hooks/useCustomers';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface ManualInvoiceDialogProps {
  onSuccess?: () => void;
}

export function ManualInvoiceDialog({ onSuccess }: ManualInvoiceDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { currentTenant } = useTenant();
  const { customers } = useCustomers();
  
  const [customerId, setCustomerId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [sendEmail, setSendEmail] = useState(false);
  const [items, setItems] = useState<InvoiceItem[]>([
    { description: '', quantity: 1, unit_price: 0, total_price: 0 }
  ]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: currentTenant?.currency || 'EUR',
    }).format(amount);
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const newItems = [...items];
    const item = { ...newItems[index] };
    
    if (field === 'quantity' || field === 'unit_price') {
      item[field] = Number(value) || 0;
      item.total_price = item.quantity * item.unit_price;
    } else {
      (item as any)[field] = value;
    }
    
    newItems[index] = item;
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, unit_price: 0, total_price: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + item.total_price, 0);
  };

  const calculateTax = () => {
    const taxPercent = currentTenant?.tax_percentage || 21;
    return calculateSubtotal() * (taxPercent / 100);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax();
  };

  const resetForm = () => {
    setCustomerId('');
    setNotes('');
    setSendEmail(false);
    setItems([{ description: '', quantity: 1, unit_price: 0, total_price: 0 }]);
  };

  const handleSubmit = async () => {
    if (!currentTenant?.id) {
      toast.error('Geen tenant geselecteerd');
      return;
    }

    const validItems = items.filter(item => item.description && item.total_price > 0);
    if (validItems.length === 0) {
      toast.error('Voeg minimaal één regelitem toe met een beschrijving en bedrag');
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-manual-invoice', {
        body: {
          tenant_id: currentTenant.id,
          customer_id: customerId || null,
          items: validItems,
          notes: notes || null,
          send_email: sendEmail,
        },
      });

      if (error) throw error;

      toast.success(`Factuur ${data.invoice_number} aangemaakt`);
      resetForm();
      setOpen(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error creating invoice:', error);
      toast.error('Fout bij aanmaken factuur', { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <FilePlus className="h-4 w-4 mr-2" />
          Nieuwe factuur
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Handmatige factuur aanmaken</DialogTitle>
          <DialogDescription>
            Maak een factuur aan zonder gekoppelde bestelling.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Customer Selection */}
          <div className="space-y-2">
            <Label>Klant (optioneel)</Label>
            <Select value={customerId || "none"} onValueChange={(val) => setCustomerId(val === "none" ? "" : val)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecteer een klant..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Geen klant geselecteerd</SelectItem>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {`${customer.first_name} ${customer.last_name}`.trim() || customer.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Invoice Items */}
          <div className="space-y-2">
            <Label>Factuurregels</Label>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Omschrijving</TableHead>
                  <TableHead className="w-[15%]">Aantal</TableHead>
                  <TableHead className="w-[20%]">Prijs</TableHead>
                  <TableHead className="w-[20%]">Totaal</TableHead>
                  <TableHead className="w-[5%]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Input
                        value={item.description}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                        placeholder="Beschrijving..."
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) => updateItem(index, 'unit_price', e.target.value)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(item.total_price)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeItem(index)}
                        disabled={items.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Button variant="outline" size="sm" onClick={addItem}>
              <Plus className="h-4 w-4 mr-2" />
              Regel toevoegen
            </Button>
          </div>

          {/* Totals */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotaal</span>
              <span>{formatCurrency(calculateSubtotal())}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>BTW ({currentTenant?.tax_percentage || 21}%)</span>
              <span>{formatCurrency(calculateTax())}</span>
            </div>
            <div className="flex justify-between font-semibold text-lg border-t pt-2">
              <span>Totaal</span>
              <span>{formatCurrency(calculateTotal())}</span>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Opmerkingen (optioneel)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Eventuele opmerkingen voor op de factuur..."
              rows={3}
            />
          </div>

          {/* Send Email Option */}
          {customerId && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="sendEmail"
                checked={sendEmail}
                onCheckedChange={(checked) => setSendEmail(!!checked)}
              />
              <Label htmlFor="sendEmail" className="font-normal cursor-pointer">
                Verstuur factuur direct per e-mail naar de klant
              </Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuleren
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Bezig...' : 'Factuur aanmaken'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
