import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, X } from 'lucide-react';

// Feature name mapping for Dutch display
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
  const [acknowledged, setAcknowledged] = useState(false);

  const getFeatureLabel = (key: string) => FEATURE_LABELS[key] || key;

  const handleConfirm = () => {
    if (acknowledged) {
      onConfirm();
      setAcknowledged(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-xl">
              Downgrade bevestigen
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-4 pt-4">
              <p>
                Je staat op het punt om te downgraden van{' '}
                <strong>{currentPlanName}</strong> naar{' '}
                <strong>{targetPlanName}</strong>.
              </p>

              {featuresLost.length > 0 && (
                <div className="space-y-2">
                  <p className="font-medium text-foreground">
                    Je verliest toegang tot de volgende features:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {featuresLost.map(feature => (
                      <Badge 
                        key={feature} 
                        variant="outline" 
                        className="border-destructive/30 text-destructive"
                      >
                        <X className="h-3 w-3 mr-1" />
                        {getFeatureLabel(feature)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-start space-x-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <Checkbox
                  id="acknowledge"
                  checked={acknowledged}
                  onCheckedChange={(checked) => setAcknowledged(checked === true)}
                />
                <label
                  htmlFor="acknowledge"
                  className="text-sm leading-tight cursor-pointer"
                >
                  Ik begrijp dat ik toegang verlies tot bovenstaande features en dat
                  eventuele data gekoppeld aan deze features niet meer toegankelijk is.
                </label>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setAcknowledged(false)}>
            Annuleren
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!acknowledged}
            className="bg-destructive hover:bg-destructive/90"
          >
            Bevestig Downgrade
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
