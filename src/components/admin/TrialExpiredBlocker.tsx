import { useNavigate } from 'react-router-dom';
import { AlertTriangle, LogOut, CreditCard, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import { useAuth } from '@/hooks/useAuth';
import { usePricingPlans } from '@/hooks/usePricingPlans';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';

export function TrialExpiredBlocker() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { isPlatformAdmin } = useAuth();
  const { isLoading, shouldBlockAccess, planName, status } = useTrialStatus();
  const { plans } = usePricingPlans();

  // Don't render for platform admins or if still loading or shouldn't block
  if (isLoading || isPlatformAdmin || !shouldBlockAccess()) {
    return null;
  }

  // Get recommended plans (exclude free)
  const paidPlans = plans.filter(p => p.monthly_price > 0).slice(0, 3);

  const isPaymentIssue = status === 'past_due' || status === 'unpaid';
  const isCanceled = status === 'canceled';

  const handleUpgrade = (planId: string) => {
    navigate(`/admin/settings?tab=subscription&plan=${planId}`);
  };

  const handleManageSubscription = () => {
    navigate('/admin/settings?tab=subscription');
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background/98 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className={cn(
            "mx-auto mb-4 h-16 w-16 rounded-full flex items-center justify-center",
            isPaymentIssue ? "bg-orange-100" : "bg-destructive/10"
          )}>
            <AlertTriangle className={cn(
              "h-8 w-8",
              isPaymentIssue ? "text-orange-600" : "text-destructive"
            )} />
          </div>
          <CardTitle className="text-2xl">
            {isPaymentIssue 
              ? 'Betaling mislukt' 
              : isCanceled 
                ? 'Abonnement geannuleerd'
                : 'Je trial is verlopen'}
          </CardTitle>
          <CardDescription className="text-base mt-2">
            {isPaymentIssue 
              ? 'Je laatste betaling kon niet worden verwerkt. Update je betaalmethode om door te gaan met verkopen.'
              : isCanceled
                ? 'Je abonnement is geannuleerd. Kies een plan om weer toegang te krijgen.'
                : `Je 14-dagen ${planName} trial is afgelopen. Kies een plan om door te gaan met verkopen.`}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Payment issue: show manage subscription button prominently */}
          {isPaymentIssue && (
            <div className="flex justify-center">
              <Button size="lg" onClick={handleManageSubscription}>
                <CreditCard className="h-4 w-4 mr-2" />
                Betaalmethode bijwerken
              </Button>
            </div>
          )}

          {/* Plan Options */}
          {!isPaymentIssue && (
            <div className="grid gap-4 md:grid-cols-3">
              {paidPlans.map((plan) => (
                <Card 
                  key={plan.id}
                  className={cn(
                    'cursor-pointer transition-all hover:border-primary',
                    plan.highlighted && 'border-primary ring-1 ring-primary'
                  )}
                  onClick={() => handleUpgrade(plan.id)}
                >
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {plan.highlighted && <Sparkles className="h-4 w-4 text-primary" />}
                      {plan.name}
                    </CardTitle>
                    <CardDescription>
                      <span className="text-xl font-bold text-foreground">
                        {formatCurrency(plan.monthly_price)}
                      </span>
                      <span className="text-muted-foreground">/maand</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <Button 
                      className="w-full" 
                      variant={plan.highlighted ? 'default' : 'outline'}
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      Kiezen
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Features reminder */}
          <div className="bg-muted/50 rounded-lg p-4 text-center text-sm text-muted-foreground">
            <p>
              ✓ Behoud al je producten en klantgegevens &nbsp;&nbsp;
              ✓ Direct actief na betaling &nbsp;&nbsp;
              ✓ Maandelijks opzegbaar
            </p>
          </div>

          {/* Logout option */}
          <div className="flex justify-center pt-2">
            <Button 
              variant="ghost" 
              onClick={handleLogout}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Uitloggen
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
