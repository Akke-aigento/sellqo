import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RotateCcw, ArrowRight, LogOut, AlertTriangle } from 'lucide-react';

interface ResumeOnboardingDialogProps {
  open: boolean;
  currentStep: number;
  totalSteps: number;
  isMissingCriticalData?: boolean;
  onContinue: () => void;
  onRestart: () => void;
  onLogout: () => void;
}

export function ResumeOnboardingDialog({
  open,
  currentStep,
  totalSteps,
  isMissingCriticalData = false,
  onContinue,
  onRestart,
  onLogout,
}: ResumeOnboardingDialogProps) {
  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>
            {isMissingCriticalData ? (
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Sessie kon niet worden hersteld
              </span>
            ) : (
              'Welkom terug!'
            )}
          </DialogTitle>
          <DialogDescription>
            {isMissingCriticalData ? (
              'Je vorige onboarding kon niet volledig worden hersteld. Begin opnieuw om je winkel correct in te stellen.'
            ) : (
              'We zien dat je al begonnen was met het instellen van je winkel. Wil je verdergaan waar je was gebleven of opnieuw beginnen?'
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-3 mt-4">
          {!isMissingCriticalData && (
            <Button 
              onClick={onContinue}
              className="w-full justify-between"
            >
              <span>Verder waar ik was (Stap {currentStep} van {totalSteps})</span>
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
          
          <Button 
            variant={isMissingCriticalData ? "default" : "outline"}
            onClick={onRestart}
            className="w-full justify-between"
          >
            <span>{isMissingCriticalData ? 'Opnieuw starten' : 'Opnieuw beginnen'}</span>
            <RotateCcw className="h-4 w-4 ml-2" />
          </Button>
          
          <Button 
            variant="ghost" 
            onClick={onLogout}
            className="w-full justify-between text-muted-foreground"
          >
            <span>Uitloggen / Ander account</span>
            <LogOut className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
