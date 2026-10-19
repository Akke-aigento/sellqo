import { useQuery } from '@tanstack/react-query';
import { AlertCircle, FlaskConical, Loader2, Send } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { countCampaignRecipients } from '@/hooks/useEmailCampaigns';
import { useTranslation } from 'react-i18next';

interface SendCampaignConfirmDialogProps {
  /** Campagne die verstuurd wordt; null = dialoog dicht. */
  campaignId: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (campaignId: string) => void;
  isSending: boolean;
}

/**
 * MAIL-1a: bevestiging vóór "nu verzenden". Vraagt eerst de server hoeveel
 * ontvangers de campagne heeft, toont het planverbruik en blokkeert het
 * verzenden als er geen geldige afzender is of de planlimiet niet volstaat.
 */
export function SendCampaignConfirmDialog({ campaignId, onOpenChange, onConfirm, isSending }: SendCampaignConfirmDialogProps) {
  const { t } = useTranslation();
  const open = !!campaignId;

  const { data, isLoading, error } = useQuery({
    queryKey: ['campaign-recipient-count', campaignId],
    queryFn: () => countCampaignRecipients(campaignId as string),
    enabled: open,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  const limit = data?.limit;
  const overLimit = !!data && limit?.remaining != null && data.recipients > limit.remaining;
  const noSender = !!data && !data.sender_ok;
  const noRecipients = !!data && data.recipients === 0;
  const blocked = !data || noSender || overLimit || noRecipients;

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!isSending) onOpenChange(o); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('admin.campaignDetail.confirm_send_title')}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              {isLoading ? (
                <p className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('admin.marketing.sendConfirm.ontvangers_tellen')}
                </p>
              ) : error ? (
                <p className="text-destructive">{(error as Error).message}</p>
              ) : data ? (
                <>
                  <p className="text-foreground font-medium">
                    {t('admin.marketing.sendConfirm.gaat_naar_ontvangers', { count: data.recipients })}
                  </p>
                  {limit?.monthly != null && (
                    <p>
                      {t('admin.marketing.sendConfirm.planverbruik', { used: limit.used, monthly: limit.monthly })}
                    </p>
                  )}
                  {noSender && (
                    <p className="flex items-start gap-2 text-destructive">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      {t('admin.marketing.sendConfirm.geen_afzender')}
                    </p>
                  )}
                  {overLimit && (
                    <p className="flex items-start gap-2 text-destructive">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      {t('admin.marketing.sendConfirm.boven_limiet', { remaining: limit?.remaining ?? 0 })}
                    </p>
                  )}
                  {data.ab?.requested && !noRecipients && (
                    // MAIL-2d: hoe de A/B-test verloopt, of waarom hij niet doorgaat.
                    <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-2.5 text-sm">
                      <FlaskConical className="h-4 w-4 mt-0.5 shrink-0" />
                      <div className="space-y-1">
                        {data.ab.enabled ? (
                          <>
                            <p className="font-medium text-foreground">{t('admin.marketing.abTest.confirm_title')}</p>
                            <p>{t('admin.marketing.abTest.confirm_flow', {
                              perVariant: data.ab.per_variant,
                              hours: data.ab.wait_hours,
                              remainder: data.ab.remainder,
                            })}</p>
                            <p className="text-xs">{t('admin.marketing.abTest.confirm_limit', { recipients: data.recipients })}</p>
                          </>
                        ) : data.ab.reason === 'too_small' ? (
                          <p>{t('admin.marketing.abTest.too_small', { min: data.ab.min_audience, percent: data.ab.percent })}</p>
                        ) : (
                          <p>{t('admin.marketing.abTest.not_possible_multi')}</p>
                        )}
                      </div>
                    </div>
                  )}
                  {noRecipients && (
                    <p className="flex items-start gap-2 text-destructive">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      {t('admin.marketing.sendConfirm.geen_ontvangers')}
                    </p>
                  )}
                </>
              ) : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSending}>{t('common.cancel')}</AlertDialogCancel>
          <Button
            onClick={() => { if (campaignId && !blocked && !isSending) onConfirm(campaignId); }}
            disabled={blocked || isSending}
          >
            {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {t('admin.inbox.composeDialog.verzenden')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
