import { Check, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export type DomainStep = 'domain-saved' | 'dns-configured' | 'ssl-active' | 'live';

interface DomainProgressStepsProps {
  currentStep: DomainStep;
  isPolling?: boolean;
}

/** Factory: de omschrijvingen gaan door i18n. */
const buildSteps = (t: (key: string) => string) => [
  { id: 'domain-saved' as const, label: 'Domein', description: t('settings.domain.steps.saved') },
  { id: 'dns-configured' as const, label: 'DNS', description: t('settings.domain.steps.dnsConfigured') },
  { id: 'ssl-active' as const, label: 'SSL', description: t('settings.domain.steps.certificateActive') },
  { id: 'live' as const, label: 'Actief', description: t('settings.domain.steps.shopOnline') },
];

const STEP_ORDER: DomainStep[] = ['domain-saved', 'dns-configured', 'ssl-active', 'live'];

function getStepIndex(step: DomainStep): number {
  return STEP_ORDER.indexOf(step);
}

export function DomainProgressSteps({ currentStep, isPolling = false }: DomainProgressStepsProps) {
  const { t } = useTranslation();
  const STEPS = buildSteps(t);
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
