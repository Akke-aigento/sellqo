import { Check, Coffee } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
}

const STEP_LABELS = [
  'Welkom',
  'Bedrijf',
  'Logo',
  'Product',
  'Betalingen',
  'Live!',
];

export function OnboardingProgress({ currentStep, totalSteps }: OnboardingProgressProps) {
  const progressPercentage = ((currentStep - 1) / (totalSteps - 1)) * 100;

  return (
    <div className="space-y-6">
      {/* Motivational tagline */}
      <div className="flex items-center justify-center gap-2 text-muted-foreground">
        <Coffee className="h-4 w-4" />
        <span className="text-sm">Je bent sneller klaar dan een kop koffie zetten!</span>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Stap {currentStep} van {totalSteps}</span>
          <span>{Math.round(progressPercentage)}% voltooid</span>
        </div>
        <Progress value={progressPercentage} className="h-2" />
      </div>

      {/* Step indicators */}
      <div className="relative">
        {/* Connecting line */}
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-muted" />
        <div 
          className="absolute top-4 left-0 h-0.5 bg-primary transition-all duration-500"
          style={{ width: `${progressPercentage}%` }}
        />

        {/* Step circles */}
        <div className="relative flex justify-between">
          {STEP_LABELS.map((label, index) => {
            const stepNumber = index + 1;
            const isCompleted = stepNumber < currentStep;
            const isCurrent = stepNumber === currentStep;
            const isUpcoming = stepNumber > currentStep;

            return (
              <div key={stepNumber} className="flex flex-col items-center">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 border-2',
                    isCompleted && 'bg-primary border-primary text-primary-foreground',
                    isCurrent && 'bg-primary border-primary text-primary-foreground scale-110 shadow-lg',
                    isUpcoming && 'bg-background border-muted text-muted-foreground'
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    stepNumber
                  )}
                </div>
                <span
                  className={cn(
                    'mt-2 text-xs font-medium transition-colors hidden sm:block',
                    isCurrent && 'text-primary',
                    isCompleted && 'text-muted-foreground',
                    isUpcoming && 'text-muted-foreground/60'
                  )}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
