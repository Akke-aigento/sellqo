import { ReactNode } from 'react';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

interface FeatureGateProps {
  feature: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const { checkFeature } = useUsageLimits();
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const hasFeature = checkFeature(feature);

  if (hasFeature) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-8 text-center">
        <Lock className="h-10 w-10 text-muted-foreground mb-4" />
        <h3 className="font-semibold mb-2">Feature niet beschikbaar</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Deze feature is niet inbegrepen in je huidige abonnement.
        </p>
        <Button onClick={() => navigate('/pricing')}>
          Bekijk upgrade opties
        </Button>
      </CardContent>
    </Card>
  );
}

// Hook for checking feature access without UI
export function useFeatureAccess(feature: string): boolean {
  const { checkFeature } = useUsageLimits();
  return checkFeature(feature);
}
