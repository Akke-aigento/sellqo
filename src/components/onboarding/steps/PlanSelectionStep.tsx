import { useState } from 'react';
import { Check, Sparkles, Zap, Crown, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePricingPlans } from '@/hooks/usePricingPlans';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface PlanSelectionStepProps {
  selectedPlanId: string;
  onSelectPlan: (planId: string) => void;
  onNext: () => void;
  onPrev: () => void;
}

const planIcons: Record<string, React.ReactNode> = {
  free: <Sparkles className="h-6 w-6" />,
  starter: <Zap className="h-6 w-6" />,
  pro: <Crown className="h-6 w-6" />,
  enterprise: <Building2 className="h-6 w-6" />,
};

const planColors: Record<string, string> = {
  free: 'border-muted-foreground/30',
  starter: 'border-blue-500',
  pro: 'border-primary',
  enterprise: 'border-amber-500',
};

export function PlanSelectionStep({
  selectedPlanId,
  onSelectPlan,
  onNext,
  onPrev,
}: PlanSelectionStepProps) {
  const { plans, isLoading } = usePricingPlans();
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);

  // Get key features for display
  const getPlanFeatures = (planId: string): string[] => {
    switch (planId) {
      case 'free':
        return [
          '14 dagen gratis proberen',
          'Tot 10 producten',
          'Tot 25 bestellingen/maand',
          'Basis facturen',
        ];
      case 'starter':
        return [
          '100 producten',
          '250 bestellingen/maand',
          '50 AI credits/maand',
          'E-mail support',
        ];
      case 'pro':
        return [
          'Onbeperkt producten',
          '2.500 bestellingen/maand',
          '500 AI credits/maand',
          'Prioriteit support',
          'Alle integraties',
        ];
      case 'enterprise':
        return [
          'Alles van Pro',
          'Onbeperkt bestellingen',
          '5.000 AI credits/maand',
          'White-label optie',
          'Dedicated support',
        ];
      default:
        return [];
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Kies je plan</h2>
          <p className="text-muted-foreground">
            Start met 14 dagen gratis trial, upgrade wanneer je wilt
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-64 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Kies je plan</h2>
        <p className="text-muted-foreground">
          Start met 14 dagen gratis trial, upgrade wanneer je wilt
        </p>
      </div>

      {/* Plan Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {plans.map((plan) => {
          const isSelected = selectedPlanId === plan.id;
          const isHovered = hoveredPlan === plan.id;
          const features = getPlanFeatures(plan.id);

          return (
            <Card
              key={plan.id}
              className={cn(
                'relative cursor-pointer transition-all duration-200',
                planColors[plan.id] || 'border-border',
                isSelected && 'ring-2 ring-primary border-primary',
                isHovered && !isSelected && 'border-primary/50',
                plan.highlighted && 'shadow-lg'
              )}
              onClick={() => onSelectPlan(plan.id)}
              onMouseEnter={() => setHoveredPlan(plan.id)}
              onMouseLeave={() => setHoveredPlan(null)}
            >
              {plan.highlighted && (
                <Badge className="absolute -top-2 right-4 bg-primary">
                  Populair
                </Badge>
              )}

              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'p-2 rounded-lg',
                      isSelected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                    )}>
                      {planIcons[plan.id] || <Sparkles className="h-6 w-6" />}
                    </div>
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                  </div>
                  {isSelected && (
                    <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
                <CardDescription className="mt-2">
                  {plan.monthly_price === 0 ? (
                    <span className="text-2xl font-bold text-foreground">Gratis</span>
                  ) : (
                    <>
                      <span className="text-2xl font-bold text-foreground">
                        {formatCurrency(plan.monthly_price)}
                      </span>
                      <span className="text-muted-foreground">/maand</span>
                    </>
                  )}
                </CardDescription>
              </CardHeader>

              <CardContent>
                <ul className="space-y-2">
                  {features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <Check className={cn(
                        'h-4 w-4 flex-shrink-0',
                        isSelected ? 'text-primary' : 'text-muted-foreground'
                      )} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Info Text */}
      <div className="text-center text-sm text-muted-foreground">
        <p>
          ✨ Alle plannen starten met 14 dagen gratis trial • Geen creditcard nodig
        </p>
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onPrev}>
          Vorige
        </Button>
        <Button onClick={onNext} disabled={!selectedPlanId}>
          Volgende
        </Button>
      </div>
    </div>
  );
}
