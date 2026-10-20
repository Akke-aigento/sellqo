import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      return t('settings.onboardingStatus.completed');
    }
    if (status.wasSkipped) {
      return t('settings.onboardingStatus.skippedAtStep', { step: status.currentStep, total: TOTAL_STEPS });
    }
    return t('settings.onboardingStatus.stepOf', { step: status.currentStep, total: TOTAL_STEPS });
  };

  const getDescription = () => {
    if (status.isCompleted) {
      return t('settings.onboardingStatus.descCompleted');
    }
    if (status.wasSkipped) {
      return t('settings.onboardingStatus.descSkipped');
    }
    return t('settings.onboardingStatus.descInProgress');
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
            <CardTitle>{t('settings.onboardingStatus.title')}</CardTitle>
            <CardDescription>
              {t('settings.onboardingStatus.statusLabel', { status: getStatusText() })}
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
              {t('settings.onboardingStatus.resume')}
            </Button>
          )}
          
          {/* Restart button with confirmation */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant={status.isCompleted ? 'default' : 'outline'}>
                <RotateCcw className="h-4 w-4 mr-2" />
                {t('settings.onboardingStatus.restart')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('settings.onboardingStatus.restartTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('settings.onboardingStatus.restartBody')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={onRestart}>
                  {t('settings.onboardingStatus.restartConfirm')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
