import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, User, CalendarDays, Save, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CustomerSelectDialog } from '@/components/admin/CustomerSelectDialog';
import { QuoteItemsEditor } from '@/components/admin/QuoteItemsEditor';
import { useQuotes, useQuote } from '@/hooks/useQuotes';
import { useTenant } from '@/hooks/useTenant';
import { format, addDays } from 'date-fns';
import { nl } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Customer } from '@/types/order';
import type { QuoteItemInput } from '@/types/quote';

export default function QuoteFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const { currentTenant } = useTenant();
  const { quote, isLoading: quoteLoading } = useQuote(id);
  const { createQuote, updateQuote, sendQuote } = useQuotes();

  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [items, setItems] = useState<QuoteItemInput[]>([]);
  const [validUntil, setValidUntil] = useState<Date | undefined>(addDays(new Date(), 14));
  const [notes, setNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Load quote data when editing
  useEffect(() => {
    if (quote && isEditing) {
      setSelectedCustomer(quote.customer || null);
      setItems(quote.quote_items?.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        product_sku: item.product_sku,
        description: item.description,
        quantity: item.quantity,
        unit_price: Number(item.unit_price),
        discount_percent: Number(item.discount_percent),
      })) || []);
      setValidUntil(quote.valid_until ? new Date(quote.valid_until) : undefined);
      setNotes(quote.notes || '');
      setInternalNotes(quote.internal_notes || '');
      setDiscountAmount(Number(quote.discount_amount) || 0);
    }
  }, [quote, isEditing]);

  const taxPercentage = currentTenant?.tax_percentage || 21;

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => {
      return sum + item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100);
    }, 0);
    const taxAmount = subtotal * (taxPercentage / 100);
    const total = subtotal + taxAmount - discountAmount;
    return { subtotal, taxAmount, total };
  };

  const { subtotal, taxAmount, total } = calculateTotals();

  const canSave = selectedCustomer && items.length > 0 && items.every(item => item.product_name);

  const handleSave = async (send = false) => {
    if (!selectedCustomer || items.length === 0) return;

    if (send) {
      setIsSending(true);
    } else {
      setIsSaving(true);
    }

    try {
      if (isEditing && id) {
        await updateQuote.mutateAsync({
          quoteId: id,
          data: {
            valid_until: validUntil?.toISOString(),
            notes,
            internal_notes: internalNotes,
            discount_amount: discountAmount,
            subtotal,
            tax_amount: taxAmount,
            total,
          },
          items,
        });

        if (send) {
          await sendQuote.mutateAsync(id);
        }
      } else {
        const result = await createQuote.mutateAsync({
          customerId: selectedCustomer.id,
          items,
          validUntil,
          notes,
          internalNotes,
          discountAmount,
        });

        if (send && result?.id) {
          await sendQuote.mutateAsync(result.id);
        }
      }

      navigate('/admin/orders/quotes');
    } finally {
      setIsSaving(false);
      setIsSending(false);
    }
  };

  if (isEditing && quoteLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/orders/quotes')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isEditing ? `Offerte ${quote?.quote_number}` : 'Nieuwe offerte'}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? 'Bewerk de offerte' : 'Maak een nieuwe offerte aan'}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Klant</CardTitle>
              <CardDescription>Selecteer de klant voor deze offerte</CardDescription>
            </CardHeader>
            <CardContent>
              {selectedCustomer ? (
                <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {selectedCustomer.first_name || selectedCustomer.last_name
                          ? `${selectedCustomer.first_name || ''} ${selectedCustomer.last_name || ''}`.trim()
                          : selectedCustomer.email}
                      </p>
                      <p className="text-sm text-muted-foreground">{selectedCustomer.email}</p>
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => setCustomerDialogOpen(true)}>
                    Wijzigen
                  </Button>
                </div>
              ) : (
                <Button 
                  variant="outline" 
                  className="w-full h-24 border-dashed"
                  onClick={() => setCustomerDialogOpen(true)}
                >
                  <div className="flex flex-col items-center gap-2">
                    <User className="h-6 w-6 text-muted-foreground" />
                    <span>Selecteer een klant</span>
                  </div>
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
              <CardDescription>Voeg producten of diensten toe aan de offerte</CardDescription>
            </CardHeader>
            <CardContent>
              <QuoteItemsEditor
                items={items}
                onChange={setItems}
                taxPercentage={taxPercentage}
              />
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Notities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notes">Notities voor klant</Label>
                <Textarea
                  id="notes"
                  placeholder="Voorwaarden, opmerkingen of aanvullende informatie..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="internal_notes">Interne notities</Label>
                <Textarea
                  id="internal_notes"
                  placeholder="Alleen zichtbaar voor jou en je team..."
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Validity */}
          <Card>
            <CardHeader>
              <CardTitle>Geldigheid</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>Geldig tot</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !validUntil && "text-muted-foreground"
                      )}
                    >
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {validUntil ? format(validUntil, 'PPP', { locale: nl }) : 'Selecteer datum'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={validUntil}
                      onSelect={setValidUntil}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Samenvatting</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotaal</span>
                  <span>€{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">BTW ({taxPercentage}%)</span>
                  <span>€{taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Korting</span>
                  <Input
                    type="number"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(Number(e.target.value))}
                    className="w-24 h-8 text-right"
                    min={0}
                    step={0.01}
                  />
                </div>
                <Separator />
                <div className="flex justify-between font-medium text-lg">
                  <span>Totaal</span>
                  <span>€{total.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-2 pt-4">
                <Button 
                  className="w-full" 
                  onClick={() => handleSave(false)}
                  disabled={!canSave || isSaving || isSending}
                >
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" />
                  Opslaan als concept
                </Button>
                <Button 
                  variant="secondary" 
                  className="w-full"
                  onClick={() => handleSave(true)}
                  disabled={!canSave || isSaving || isSending}
                >
                  {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Send className="mr-2 h-4 w-4" />
                  Opslaan & versturen
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Customer Select Dialog */}
      <CustomerSelectDialog
        open={customerDialogOpen}
        onOpenChange={setCustomerDialogOpen}
        onSelect={setSelectedCustomer}
        selectedCustomerId={selectedCustomer?.id}
      />
    </div>
  );
}
