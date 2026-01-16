import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { format, addDays, addMonths } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCustomers } from '@/hooks/useCustomers';
import { useVatRates } from '@/hooks/useVatRates';
import { useSubscription, useCreateSubscription, SubscriptionInterval } from '@/hooks/useSubscriptions';

interface SubscriptionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscriptionId?: string | null;
}

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate_id: string | null;
  vat_rate: number | null;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

export function SubscriptionFormDialog({ open, onOpenChange, subscriptionId }: SubscriptionFormDialogProps) {
  const { t } = useTranslation();
  const { customers = [] } = useCustomers();
  const { vatRates = [] } = useVatRates();
  const { data: existingSubscription } = useSubscription(subscriptionId || undefined);
  const createSubscription = useCreateSubscription();

  const [customerId, setCustomerId] = useState('');
  const [name, setName] = useState('');
  const [interval, setInterval] = useState<SubscriptionInterval>('monthly');
  const [intervalCount, setIntervalCount] = useState(1);
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState('');
  const [autoSend, setAutoSend] = useState(true);
  const [paymentTermDays, setPaymentTermDays] = useState(30);
  const [generateDaysBefore, setGenerateDaysBefore] = useState(5);
  const [notifyBeforeRenewal, setNotifyBeforeRenewal] = useState(false);
  const [notifyDaysBefore, setNotifyDaysBefore] = useState(7);
  const [lines, setLines] = useState<LineItem[]>([
    { id: crypto.randomUUID(), description: '', quantity: 1, unit_price: 0, vat_rate_id: null, vat_rate: null }
  ]);

  useEffect(() => {
    if (existingSubscription) {
      setCustomerId(existingSubscription.customer_id);
      setName(existingSubscription.name);
      setInterval(existingSubscription.interval);
      setIntervalCount(existingSubscription.interval_count);
      setStartDate(existingSubscription.start_date);
      setEndDate(existingSubscription.end_date || '');
      setAutoSend(existingSubscription.auto_send);
      setPaymentTermDays(existingSubscription.payment_term_days);
      setGenerateDaysBefore(existingSubscription.generate_days_before);
      setNotifyBeforeRenewal(existingSubscription.notify_before_renewal);
      setNotifyDaysBefore(existingSubscription.notify_days_before);
      if (existingSubscription.lines && existingSubscription.lines.length > 0) {
        setLines(existingSubscription.lines.map(l => ({
          id: l.id,
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unit_price,
          vat_rate_id: l.vat_rate_id,
          vat_rate: l.vat_rate,
        })));
      }
    }
  }, [existingSubscription]);

  const defaultVatRate = vatRates.find(r => r.is_default);

  const addLine = () => {
    setLines([
      ...lines,
      { 
        id: crypto.randomUUID(), 
        description: '', 
        quantity: 1, 
        unit_price: 0, 
        vat_rate_id: defaultVatRate?.id || null,
        vat_rate: defaultVatRate?.rate || null
      }
    ]);
  };

  const removeLine = (id: string) => {
    if (lines.length > 1) {
      setLines(lines.filter(l => l.id !== id));
    }
  };

  const updateLine = (id: string, field: keyof LineItem, value: any) => {
    setLines(lines.map(l => {
      if (l.id === id) {
        if (field === 'vat_rate_id') {
          const rate = vatRates.find(r => r.id === value);
          return { ...l, vat_rate_id: value, vat_rate: rate?.rate || 0 };
        }
        return { ...l, [field]: value };
      }
      return l;
    }));
  };

  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0);
  const vatTotal = lines.reduce((sum, l) => {
    const lineTotal = l.quantity * l.unit_price;
    return sum + (lineTotal * (l.vat_rate || 0) / 100);
  }, 0);
  const total = subtotal + vatTotal;

  const handleSubmit = async () => {
    if (!customerId || !name || lines.some(l => !l.description)) return;

    await createSubscription.mutateAsync({
      customer_id: customerId,
      name,
      interval,
      interval_count: intervalCount,
      start_date: startDate,
      end_date: endDate || null,
      auto_send: autoSend,
      payment_term_days: paymentTermDays,
      generate_days_before: generateDaysBefore,
      notify_before_renewal: notifyBeforeRenewal,
      notify_days_before: notifyDaysBefore,
      lines: lines.map(l => ({
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        vat_rate_id: l.vat_rate_id,
        vat_rate: l.vat_rate,
      })),
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {subscriptionId ? t('subscriptions.edit') : t('subscriptions.create')}
          </DialogTitle>
          <DialogDescription>
            {t('subscriptions.form_description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Customer & Name */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('subscriptions.customer')}</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('subscriptions.select_customer')} />
                </SelectTrigger>
                <SelectContent>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('subscriptions.name')}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('subscriptions.name_placeholder')}
              />
            </div>
          </div>

          {/* Billing Cycle */}
          <div className="space-y-2">
            <Label>{t('subscriptions.billing_cycle')}</Label>
            <div className="flex items-center gap-2">
              <span>{t('subscriptions.every')}</span>
              <Input
                type="number"
                min={1}
                value={intervalCount}
                onChange={(e) => setIntervalCount(parseInt(e.target.value) || 1)}
                className="w-20"
              />
              <Select value={interval} onValueChange={(v) => setInterval(v as SubscriptionInterval)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">{t('subscriptions.interval.weekly')}</SelectItem>
                  <SelectItem value="monthly">{t('subscriptions.interval.monthly')}</SelectItem>
                  <SelectItem value="quarterly">{t('subscriptions.interval.quarterly')}</SelectItem>
                  <SelectItem value="yearly">{t('subscriptions.interval.yearly')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Lines */}
          <div className="space-y-3">
            <Label>{t('subscriptions.lines')}</Label>
            {lines.map((line, index) => (
              <div key={line.id} className="grid gap-2 md:grid-cols-[1fr_80px_100px_120px_40px] items-end">
                <Input
                  value={line.description}
                  onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                  placeholder={t('packing_slip.description')}
                />
                <Input
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(e) => updateLine(line.id, 'quantity', parseFloat(e.target.value) || 1)}
                  placeholder={t('packing_slip.quantity')}
                />
                <Input
                  type="number"
                  step="0.01"
                  value={line.unit_price}
                  onChange={(e) => updateLine(line.id, 'unit_price', parseFloat(e.target.value) || 0)}
                  placeholder={t('common.price')}
                />
                <Select
                  value={line.vat_rate_id || ''}
                  onValueChange={(v) => updateLine(line.id, 'vat_rate_id', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="BTW" />
                  </SelectTrigger>
                  <SelectContent>
                    {vatRates.map(rate => (
                      <SelectItem key={rate.id} value={rate.id}>
                        {rate.rate}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeLine(line.id)}
                  disabled={lines.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="h-4 w-4 mr-2" />
              {t('subscriptions.add_line')}
            </Button>
          </div>

          {/* Totals */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-1">
            <div className="flex justify-between text-sm">
              <span>{t('invoice.total_excl_vat')}</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>{t('invoice.vat_amount')}</span>
              <span>{formatCurrency(vatTotal)}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between font-semibold">
              <span>{t('common.total')}</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>

          <Separator />

          {/* Dates */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('subscriptions.start_date')}</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('subscriptions.end_date')}</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder={t('subscriptions.no_end_date')}
              />
            </div>
          </div>

          <Separator />

          {/* Settings */}
          <div className="space-y-4">
            <Label>{t('subscriptions.settings')}</Label>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{t('subscriptions.auto_send')}</p>
              </div>
              <Switch checked={autoSend} onCheckedChange={setAutoSend} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('subscriptions.payment_term')}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    value={paymentTermDays}
                    onChange={(e) => setPaymentTermDays(parseInt(e.target.value) || 0)}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">{t('subscriptions.days')}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('subscriptions.generate_days_before')}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    value={generateDaysBefore}
                    onChange={(e) => setGenerateDaysBefore(parseInt(e.target.value) || 0)}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">{t('subscriptions.days')}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{t('subscriptions.notify_customer')}</p>
              </div>
              <Switch checked={notifyBeforeRenewal} onCheckedChange={setNotifyBeforeRenewal} />
            </div>

            {notifyBeforeRenewal && (
              <div className="flex items-center gap-2 ml-4">
                <Input
                  type="number"
                  min={1}
                  value={notifyDaysBefore}
                  onChange={(e) => setNotifyDaysBefore(parseInt(e.target.value) || 7)}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">{t('subscriptions.days_before_renewal')}</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={createSubscription.isPending}>
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
