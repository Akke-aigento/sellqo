import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DomainStep = 'domain-saved' | 'dns-configured' | 'ssl-active' | 'live';

interface DomainProgressStepsProps {
  currentStep: DomainStep;
  isPolling?: boolean;
}

const STEPS = [
  { id: 'domain-saved' as const, label: 'Domein', description: 'Domein opgeslagen' },
  { id: 'dns-configured' as const, label: 'DNS', description: 'DNS geconfigureerd' },
  { id: 'ssl-active' as const, label: 'SSL', description: 'Certificaat actief' },
  { id: 'live' as const, label: 'Actief', description: 'Webshop online' },
];

const STEP_ORDER: DomainStep[] = ['domain-saved', 'dns-configured', 'ssl-active', 'live'];

function getStepIndex(step: DomainStep): number {
  return STEP_ORDER.indexOf(step);
}

export function DomainProgressSteps({ currentStep, isPolling = false }: DomainProgressStepsProps) {
  const currentIndex = getStepIndex(currentStep);

  return (
    <div className="w-full">
      {/* Progress Steps */}
      <div className="relative flex justify-between">
        {/* Connection Line */}
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-muted" />
        <div 
          className="absolute top-4 left-0 h-0.5 bg-primary transition-all duration-500"
          style={{ width: `${(currentIndex / (STEPS.length - 1)) * 100}%` }}
        />

        {/* Steps */}
        {STEPS.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isPending = index > currentIndex;

          return (
            <div key={step.id} className="relative flex flex-col items-center z-10">
              {/* Circle */}
              <div
                className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-300',
                  isCompleted && 'bg-primary border-primary text-primary-foreground',
                  isCurrent && 'bg-background border-primary',
                  isPending && 'bg-muted border-muted-foreground/30'
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : isCurrent && isPolling ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <span className={cn(
                    'text-xs font-medium',
                    isCurrent && 'text-primary',
                    isPending && 'text-muted-foreground'
                  )}>
                    {index + 1}
                  </span>
                )}
              </div>

              {/* Label */}
              <span className={cn(
                'mt-2 text-xs font-medium',
                (isCompleted || isCurrent) && 'text-foreground',
                isPending && 'text-muted-foreground'
              )}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Current Step Description */}
      <div className="mt-4 text-center">
        <p className="text-sm text-muted-foreground">
          {currentIndex < STEPS.length && (
            <>
              <span className="font-medium text-foreground">
                {STEPS[currentIndex].label}:
              </span>{' '}
              {isPolling ? 'Bezig met controleren...' : STEPS[currentIndex].description}
            </>
          )}
        </p>
      </div>
    </div>
  );
}
