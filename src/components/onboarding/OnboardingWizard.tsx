import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { OnboardingProgress } from './OnboardingProgress';
import { WelcomeStep } from './steps/WelcomeStep';
import { PlanSelectionStep } from './steps/PlanSelectionStep';
import { BusinessDetailsStep } from './steps/BusinessDetailsStep';
import { LogoUploadStep } from './steps/LogoUploadStep';
import { FirstProductStep } from './steps/FirstProductStep';
import { PaymentsStep } from './steps/PaymentsStep';
import { LaunchStep } from './steps/LaunchStep';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useToast } from '@/hooks/use-toast';
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

export function OnboardingWizard() {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSkipDialog, setShowSkipDialog] = useState(false);

  const {
    currentStep,
    totalSteps,
    isOpen,
    isLoading,
    data,
    createdTenantId,
    updateData,
    nextStep,
    prevStep,
    skipOnboarding,
    completeOnboarding,
    createTenant,
    createFirstProduct,
    generateSlug,
    checkSlugAvailable,
  } = useOnboarding();

  if (!isOpen || isLoading) {
    return null;
  }

  // Handle step transitions with API calls
  const handleStepTransition = async (fromStep: number) => {
    setIsProcessing(true);

    try {
      switch (fromStep) {
        case 1:
          // After welcome, just move to plan selection
          break;

        case 2:
          // After plan selection, just move to business details
          break;

        case 3:
          // After business details, create the tenant
          if (!createdTenantId) {
            await createTenant();
            toast({
              title: 'Winkel aangemaakt!',
              description: `${data.shopName} is succesvol aangemaakt.`,
            });
          }
          break;

        case 5:
          // After product step, create the product
          if (data.productName && data.productPrice > 0) {
            await createFirstProduct();
            toast({
              title: 'Product toegevoegd!',
              description: `${data.productName} is toegevoegd aan je catalogus.`,
            });
          }
          break;
      }

      nextStep();
    } catch (error: any) {
      console.error('Step transition error:', error);
      toast({
        title: 'Er ging iets mis',
        description: error.message || 'Probeer het opnieuw.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSkip = async () => {
    await skipOnboarding();
    toast({
      title: 'Onboarding overgeslagen',
      description: 'Je kunt de wizard later opnieuw starten via instellingen.',
    });
  };

  const handleComplete = async () => {
    await completeOnboarding();
    toast({
      title: 'Welkom bij Sellqo!',
      description: 'Je bent helemaal klaar om te beginnen.',
    });
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <WelcomeStep
            data={data}
            updateData={updateData}
            onNext={() => handleStepTransition(1)}
            generateSlug={generateSlug}
            checkSlugAvailable={checkSlugAvailable}
          />
        );

      case 2:
        return (
          <PlanSelectionStep
            selectedPlanId={data.selectedPlanId}
            onSelectPlan={(planId) => updateData({ selectedPlanId: planId })}
            onNext={() => handleStepTransition(2)}
            onPrev={prevStep}
          />
        );

      case 3:
        return (
          <BusinessDetailsStep
            data={data}
            updateData={updateData}
            onNext={() => handleStepTransition(3)}
            onPrev={prevStep}
          />
        );

      case 4:
        return (
          <LogoUploadStep
            data={data}
            updateData={updateData}
            onNext={() => handleStepTransition(4)}
            onPrev={prevStep}
            tenantId={createdTenantId}
          />
        );

      case 5:
        return (
          <FirstProductStep
            data={data}
            updateData={updateData}
            onNext={() => handleStepTransition(5)}
            onPrev={prevStep}
            tenantId={createdTenantId}
            isLoading={isProcessing}
          />
        );

      case 6:
        return (
          <PaymentsStep
            data={data}
            updateData={updateData}
            onNext={() => handleStepTransition(6)}
            onPrev={prevStep}
            tenantId={createdTenantId}
          />
        );

      case 7:
        return <LaunchStep onComplete={handleComplete} />;

      default:
        return null;
    }
  };

  return (
    <>
      {/* Full-screen overlay */}
      <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
        <Card className="w-full max-w-2xl h-[90vh] max-h-[90vh] grid grid-rows-[auto_auto_1fr] shadow-2xl overflow-hidden">
          {/* Header with skip button */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="text-sm font-medium text-muted-foreground">
              Nieuwe winkel instellen
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSkipDialog(true)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4 mr-1" />
              Overslaan
            </Button>
          </div>

          {/* Progress indicator */}
          {currentStep < 7 && (
            <div className="p-6 border-b">
              <OnboardingProgress currentStep={currentStep} totalSteps={totalSteps} />
            </div>
          )}

          {/* Step content */}
          <ScrollArea className="min-h-0 h-full">
            <CardContent className="p-6">
              {isProcessing ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                  <p className="text-muted-foreground">Even geduld...</p>
                </div>
              ) : (
                renderStep()
              )}
            </CardContent>
          </ScrollArea>
        </Card>
      </div>

      {/* Skip confirmation dialog */}
      <AlertDialog open={showSkipDialog} onOpenChange={setShowSkipDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Onboarding overslaan?</AlertDialogTitle>
            <AlertDialogDescription>
              Je kunt de wizard later opnieuw starten via de instellingen. 
              We raden aan om de setup nu af te ronden voor de beste ervaring.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Terug naar wizard</AlertDialogCancel>
            <AlertDialogAction onClick={handleSkip}>
              Ja, overslaan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
