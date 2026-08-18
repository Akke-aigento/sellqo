import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, AlertTriangle, Loader2, CheckCircle2, XCircle, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTenant } from '@/hooks/useTenant';

interface FailedAccount {
  tenant_id: string;
  tenant_name: string;
  error: string;
}

interface CleanupResult {
  success: boolean;
  cleaned: number;
  failed: FailedAccount[];
}

export function PlatformToolsSettings() {
  const { t } = useTranslation();
  const [confirmText, setConfirmText] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<CleanupResult | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { currentTenant } = useTenant();

  const handleTestTrialBlocker = () => {
    try {
      // Wis dismiss-flag voor alle tenants in deze sessie
      const keys: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith('trial_blocker_dismissed_')) keys.push(k);
      }
      keys.forEach((k) => sessionStorage.removeItem(k));
    } catch {}
    toast.success(t('settings.platformTools.trialResetDone'));
    setTimeout(() => window.location.reload(), 600);
  };

  const handleCleanup = async () => {
    setIsRunning(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('cleanup-connected-accounts');
      if (error) throw error;
      setResult(data as CleanupResult);
      toast.success(`${data.cleaned} accounts opgeruimd`);
    } catch (err: any) {
      toast.error('Cleanup mislukt: ' + (err.message || 'Onbekende fout'));
    } finally {
      setIsRunning(false);
      setConfirmText('');
      setDialogOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {t('settings.platformTools.stripeResetTitle')}
          </CardTitle>
          <CardDescription>
            {t('settings.platformTools.stripeResetBody')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AlertDialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setConfirmText(''); }}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={isRunning}>
                {isRunning ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> {t('settings.platformTools.busy')}</>
                ) : (
                  <><Trash2 className="h-4 w-4" /> {t('settings.platformTools.stripeResetAction')}</>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-destructive">
                  {t('settings.platformTools.stripeResetConfirmTitle')}
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-3">
                  <p>
                    Dit verwijdert <strong>ALLE</strong> connected Stripe accounts van alle tenants.
                    {t('settings.platformTools.stripeResetConfirmBody')}
                  </p>
                  <p className="font-semibold">
                    Typ <code className="bg-muted px-1.5 py-0.5 rounded text-destructive font-bold">RESET</code> om te bevestigen:
                  </p>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={t('settings.platformTools.typeReset')}
                    className="font-mono"
                  />
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  disabled={confirmText !== 'RESET' || isRunning}
                  onClick={(e) => { e.preventDefault(); handleCleanup(); }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Definitief verwijderen'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {result && (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>{result.cleaned} accounts opgeruimd</span>
              </div>
              {result.failed.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                    <XCircle className="h-4 w-4" />
                    <span>{result.failed.length} gefaald</span>
                  </div>
                  <ul className="text-xs space-y-1 text-muted-foreground">
                    {result.failed.map((f) => (
                      <li key={f.tenant_id}>
                        <strong>{f.tenant_name}</strong>: {f.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5" />
            {t('settings.platformTools.trialTestTitle')}
          </CardTitle>
          <CardDescription>
            {t('settings.platformTools.trialTestBody')}
            {currentTenant?.name ? ` (huidige tenant: ${currentTenant.name})` : ''}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={handleTestTrialBlocker}>
            <FlaskConical className="h-4 w-4 mr-2" />
            {t('settings.platformTools.trialTestAction')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
