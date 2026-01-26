import { useState, useEffect } from 'react';
import { Rocket, CheckCircle2, Play, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface OnboardingStatus {
  isCompleted: boolean;
  wasSkipped: boolean;
  currentStep: number;
  skippedAt: string | null;
}

interface OnboardingStatusCardProps {
  onRestart: () => void;
  onResume: () => void;
}

const TOTAL_STEPS = 6;

export function OnboardingStatusCard({ onRestart, onResume }: OnboardingStatusCardProps) {
  const { user } = useAuth();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed, onboarding_step, onboarding_skipped_at')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        setStatus({
          isCompleted: profile.onboarding_completed || false,
          wasSkipped: !!profile.onboarding_skipped_at,
          currentStep: profile.onboarding_step || 1,
          skippedAt: profile.onboarding_skipped_at,
        });
      }
      setIsLoading(false);
    };

    fetchStatus();
  }, [user]);

  if (isLoading || !status) {
    return null;
  }

  const getStatusText = () => {
    if (status.isCompleted) {
      return 'Voltooid';
    }
    if (status.wasSkipped) {
      return `Overgeslagen op stap ${status.currentStep} van ${TOTAL_STEPS}`;
    }
    return `Stap ${status.currentStep} van ${TOTAL_STEPS}`;
  };

  const getDescription = () => {
    if (status.isCompleted) {
      return 'Je hebt de setup wizard succesvol afgerond! Je kunt deze opnieuw doorlopen als je wilt.';
    }
    if (status.wasSkipped) {
      return 'Je hebt de setup wizard eerder overgeslagen. Je kunt deze op elk moment hervatten of opnieuw beginnen.';
    }
    return 'De setup wizard is nog niet afgerond. Je kunt deze hervatten of opnieuw beginnen.';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            {status.isCompleted ? (
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            ) : (
              <Rocket className="h-6 w-6 text-primary" />
            )}
          </div>
          <div>
            <CardTitle>Setup Wizard</CardTitle>
            <CardDescription>
              Status: {getStatusText()}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {getDescription()}
        </p>
        
        <div className="flex flex-wrap gap-3">
          {/* Resume button - only show if skipped or in progress (not completed) */}
          {!status.isCompleted && (status.wasSkipped || status.currentStep > 1) && (
            <Button onClick={onResume} variant="default">
              <Play className="h-4 w-4 mr-2" />
              Wizard hervatten
            </Button>
          )}
          
          {/* Restart button with confirmation */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant={status.isCompleted ? 'default' : 'outline'}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Opnieuw beginnen
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Wizard opnieuw starten?</AlertDialogTitle>
                <AlertDialogDescription>
                  Je gaat de setup wizard opnieuw doorlopen vanaf het begin.
                  Je bestaande winkel en producten blijven behouden.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuleren</AlertDialogCancel>
                <AlertDialogAction onClick={onRestart}>
                  Ja, opnieuw starten
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
