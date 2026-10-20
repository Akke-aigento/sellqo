import { useState, useRef, useEffect } from 'react';
import { Gift, Printer, Mail, User, MessageSquare, Palette } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useGiftCardDesigns } from '@/hooks/useGiftCardDesigns';
import { usePOSGiftCardSale } from '@/hooks/usePOSGiftCardSale';
import { usePOSPrinter } from '@/hooks/usePOSPrinter';
import { useTenant } from '@/hooks/useTenant';
import { POSGiftCardPrint } from './POSGiftCardPrint';
import type { GiftCard } from '@/types/giftCard';
import { useTranslation } from 'react-i18next';

interface POSGiftCardSellDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  terminalId: string;
  onGiftCardCreated: (giftCard: GiftCard, amount: number) => void;
}

const PRESET_AMOUNTS = [10, 25, 50, 100];

export function POSGiftCardSellDialog({
  open,
  onOpenChange,
  terminalId,
  onGiftCardCreated,
}: POSGiftCardSellDialogProps) {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const { data: designs } = useGiftCardDesigns();
  const { createGiftCard, markAsPrinted, isCreating } = usePOSGiftCardSale();
  const { printReceipt } = usePOSPrinter();
  const printRef = useRef<HTMLDivElement>(null);

  const [amount, setAmount] = useState<number>(25);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isCustomAmount, setIsCustomAmount] = useState(false);
  const [designId, setDesignId] = useState<string>('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [personalMessage, setPersonalMessage] = useState('');
  const [shouldPrint, setShouldPrint] = useState(true);
  const [shouldEmail, setShouldEmail] = useState(false);
  const [createdGiftCard, setCreatedGiftCard] = useState<GiftCard | null>(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setAmount(25);
      setCustomAmount('');
      setIsCustomAmount(false);
      setDesignId('');
      setRecipientName('');
      setRecipientEmail('');
      setPersonalMessage('');
      setShouldPrint(true);
      setShouldEmail(false);
      setCreatedGiftCard(null);
    }
  }, [open]);

  const activeDesigns = designs?.filter((d) => d.is_active) || [];
  const selectedDesign = activeDesigns.find((d) => d.id === designId);

  const finalAmount = isCustomAmount ? parseFloat(customAmount) || 0 : amount;

  const handleCreate = async () => {
    if (finalAmount <= 0) return;

    const result = await createGiftCard.mutateAsync({
      amount: finalAmount,
      designId: designId || null,
      recipientName: recipientName || null,
      recipientEmail: recipientEmail || null,
      personalMessage: personalMessage || null,
      terminalId,
      sendEmail: shouldEmail && !!recipientEmail,
    });

    setCreatedGiftCard(result);

    // Print if requested
    if (shouldPrint && printRef.current) {
      // Small delay to ensure the print content is rendered
      setTimeout(async () => {
        if (printRef.current) {
          const printed = await printReceipt(printRef.current);
          if (printed) {
            await markAsPrinted.mutateAsync(result.id);
          }
        }
        // Notify parent and close
        onGiftCardCreated(result, finalAmount);
        onOpenChange(false);
      }, 100);
    } else {
      onGiftCardCreated(result, finalAmount);
      onOpenChange(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            {t('admin.pos.pOSGiftCardSellDialog.cadeaukaart_verkopen')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Bedrag selectie */}
          <div className="space-y-3">
            <Label className="text-base font-medium">{t('admin.promotions.giftCardBalanceDialog.bedrag')}</Label>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_AMOUNTS.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant={!isCustomAmount && amount === preset ? 'default' : 'outline'}
                  onClick={() => {
                    setAmount(preset);
                    setIsCustomAmount(false);
                  }}
                  className="h-12 text-lg font-semibold"
                >
                  €{preset}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="custom-amount"
                checked={isCustomAmount}
                onCheckedChange={(checked) => setIsCustomAmount(checked === true)}
              />
              <Label htmlFor="custom-amount" className="text-sm">
                {t('admin.pos.pOSGiftCardSellDialog.ander_bedrag')}
              </Label>
              {isCustomAmount && (
                <div className="flex-1">
                  <Input
                    type="number"
                    min="1"
                    step="0.01"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder="0,00"
                    className="text-right"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Design selectie */}
          {activeDesigns.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                {t('admin.pos.pOSGiftCardSellDialog.design_optioneel')}
              </Label>
              <Select value={designId || 'none'} onValueChange={(v) => setDesignId(v === 'none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('admin.pos.pOSGiftCardSellDialog.selecteer_een_design')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('admin.pos.pOSGiftCardSellDialog.geen_design')}</SelectItem>
                  {activeDesigns.map((design) => (
                    <SelectItem key={design.id} value={design.id}>
                      {design.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedDesign?.image_url && (
                <img
                  src={selectedDesign.image_url}
                  alt={selectedDesign.name}
                  className="w-full h-20 object-cover rounded-lg border"
                />
              )}
            </div>
          )}

          {/* Ontvanger info */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-base font-medium">
              <User className="h-4 w-4" />
              {t('admin.pos.pOSGiftCardSellDialog.ontvanger_optioneel')}
            </Label>
            <div className="grid gap-3">
              <Input
                placeholder={t('admin.promotions.giftCardFormDialog.naam_ontvanger')}
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
              />
              <Input
                type="email"
                placeholder={t('admin.pos.pOSGiftCardSellDialog.e_mail_ontvanger')}
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Persoonlijke boodschap */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              {t('admin.pos.pOSGiftCardSellDialog.persoonlijke_boodschap_optioneel')}
            </Label>
            <Textarea
              placeholder={t('admin.pos.pOSGiftCardSellDialog.bijv_veel_plezier_met_je_verjaardag')}
              value={personalMessage}
              onChange={(e) => setPersonalMessage(e.target.value)}
              rows={2}
            />
          </div>

          {/* Aflevering opties */}
          <div className="space-y-3 pt-2 border-t">
            <Label className="text-base font-medium">{t('admin.pos.pOSGiftCardSellDialog.aflevering')}</Label>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="should-print"
                  checked={shouldPrint}
                  onCheckedChange={(checked) => setShouldPrint(checked === true)}
                />
                <Label htmlFor="should-print" className="flex items-center gap-2 cursor-pointer">
                  <Printer className="h-4 w-4" />
                  {t('admin.pos.pOSGiftCardSellDialog.direct_afdrukken')}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="should-email"
                  checked={shouldEmail}
                  onCheckedChange={(checked) => setShouldEmail(checked === true)}
                  disabled={!recipientEmail}
                />
                <Label
                  htmlFor="should-email"
                  className={`flex items-center gap-2 cursor-pointer ${
                    !recipientEmail ? 'opacity-50' : ''
                  }`}
                >
                  <Mail className="h-4 w-4" />
                  E-mail naar ontvanger
                  {!recipientEmail && (
                    <span className="text-xs text-muted-foreground">{t('admin.pos.pOSGiftCardSellDialog.vul_e_mail_in')}</span>
                  )}
                </Label>
              </div>
            </div>
          </div>

          {/* Totaal */}
          <div className="bg-muted rounded-lg p-4 text-center">
            <div className="text-sm text-muted-foreground">{t('common.total')}</div>
            <div className="text-3xl font-bold">{formatCurrency(finalAmount)}</div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleCreate}
            disabled={finalAmount <= 0 || isCreating}
          >
            {isCreating ? t('admin.marketing.creditPurchaseDialog.bezig') : t('admin.pos.pOSGiftCardSellDialog.toevoegen_aan_kassa')}
          </Button>
        </DialogFooter>

        {/* Hidden print content */}
        {createdGiftCard && (
          <div className="hidden">
            <POSGiftCardPrint
              ref={printRef}
              giftCard={createdGiftCard}
              design={selectedDesign}
              tenantName={currentTenant?.name || 'Winkel'}
              tenantLogo={currentTenant?.logo_url}
              format="thermal"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
