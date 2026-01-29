import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Loader2, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
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
import { ResumeOnboardingDialog } from './ResumeOnboardingDialog';
import { SlugConflictDialog } from './SlugConflictDialog';
import { SessionExpiredDialog } from '@/components/auth/SessionExpiredDialog';
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
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSkipDialog, setShowSkipDialog] = useState(false);

  const {
    currentStep,
    totalSteps,
    isOpen,
    isLoading,
    data,
    createdTenantId,
    hasPartialProgress,
    sessionExpired,
    slugConflict,
    clearPartialProgress,
    updateData,
    nextStep,
    prevStep,
    goToStep,
    skipOnboarding,
    completeOnboarding,
    restartOnboarding,
    createTenant,
    createFirstProduct,
    generateSlug,
    checkSlugAvailable,
    handleSessionExpiredRelogin,
    handleSlugConflictAccept,
    handleSlugConflictGoToStep1,
    isMissingCriticalData,
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
          // After product step, create the product ONLY if data is filled in
          // Product stap is optioneel - net als Logo en Payments stappen
          if (data.productName?.trim() && data.productPrice > 0) {
            await createFirstProduct();
            toast({
              title: 'Product toegevoegd!',
              description: `${data.productName} is toegevoegd aan je catalogus.`,
            });
          }
          // Geen error als product leeg is - stap is optioneel
          break;
      }

      nextStep();
    } catch (error: any) {
      console.error('Step transition error:', error);
      
      // Handle slug conflict - dialog will show, don't show error toast
      if (error.message === 'SLUG_CONFLICT') {
        console.log('[OnboardingWizard] Slug conflict detected, dialog will show');
        return;
      }
      
      // Handle missing shop data - force restart from step 1
      if (error.message === 'MISSING_SHOP_DATA') {
        toast({
          title: 'Winkelgegevens ontbreken',
          description: 'Vul eerst je winkelnaam en URL in bij stap 1.',
          variant: 'destructive',
        });
        goToStep(1);
        return;
      }
      
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

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
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

  // Handlers for resume dialog
  const handleContinueFromDialog = () => {
    clearPartialProgress();
  };

  const handleRestartFromDialog = async () => {
    clearPartialProgress();
    await restartOnboarding();
  };

  // Handler for accepting slug conflict suggestion and retrying
  const handleSlugAcceptAndRetry = async (newSlug: string) => {
    handleSlugConflictAccept(newSlug);
    // Wait a tick for state to update, then retry tenant creation
    setTimeout(() => {
      handleStepTransition(3);
    }, 100);
  };

  return (
    <>
      {/* Session expired recovery dialog */}
      <SessionExpiredDialog
        open={sessionExpired}
        onRelogin={handleSessionExpiredRelogin}
      />
      {/* Slug conflict dialog */}
      <SlugConflictDialog
        open={!!slugConflict}
        originalSlug={slugConflict?.original || ''}
        suggestedSlug={slugConflict?.suggested || ''}
        onAccept={handleSlugAcceptAndRetry}
        onGoToStep1={handleSlugConflictGoToStep1}
      />
      {/* Resume dialog for returning users with partial progress */}
      <ResumeOnboardingDialog
        open={hasPartialProgress && !sessionExpired && !slugConflict}
        currentStep={currentStep}
        totalSteps={totalSteps}
        isMissingCriticalData={isMissingCriticalData()}
        onContinue={handleContinueFromDialog}
        onRestart={handleRestartFromDialog}
        onLogout={handleLogout}
      />
      {/* Full-screen overlay */}
      <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
        <Card className="w-full max-w-2xl h-[90vh] max-h-[90vh] grid grid-rows-[auto_auto_1fr] shadow-2xl overflow-hidden">
          {/* Header with skip and logout buttons */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="text-sm font-medium text-muted-foreground">
              Nieuwe winkel instellen
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-4 w-4 mr-1" />
                Uitloggen
              </Button>
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
