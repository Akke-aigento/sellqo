// MEDIA-1 (16-10-2026) — melding + knop om externe foto's naar eigen opslag te halen.
// Verschijnt alleen als de winkel foto's gebruikt die niet in onze eigen storage staan.

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CloudDownload, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useTenant } from '@/hooks/useTenant';
import { useExternalImageImport, type ExternalImportResult } from '@/hooks/useExternalImageImport';

export function ExternalImagesBanner() {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const { scan, run, running, progress } = useExternalImageImport();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<ExternalImportResult | null>(null);

  const { data } = useQuery({
    queryKey: ['external-images', currentTenant?.id],
    queryFn: scan,
    enabled: !!currentTenant?.id,
    staleTime: 60_000,
  });

  const count = data?.urls.length ?? 0;
  if (!running && count === 0 && !result?.failed.length) return null;

  const start = async () => {
    setConfirmOpen(false);
    setResult(null);
    const res = await run(data?.urls ?? []);
    setResult(res);
    queryClient.invalidateQueries({ queryKey: ['external-images'] });
    if (res.moved > 0) toast.success(t('admin.marketing.mediaAssetsLibrary.external.done', { count: res.moved }));
    if (res.failed.length > 0) toast.error(t('admin.marketing.mediaAssetsLibrary.external.failed', { count: res.failed.length }));
  };

  return (
    <>
      <Alert className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>{t('admin.marketing.mediaAssetsLibrary.external.title', { count })}</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>{t('admin.marketing.mediaAssetsLibrary.external.description', { hosts: (data?.hosts || []).join(', ') })}</p>
          {running ? (
            <div className="space-y-1.5">
              <Progress value={progress.total ? (progress.done / progress.total) * 100 : 0} />
              <p className="text-xs tabular-nums">
                {t('admin.marketing.mediaAssetsLibrary.external.running', { done: progress.done, total: progress.total })}
              </p>
            </div>
          ) : count > 0 ? (
            <Button size="sm" onClick={() => setConfirmOpen(true)} className="gap-1.5">
              <CloudDownload className="h-4 w-4" />
              {t('admin.marketing.mediaAssetsLibrary.external.button')}
            </Button>
          ) : null}
          {result && result.failed.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer">
                {t('admin.marketing.mediaAssetsLibrary.external.failed', { count: result.failed.length })}
              </summary>
              <ul className="mt-1 space-y-0.5 break-all">
                {result.failed.map((f) => (
                  <li key={f.url}>{f.url} — {f.reason}</li>
                ))}
              </ul>
            </details>
          )}
        </AlertDescription>
      </Alert>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.marketing.mediaAssetsLibrary.external.confirm_title', { count })}</AlertDialogTitle>
            <AlertDialogDescription>{t('admin.marketing.mediaAssetsLibrary.external.confirm_body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={start}>
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : t('admin.marketing.mediaAssetsLibrary.external.button')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
