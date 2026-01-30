import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  HelpCircle, 
  ChevronLeft, 
  ChevronRight,
  Settings,
  AppWindow,
  Shield,
  Key,
  CheckCircle,
} from 'lucide-react';

const GUIDE_STEPS = [
  {
    step: 1,
    title: 'Ga naar Develop Apps',
    description: 'Open je Shopify Admin en navigeer naar Settings → Apps → Develop apps',
    icon: Settings,
    details: [
      'Log in op je Shopify Admin',
      'Klik op "Settings" (linksonder)',
      'Selecteer "Apps and sales channels"',
      'Klik op "Develop apps" bovenaan',
    ],
  },
  {
    step: 2,
    title: 'Maak een nieuwe App',
    description: 'Klik op "Create an app" en geef deze een naam',
    icon: AppWindow,
    details: [
      'Klik op de groene "Create an app" knop',
      'Voer als naam in: "SellQo Connector"',
      'Klik op "Create app"',
    ],
  },
  {
    step: 3,
    title: 'Configureer API Scopes',
    description: 'Stel de juiste toegangsrechten in voor de app',
    icon: Shield,
    details: [
      'Klik op "Configuration" tab',
      'Klik op "Configure" bij Admin API integration',
      'Selecteer deze scopes:',
      '• read_products, write_products',
      '• read_orders, write_orders', 
      '• read_inventory, write_inventory',
      '• read_customers',
      '• read_fulfillments, write_fulfillments',
      'Klik op "Save"',
    ],
  },
  {
    step: 4,
    title: 'Installeer de App',
    description: 'Installeer de app om de access token te genereren',
    icon: CheckCircle,
    details: [
      'Klik op "Install app" knop rechtsboven',
      'Bevestig door op "Install" te klikken',
      'De app is nu geïnstalleerd',
    ],
  },
  {
    step: 5,
    title: 'Kopieer de Access Token',
    description: 'Kopieer de Admin API access token (wordt slechts 1x getoond!)',
    icon: Key,
    details: [
      'Na installatie zie je de "Admin API access token"',
      '⚠️ BELANGRIJK: Deze wordt maar 1x getoond!',
      'Klik op "Reveal token once"',
      'Kopieer de token (begint met shpat_)',
      'Plak deze in het formulier hieronder',
    ],
  },
];

export function ShopifySetupGuide() {
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const step = GUIDE_STEPS[currentStep];
  const StepIcon = step.icon;

  const handlePrevious = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const handleNext = () => {
    if (currentStep < GUIDE_STEPS.length - 1) setCurrentStep(currentStep + 1);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <HelpCircle className="w-4 h-4" />
          <span className="text-xs">Handleiding</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#96bf48] rounded-lg flex items-center justify-center">
              <StepIcon className="w-4 h-4 text-white" />
            </div>
            Shopify Custom App Instellen
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Progress indicator */}
          <div className="flex items-center gap-1">
            {GUIDE_STEPS.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  idx <= currentStep ? 'bg-[#96bf48]' : 'bg-muted'
                }`}
              />
            ))}
          </div>

          {/* Step content */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline" className="bg-[#96bf48]/10 text-[#96bf48] border-[#96bf48]/30">
                Stap {step.step}
              </Badge>
              <h3 className="font-semibold">{step.title}</h3>
            </div>
            
            <p className="text-sm text-muted-foreground mb-4">
              {step.description}
            </p>

            {/* Visual placeholder for screenshot */}
            <div className="bg-background border-2 border-dashed border-muted-foreground/20 rounded-lg p-6 mb-4 flex flex-col items-center justify-center min-h-[120px]">
              <StepIcon className="w-10 h-10 text-muted-foreground/40 mb-2" />
              <span className="text-xs text-muted-foreground/60">
                Screenshot placeholder
              </span>
            </div>

            {/* Step details */}
            <ul className="space-y-1.5">
              {step.details.map((detail, idx) => (
                <li 
                  key={idx} 
                  className={`text-sm ${
                    detail.startsWith('•') || detail.startsWith('⚠️')
                      ? 'ml-4 text-muted-foreground'
                      : 'flex items-start gap-2'
                  }`}
                >
                  {!detail.startsWith('•') && !detail.startsWith('⚠️') && (
                    <span className="text-[#96bf48] font-medium shrink-0">
                      {idx + 1}.
                    </span>
                  )}
                  <span className={detail.startsWith('⚠️') ? 'text-amber-600 font-medium' : ''}>
                    {detail}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevious}
              disabled={currentStep === 0}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Vorige
            </Button>

            <span className="text-sm text-muted-foreground">
              {currentStep + 1} / {GUIDE_STEPS.length}
            </span>

            {currentStep < GUIDE_STEPS.length - 1 ? (
              <Button
                size="sm"
                onClick={handleNext}
                className="bg-[#96bf48] hover:bg-[#7ea83d]"
              >
                Volgende
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => setOpen(false)}
                className="bg-[#96bf48] hover:bg-[#7ea83d]"
              >
                Sluiten
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
