import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RotateCcw, ArrowRight } from 'lucide-react';

interface ResumeOnboardingDialogProps {
  open: boolean;
  currentStep: number;
  totalSteps: number;
  onContinue: () => void;
  onRestart: () => void;
}

export function ResumeOnboardingDialog({
  open,
  currentStep,
  totalSteps,
  onContinue,
  onRestart,
}: ResumeOnboardingDialogProps) {
  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Welkom terug!</DialogTitle>
          <DialogDescription>
            We zien dat je al begonnen was met het instellen van je winkel. 
            Wil je verdergaan waar je was gebleven of opnieuw beginnen?
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-3 mt-4">
          <Button 
            onClick={onContinue}
            className="w-full justify-between"
          >
            <span>Verder waar ik was (Stap {currentStep} van {totalSteps})</span>
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
          
          <Button 
            variant="outline" 
            onClick={onRestart}
            className="w-full justify-between"
          >
            <span>Opnieuw beginnen</span>
            <RotateCcw className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
