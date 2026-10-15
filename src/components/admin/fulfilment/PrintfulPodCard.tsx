import { Package, CheckCircle, Clock, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { usePrintfulConnection } from '@/hooks/usePrintfulConnection';
import { useTenantPrintfulSettings } from '@/hooks/useTenantPrintfulSettings';
import { formatDistanceToNow } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';

interface Props {
  tenantId: string | undefined;
  onOpen: () => void;
}

export function PrintfulPodCard({ tenantId, onOpen }: Props) {
  const { t } = useTranslation();
  const dateLocale = useDateFnsLocale();
  const { status } = usePrintfulConnection(tenantId);
  const { settings } = useTenantPrintfulSettings(tenantId);

  const configured = !!status.data?.configured;
  const syncEnabled = !!settings?.printful_sync_enabled;
  const storeName = status.data?.connected_store_name;
  const lastTest = status.data?.last_test_at;

  return (
    <div className="bg-card border rounded-xl p-6 hover:shadow-lg transition-all duration-200">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center bg-rose-100')}>
            <Package className="w-6 h-6 text-rose-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">Printful</h3>
              <Badge variant="secondary" className="text-[10px]">{t('admin.printful.beta')}</Badge>
            </div>
            {configured ? (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle className="w-4 h-4" />
                {t('admin.printful.connected')}{storeName ? ` · ${storeName}` : ''}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">{t('admin.printful.not_connected')}</span>
            )}
          </div>
        </div>
        {configured && (
          <Button variant="ghost" size="icon" onClick={onOpen} aria-label={t('admin.printful.settings')}>
            <Settings className="w-5 h-5" />
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        {t('admin.printful.card_description')}
      </p>

      {configured && (
        <div className="rounded-lg p-3 mb-4 bg-rose-50">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">{t('admin.printful.sync')}</p>
              <p className="font-semibold">{syncEnabled ? t('admin.printful.on') : t('admin.printful.off')}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t('admin.printful.last_test')}</p>
              <p className="font-semibold">
                {lastTest ? formatDistanceToNow(new Date(lastTest), { addSuffix: true, locale: dateLocale }) : t('admin.printful.not_yet')}
              </p>
            </div>
          </div>
          {status.data?.webhook_registered && (
            <p className="text-xs text-muted-foreground mt-2">{t('admin.printful.shipping_updates_active')}</p>
          )}
        </div>
      )}

      <div className="flex gap-2">
        {configured ? (
          <Button variant="outline" className="flex-1" onClick={onOpen}>
            {t('admin.printful.settings')}
          </Button>
        ) : (
          <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={onOpen}>
            <Clock className="w-4 h-4 mr-2" />
            {t('admin.printful.connect')}
          </Button>
        )}
      </div>
    </div>
  );
}