import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MessageCircle, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface WhatsAppOptInProps {
  onOptInChange: (optIn: boolean, phoneNumber: string) => void;
  initialPhone?: string;
  disabled?: boolean;
}

export function WhatsAppOptIn({ onOptInChange, initialPhone = '', disabled = false }: WhatsAppOptInProps) {
  const [optedIn, setOptedIn] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(initialPhone);

  const handleOptInChange = (checked: boolean) => {
    setOptedIn(checked);
    onOptInChange(checked, phoneNumber);
  };

  const handlePhoneChange = (value: string) => {
    setPhoneNumber(value);
    if (optedIn) {
      onOptInChange(true, value);
    }
  };

  return (
    <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
      <div className="flex items-start gap-3">
        <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded">
          <MessageCircle className="h-4 w-4 text-emerald-600" />
        </div>
        <div className="flex-1 space-y-3">
          <div className="flex items-start gap-2">
            <Checkbox
              id="whatsapp-optin"
              checked={optedIn}
              onCheckedChange={handleOptInChange}
              disabled={disabled}
              className="mt-0.5"
            />
            <div>
              <Label htmlFor="whatsapp-optin" className="font-medium cursor-pointer">
                Ontvang updates via WhatsApp
              </Label>
              <p className="text-sm text-muted-foreground mt-0.5">
                Krijg bestelbevestiging en verzend updates direct op je telefoon
              </p>
            </div>
          </div>

          {optedIn && (
            <div className="space-y-2 pl-6">
              <Label htmlFor="whatsapp-phone" className="text-sm">
                WhatsApp nummer
              </Label>
              <Input
                id="whatsapp-phone"
                type="tel"
                placeholder="+31 6 12345678"
                value={phoneNumber}
                onChange={(e) => handlePhoneChange(e.target.value)}
                disabled={disabled}
                className="max-w-xs"
              />
            </div>
          )}

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground pl-6">
            <Info className="h-3 w-3" />
            <span>Je kunt je altijd afmelden door STOP te sturen</span>
          </div>
        </div>
      </div>
    </div>
  );
}
