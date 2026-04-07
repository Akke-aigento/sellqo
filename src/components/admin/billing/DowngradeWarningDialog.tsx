import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShieldAlert, X, ArrowDown, Crown, ChevronRight } from 'lucide-react';

const FEATURE_LABELS: Record<string, string> = {
  pos: 'POS Terminal',
  webshop_builder: 'Webshop Builder',
  visual_editor: 'Visuele Editor',
  ai_marketing: 'AI Marketing',
  ai_copywriting: 'AI Copywriting',
  ai_images: 'AI Afbeeldingen',
  ai_seo: 'AI SEO',
  ai_coach: 'AI Coach',
  ai_chatbot: 'AI Chatbot',
  ai_ab_testing: 'AI A/B Testing',
  bol_com: 'Bol.com',
  bol_vvb_labels: 'Bol.com VVB Labels',
  amazon: 'Amazon',
  ebay: 'eBay',
  social_commerce: 'Social Commerce',
  whatsapp: 'WhatsApp',
  peppol: 'Peppol e-Invoicing',
  facturX: 'Factur-X',
  multiCurrency: 'Multi-Valuta',
  advancedAnalytics: 'Geavanceerde Analytics',
  whiteLabel: 'White Label',
  customDomain: 'Eigen Domein',
  prioritySupport: 'Prioriteit Support',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featuresLost: string[];
  currentPlanName: string;
  targetPlanName: string;
  onConfirm: () => void;
}

export function DowngradeWarningDialog({
  open,
  onOpenChange,
  featuresLost,
  currentPlanName,
  targetPlanName,
  onConfirm,
}: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [acknowledged, setAcknowledged] = useState(false);

  const getFeatureLabel = (key: string) => FEATURE_LABELS[key] || key;

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setStep(1);
      setAcknowledged(false);
    }
    onOpenChange(isOpen);
  };

  const handleConfirm = () => {
    if (acknowledged) {
      onConfirm();
      setStep(1);
      setAcknowledged(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-md p-0 overflow-hidden border-border">
        {step === 1 ? (
          <div className="animate-fade-in flex flex-col items-center text-center p-8 gap-6">
            {/* Animated icon */}
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-destructive/10 animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite] scale-125" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <ShieldAlert className="h-8 w-8 text-destructive" />
              </div>
            </div>

            {/* Headline */}
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-foreground">
                Wil je echt downgraden?
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Je <strong className="text-foreground">{currentPlanName}</strong> abonnement 
                geeft je toegang tot krachtige tools. Weet je zeker dat je deze wilt opgeven?
              </p>
            </div>

            {/* Plan comparison cards */}
            <div className="flex items-center gap-3 w-full">
              {/* Current plan - highlighted */}
              <div className="flex-1 rounded-lg border-2 border-primary bg-primary/5 p-4">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Crown className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium text-primary">Huidig</span>
                </div>
                <p className="font-semibold text-foreground">{currentPlanName}</p>
              </div>

              {/* Arrow */}
              <ArrowDown className="h-5 w-5 text-muted-foreground shrink-0 rotate-[-90deg]" />

              {/* Target plan - dimmed */}
              <div className="flex-1 rounded-lg border border-border bg-muted/50 p-4 opacity-60">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <span className="text-xs font-medium text-muted-foreground">Nieuw</span>
                </div>
                <p className="font-semibold text-muted-foreground">{targetPlanName}</p>
              </div>
            </div>

            {/* Buttons - asymmetric: stay is big/primary, downgrade is small/ghost */}
            <div className="flex flex-col gap-2 w-full pt-2">
              <Button
                size="lg"
                className="w-full font-semibold"
                onClick={() => handleClose(false)}
              >
                Nee, ik blijf bij {currentPlanName}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground hover:text-destructive"
                onClick={() => setStep(2)}
              >
                Ja, ik wil downgraden
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="animate-fade-in p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <ShieldAlert className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Bevestig downgrade
                </h2>
                <p className="text-xs text-muted-foreground">
                  {currentPlanName} → {targetPlanName}
                </p>
              </div>
            </div>

            {/* Features lost */}
            {featuresLost.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Je verliest toegang tot:
                </p>
                <div className="flex flex-wrap gap-2">
                  {featuresLost.map(feature => (
                    <Badge
                      key={feature}
                      variant="outline"
                      className="border-border bg-muted text-destructive"
                    >
                      <X className="h-3 w-3 mr-1" />
                      {getFeatureLabel(feature)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Acknowledgement checkbox */}
            <div className="flex items-start space-x-3 rounded-lg border border-border bg-muted/50 p-3">
              <Checkbox
                id="acknowledge"
                checked={acknowledged}
                onCheckedChange={(checked) => setAcknowledged(checked === true)}
              />
              <label
                htmlFor="acknowledge"
                className="text-sm leading-tight cursor-pointer text-muted-foreground"
              >
                Ik begrijp dat ik toegang verlies tot bovenstaande features en dat
                eventuele data gekoppeld aan deze features niet meer toegankelijk is.
              </label>
            </div>

            {/* Buttons */}
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep(1)}
              >
                Terug
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleConfirm}
                disabled={!acknowledged}
              >
                Bevestig Downgrade
              </Button>
            </div>
          </div>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
