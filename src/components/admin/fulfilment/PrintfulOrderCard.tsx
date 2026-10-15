import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { usePrintfulConnection } from '@/hooks/usePrintfulConnection';
import { useTenantPrintfulSettings } from '@/hooks/useTenantPrintfulSettings';
import { usePrintfulOrderLink } from '@/hooks/usePrintfulOrderLink';

interface Props {
  tenantId: string;
  orderId: string;
}

export function PrintfulOrderCard({ tenantId, orderId }: Props) {
  const { t } = useTranslation();
  const { roles, isPlatformAdmin } = useAuth();
  const { status } = usePrintfulConnection(tenantId);
  const { settings } = useTenantPrintfulSettings(tenantId);
  const { link, forward } = usePrintfulOrderLink(tenantId, orderId);

  const canForward = isPlatformAdmin || roles.some(
    (r) => r.tenant_id === tenantId && (r.role === 'tenant_admin' || r.role === 'staff'),
  );

  if (!canForward) return null;
  if (!status.data?.configured || !settings?.printful_sync_enabled) return null;

  const failed = link?.status === 'failed';

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
          {link?.status === 'draft' && <Badge variant="secondary">{t('admin.printful.order.draft')}</Badge>}
          {link?.status === 'confirmed' && <Badge>{t('admin.printful.order.confirmed')}</Badge>}
          {link?.status === 'canceled' && <Badge variant="outline">{t('admin.printful.order.canceled')}</Badge>}
          {failed && <Badge variant="destructive">{t('admin.printful.order.failed')}</Badge>}
          {link?.printful_order_id && (
            <span className="text-xs text-muted-foreground">#{link.printful_order_id}</span>
          )}
        </div>

        {failed && link?.last_error && (
          <p className="text-xs text-destructive break-words">{link.last_error}</p>
        )}

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
      </CardContent>
    </Card>
  );
}
