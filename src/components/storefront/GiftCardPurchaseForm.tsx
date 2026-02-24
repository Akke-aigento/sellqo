import { useState } from 'react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { CalendarIcon, Gift, Mail, MessageSquare, ChevronRight, ShoppingCart, Check, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useCart } from '@/context/CartContext';
import { toast } from 'sonner';
import { giftCardTemplates, GiftCardTemplatePreview, GiftCardTemplateRenderer } from '@/components/shared/GiftCardTemplates';

interface GiftCardPurchaseFormProps {
  product: any;
  currency?: string;
  themeSettings?: any;
  logoUrl?: string;
}

export function GiftCardPurchaseForm({ product, currency = 'EUR', themeSettings, logoUrl }: GiftCardPurchaseFormProps) {
  const { addToCart } = useCart();
  const [step, setStep] = useState(1);
  
  // Step 1: Amount & Design
  const denominations: number[] = product.gift_card_denominations || [];
  const allowCustom = product.gift_card_allow_custom || false;
  const minAmount = product.gift_card_min_amount || 10;
  const maxAmount = product.gift_card_max_amount || 500;
  const [selectedAmount, setSelectedAmount] = useState<number | null>(denominations[0] || null);
  const [customAmount, setCustomAmount] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const defaultDesign = product.gift_card_design_id || 'elegant';
  const [selectedDesignId, setSelectedDesignId] = useState(defaultDesign);

  // Step 2: Recipient
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [personalMessage, setPersonalMessage] = useState('');
  const [sendDate, setSendDate] = useState<Date | undefined>(undefined);

  const effectiveAmount = useCustom ? parseFloat(customAmount) || 0 : selectedAmount || 0;
  const storeName = themeSettings?.store_name || themeSettings?.name || 'Cadeaukaart';
  const brandColor = themeSettings?.primary_color || themeSettings?.brand_color;

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('nl-NL', { style: 'currency', currency }).format(price);

  const handleSelectDenomination = (amount: number) => {
    setSelectedAmount(amount);
    setUseCustom(false);
  };

  const handleCustomToggle = () => {
    setUseCustom(true);
    setSelectedAmount(null);
  };

  const isStep1Valid = effectiveAmount > 0 && (!useCustom || (effectiveAmount >= minAmount && effectiveAmount <= maxAmount));

  const isStep2Valid = recipientName.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail);

  const handleAddToCart = () => {
    if (!isStep1Valid || !isStep2Valid) return;

    addToCart({
      productId: product.id,
      name: `Cadeaukaart - ${formatPrice(effectiveAmount)}`,
      price: effectiveAmount,
      quantity: 1,
      image: product.images?.[0],
      giftCard: {
        recipientName: recipientName.trim(),
        recipientEmail: recipientEmail.trim(),
        personalMessage: personalMessage.trim() || undefined,
        sendDate: sendDate ? sendDate.toISOString() : undefined,
        designId: selectedDesignId,
      },
    });
    toast.success('Cadeaukaart toegevoegd aan winkelwagen');
  };

  return (
    <div className="space-y-6">
      {/* Step indicators */}
      <div className="flex items-center gap-2 text-sm">
        {[
          { num: 1, label: 'Bedrag & ontwerp' },
          { num: 2, label: 'Ontvanger' },
          { num: 3, label: 'Bevestiging' },
        ].map((s, i) => (
          <div key={s.num} className="flex items-center gap-2">
            {i > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <button
              type="button"
              onClick={() => {
                if (s.num < step) setStep(s.num);
              }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium transition-colors',
                step === s.num
                  ? 'bg-primary text-primary-foreground'
                  : step > s.num
                  ? 'bg-primary/10 text-primary cursor-pointer'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {step > s.num ? <Check className="h-3.5 w-3.5" /> : null}
              {s.label}
            </button>
          </div>
        ))}
      </div>

      {/* Step 1: Amount & Design */}
      {step === 1 && (
        <div className="space-y-6">
          {/* Amount selection */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              Kies een bedrag
            </h3>

            {denominations.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {denominations.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => handleSelectDenomination(amount)}
                    className={cn(
                      'py-3 px-4 rounded-lg border-2 text-center font-semibold transition-all',
                      selectedAmount === amount && !useCustom
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-input hover:border-primary/50'
                    )}
                  >
                    {formatPrice(amount)}
                  </button>
                ))}
              </div>
            )}

            {allowCustom && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleCustomToggle}
                  className={cn(
                    'w-full py-3 px-4 rounded-lg border-2 text-center font-medium transition-all',
                    useCustom
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-dashed border-input hover:border-primary/50'
                  )}
                >
                  Eigen bedrag kiezen
                </button>
                {useCustom && (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">€</span>
                    <Input
                      type="number"
                      min={minAmount}
                      max={maxAmount}
                      step="0.01"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      className="pl-7 text-lg font-semibold"
                      placeholder={`${minAmount} - ${maxAmount}`}
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Tussen {formatPrice(minAmount)} en {formatPrice(maxAmount)}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Design selection */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              Kies een ontwerp
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {giftCardTemplates.map((template) => (
                <GiftCardTemplatePreview
                  key={template.id}
                  template={template}
                  selected={selectedDesignId === template.id}
                  onClick={() => setSelectedDesignId(template.id)}
                  amount={effectiveAmount || undefined}
                  storeName={storeName}
                  compact
                  brandColor={brandColor}
                  logoUrl={logoUrl}
                />
              ))}
            </div>
          </div>

          {effectiveAmount > 0 && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
              <span className="text-sm font-medium">Geselecteerd bedrag</span>
              <span className="text-lg font-bold text-primary">{formatPrice(effectiveAmount)}</span>
            </div>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={() => setStep(2)}
            disabled={!isStep1Valid}
            style={{ backgroundColor: brandColor || undefined }}
          >
            Volgende: Ontvanger
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}

      {/* Step 2: Recipient */}
      {step === 2 && (
        <div className="space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Voor wie is de cadeaukaart?
          </h3>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="gc-name">Naam ontvanger *</Label>
              <Input
                id="gc-name"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Bijv. Jan Janssen"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gc-email">E-mailadres ontvanger *</Label>
              <Input
                id="gc-email"
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="jan@voorbeeld.nl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gc-message" className="flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                Persoonlijk bericht (optioneel)
              </Label>
              <Textarea
                id="gc-message"
                value={personalMessage}
                onChange={(e) => setPersonalMessage(e.target.value)}
                placeholder="Schrijf een persoonlijk bericht..."
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground text-right">{personalMessage.length}/500</p>
            </div>
            <div className="space-y-1.5">
              <Label>Verzenddatum</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !sendDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {sendDate ? format(sendDate, 'PPP', { locale: nl }) : 'Direct versturen'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={sendDate}
                    onSelect={setSendDate}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                    className={cn('p-3 pointer-events-auto')}
                  />
                  {sendDate && (
                    <div className="px-3 pb-3">
                      <Button variant="ghost" size="sm" className="w-full" onClick={() => setSendDate(undefined)}>
                        Direct versturen
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                Laat leeg om direct na betaling te versturen
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
              Terug
            </Button>
            <Button
              className="flex-1"
              size="lg"
              onClick={() => setStep(3)}
              disabled={!isStep2Valid}
              style={{ backgroundColor: brandColor || undefined }}
            >
              Volgende: Bevestiging
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Confirmation */}
      {step === 3 && (
        <div className="space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Check className="h-5 w-5 text-primary" />
            Bevestig je cadeaukaart
          </h3>

          {/* Template preview */}
          <GiftCardTemplateRenderer
            templateId={selectedDesignId}
            storeName={storeName}
            amount={effectiveAmount}
            recipientName={recipientName}
            personalMessage={personalMessage}
            brandColor={brandColor}
            logoUrl={logoUrl}
          />

          <div className="rounded-lg border divide-y">
            <div className="flex justify-between items-center p-3">
              <span className="text-sm text-muted-foreground">Bedrag</span>
              <span className="font-bold text-lg">{formatPrice(effectiveAmount)}</span>
            </div>
            <div className="flex justify-between items-center p-3">
              <span className="text-sm text-muted-foreground">Ontvanger</span>
              <span className="font-medium text-sm">{recipientName}</span>
            </div>
            <div className="flex justify-between items-center p-3">
              <span className="text-sm text-muted-foreground">E-mail</span>
              <span className="font-medium text-sm">{recipientEmail}</span>
            </div>
            {personalMessage && (
              <div className="p-3">
                <span className="text-sm text-muted-foreground block mb-1">Bericht</span>
                <p className="text-sm italic">"{personalMessage}"</p>
              </div>
            )}
            <div className="flex justify-between items-center p-3">
              <span className="text-sm text-muted-foreground">Verzending</span>
              <span className="font-medium text-sm">
                {sendDate ? format(sendDate, 'PPP', { locale: nl }) : 'Direct na betaling'}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
              Terug
            </Button>
            <Button
              className="flex-1"
              size="lg"
              onClick={handleAddToCart}
              style={{ backgroundColor: brandColor || undefined }}
            >
              <ShoppingCart className="h-5 w-5 mr-2" />
              Toevoegen aan winkelwagen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
