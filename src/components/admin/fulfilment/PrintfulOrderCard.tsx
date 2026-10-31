import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Ban, Loader2, Package, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { usePrintfulConnection } from '@/hooks/usePrintfulConnection';
import { useTenantPrintfulSettings } from '@/hooks/useTenantPrintfulSettings';
import { PrintfulActionError, usePrintfulOrderLink } from '@/hooks/usePrintfulOrderLink';

interface Props {
  tenantId: string;
  orderId: string;
}

export function PrintfulOrderCard({ tenantId, orderId }: Props) {
  const { t } = useTranslation();
  const { roles, isPlatformAdmin } = useAuth();
  const { status } = usePrintfulConnection(tenantId);
  const { settings } = useTenantPrintfulSettings(tenantId);
  const { link, forward, cancel } = usePrintfulOrderLink(tenantId, orderId);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const isAdmin = isPlatformAdmin || roles.some((r) => r.tenant_id === tenantId && r.role === 'tenant_admin');
  const canForward = isAdmin || roles.some((r) => r.tenant_id === tenantId && r.role === 'staff');

  if (!canForward) return null;
  if (!status.data?.configured || !settings?.printful_sync_enabled) return null;

  const st = link?.status;
  const failed = st === 'failed';
  // PRINTFUL-AUTO-1/2: tijdens een automatische forward of annulering en na bevestiging geen
  // doorstuurknop (de server weigert dan ook) — opnieuw sturen kan Printful laten dubbel produceren.
  const busy = st === 'queued' || st === 'forwarding';
  const locked = busy || st === 'canceling' || st === 'confirmed' || st === 'cancel_failed' || st === 'canceled';
  const canCancel = isAdmin && (st === 'confirmed' || st === 'draft' || st === 'cancel_failed');
  // Gemengde bestelling: de server antwoordt met code mixed_order; dan bieden we de
  // gedeeltelijke forward aan in plaats van een foutmelding.
  const mixed = forward.error instanceof PrintfulActionError && forward.error.code === 'mixed_order';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="w-4 h-4" /> Printful
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {!link && <Badge variant="outline">{t('admin.printful.order.not_forwarded')}</Badge>}
          {busy && <Badge variant="secondary">{t('admin.printful.order.queued')}</Badge>}
          {st === 'draft' && <Badge variant="secondary">{t('admin.printful.order.draft')}</Badge>}
          {st === 'confirmed' && <Badge>{t('admin.printful.order.confirmed')}</Badge>}
          {st === 'canceling' && <Badge variant="secondary">{t('admin.printful.order.canceling')}</Badge>}
          {st === 'canceled' && <Badge variant="outline">{t('admin.printful.order.canceled')}</Badge>}
          {st === 'cancel_failed' && <Badge variant="destructive">{t('admin.printful.order.cancel_failed')}</Badge>}
          {failed && <Badge variant="destructive">{t('admin.printful.order.failed')}</Badge>}
          {link?.printful_order_id && (
            <span className="text-xs text-muted-foreground">#{link.printful_order_id}</span>
          )}
        </div>

        {link?.last_error && (
          <p className={`text-xs break-words ${failed || st === 'cancel_failed' ? 'text-destructive' : 'text-muted-foreground'}`}>
            {link.last_error}
          </p>
        )}

        {mixed && (
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-xs">{forward.error?.message}</p>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={forward.isPending}
              onClick={() => forward.mutate({ partial: true })}
            >
              {forward.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('admin.printful.order.forward_partial')}
            </Button>
          </div>
        )}

        {!locked && (
          <Button
            size="sm"
            variant={failed ? 'outline' : 'default'}
            onClick={() => forward.mutate({})}
            disabled={forward.isPending}
            className="w-full"
          >
            {forward.isPending
              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              : failed
                ? <RefreshCw className="w-4 h-4 mr-2" />
                : <Package className="w-4 h-4 mr-2" />}
            {failed ? t('admin.printful.order.retry') : link ? t('admin.printful.order.forward_again') : t('admin.printful.order.forward')}
          </Button>
        )}

        {canCancel && (
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            disabled={cancel.isPending}
            onClick={() => setConfirmCancel(true)}
          >
            {cancel.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Ban className="w-4 h-4 mr-2" />}
            {t('admin.printful.order.cancel')}
          </Button>
        )}
      </CardContent>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.printful.order.cancel_confirm_title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('admin.printful.order.cancel_confirm_description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('admin.printful.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => cancel.mutate()}>{t('admin.printful.order.cancel')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
