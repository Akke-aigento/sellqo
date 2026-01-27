import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ArrowRight, 
  ArrowUp, 
  ArrowDown, 
  Check, 
  X, 
  Loader2,
  Gift,
  AlertTriangle,
  Calendar,
  CreditCard
} from 'lucide-react';
import type { PlanSwitchPreview as PlanSwitchPreviewType } from '@/hooks/usePlanSwitch';

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
  preview: PlanSwitchPreviewType;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PlanSwitchPreviewCard({ preview, isLoading, onConfirm, onCancel }: Props) {
  const formatCurrency = (amount: number, currency = 'EUR') => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const getFeatureLabel = (key: string) => FEATURE_LABELS[key] || key;

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {preview.is_upgrade ? (
            <>
              <ArrowUp className="h-5 w-5 text-green-500" />
              Plan Upgrade
            </>
          ) : (
            <>
              <ArrowDown className="h-5 w-5 text-orange-500" />
              Plan Downgrade
            </>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Plan Comparison */}
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Huidig</p>
            <p className="text-lg font-semibold">{preview.current_plan.name}</p>
            <p className="text-sm">
              {formatCurrency(preview.current_plan.price)}/{preview.current_plan.interval === 'yearly' ? 'jaar' : 'maand'}
            </p>
          </div>

          <ArrowRight className="h-6 w-6 text-muted-foreground" />

          <div className="text-center">
            <p className="text-sm text-muted-foreground">Nieuw</p>
            <p className="text-lg font-semibold text-primary">{preview.target_plan.name}</p>
            <p className="text-sm">
              {formatCurrency(preview.target_plan.price)}/{preview.target_plan.interval === 'yearly' ? 'jaar' : 'maand'}
            </p>
          </div>
        </div>

        <Separator />

        {/* Proration Details */}
        <div className="space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Berekening
          </h4>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Resterende dagen</span>
              <span>{preview.proration.days_remaining} dagen</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ongebruikt tegoed</span>
              <span className="text-green-600">-{formatCurrency(preview.proration.unused_credit)}</span>
            </div>
          </div>

          <div className="p-3 bg-primary/5 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="font-medium">Nu te betalen</span>
              <span className="text-xl font-bold">
                {formatCurrency(preview.stripe_preview.total, preview.stripe_preview.currency)}
              </span>
            </div>
            {preview.stripe_preview.tax > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Incl. {formatCurrency(preview.stripe_preview.tax)} BTW
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            Volgende factuurdatum: {formatDate(preview.proration.next_invoice_date)}
          </div>
        </div>

        {/* Add-ons Migration */}
        {preview.addons.to_migrate.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Gift className="h-4 w-4 text-green-500" />
                Add-ons nu inbegrepen
              </h4>
              <Alert className="border-green-200 bg-green-50">
                <AlertDescription>
                  <p className="mb-2">
                    De volgende add-ons zijn inbegrepen in {preview.target_plan.name} en worden automatisch gemigreerd:
                  </p>
                  <ul className="space-y-1">
                    {preview.addons.to_migrate.map(addon => (
                      <li key={addon.id} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-600" />
                        <span>{getFeatureLabel(addon.type)}</span>
                        <span className="text-muted-foreground">
                          (was {formatCurrency(addon.monthly_price)}/maand)
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 font-medium text-green-700">
                    Besparing: {formatCurrency(preview.addons.monthly_savings)}/maand
                  </p>
                </AlertDescription>
              </Alert>
            </div>
          </>
        )}

        {/* Features Gained */}
        {preview.features.gained.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h4 className="font-medium text-green-600 flex items-center gap-2">
                <Check className="h-4 w-4" />
                Nieuwe features
              </h4>
              <div className="flex flex-wrap gap-2">
                {preview.features.gained.map(feature => (
                  <Badge key={feature} variant="outline" className="border-green-200 bg-green-50">
                    {getFeatureLabel(feature)}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Features Lost */}
        {preview.features.lost.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h4 className="font-medium text-destructive flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Je verliest toegang tot
              </h4>
              <Alert variant="destructive">
                <AlertDescription>
                  <div className="flex flex-wrap gap-2">
                    {preview.features.lost.map(feature => (
                      <Badge key={feature} variant="outline" className="border-destructive/30">
                        <X className="h-3 w-3 mr-1" />
                        {getFeatureLabel(feature)}
                      </Badge>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          </>
        )}
      </CardContent>

      <CardFooter className="flex gap-3">
        <Button variant="outline" onClick={onCancel} disabled={isLoading} className="flex-1">
          Annuleren
        </Button>
        <Button onClick={onConfirm} disabled={isLoading} className="flex-1">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Bezig...
            </>
          ) : (
            <>
              Bevestig {preview.is_upgrade ? 'Upgrade' : 'Downgrade'}
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
