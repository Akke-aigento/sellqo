import { Building2, CheckCircle, Clock, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useOdooConnection } from '@/hooks/useOdooConnection';
import { useTenantOdooSettings } from '@/hooks/useTenantOdooSettings';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';
import { useTracks } from '@/hooks/useBusinessModules';

interface Props {
  tenantId: string | undefined;
  onOpen: () => void;
}

export function OdooAccountingCard({ tenantId, onOpen }: Props) {
  const { checkFeature } = useUsageLimits();
  const hasAccess = checkFeature('odoo_sync');
  const { status } = useOdooConnection(tenantId);
  const { settings } = useTenantOdooSettings(tenantId);
  const { t } = useTranslation();
  const dateLocale = useDateFnsLocale();
  // ODOO-HORECA-1: de upgrade blijft in het eigen spoor. Een horecaplan krijgt Odoo met Horeca Big
  // (pricing_plans.features.odoo_sync); webshop- en eventsplannen met Pro of Enterprise.
  const { planTrack } = useTracks();
  const horecaPlan = t('landing.pricing.name_horeca_big');
  const lockedBadge = planTrack === 'horeca' ? horecaPlan : t('admin.odooCard.locked_badge_webshop');
  const lockedText = planTrack === 'horeca'
    ? t('admin.odooCard.locked_horeca', { plan: horecaPlan })
    : t('admin.odooCard.locked_webshop');

  if (!hasAccess) {
    return (
      <div className="bg-card border rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-violet-100">
            <Building2 className="w-6 h-6 text-violet-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">Odoo</h3>
              <Badge variant="secondary" className="text-[10px]">{lockedBadge}</Badge>
            </div>
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Lock className="w-3.5 h-3.5" /> {lockedText}
            </span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {t('admin.odooCard.locked_description')}
        </p>
        <Button asChild className="w-full">
          <Link to="/pricing">{t('admin.odooCard.locked_cta')}</Link>
        </Button>
      </div>
    );
  }

  const configured = !!status.data?.configured;
  const syncEnabled = !!settings?.odoo_sync_enabled;
  const version = status.data?.connected_version;
  const lastTest = status.data?.last_test_at;

  return (
    <div className="bg-card border rounded-xl p-6 hover:shadow-lg transition-all duration-200">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center bg-violet-100')}>
            <Building2 className="w-6 h-6 text-violet-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">Odoo</h3>
              <Badge variant="secondary" className="text-[10px]">{t('admin.odooCard.badge')}</Badge>
            </div>
            {configured ? (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle className="w-4 h-4" />
                {t('admin.odooCard.connected')}{version ? ` · v${version}` : ''}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">{t('admin.odooCard.not_connected')}</span>
            )}
          </div>
        </div>
        {configured && (
          <Button variant="ghost" size="icon" onClick={onOpen} aria-label={t('admin.odooCard.settings')}>
            <Settings className="w-5 h-5" />
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        {t('admin.odooCard.description')}
      </p>

      {configured && (
        <div className="rounded-lg p-3 mb-4 bg-violet-50">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">{t('admin.odooCard.sync')}</p>
              <p className="font-semibold">{syncEnabled ? t('admin.odooCard.sync_on') : t('admin.odooCard.sync_off')}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t('admin.odooCard.last_test')}</p>
              <p className="font-semibold">
                {lastTest ? formatDistanceToNow(new Date(lastTest), { addSuffix: true, locale: dateLocale }) : t('admin.odooCard.never_tested')}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {configured ? (
          <Button variant="outline" className="flex-1" onClick={onOpen}>
            {t('admin.odooCard.settings')}
          </Button>
        ) : (
          <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={onOpen}>
            <Clock className="w-4 h-4 mr-2" />
            {t('admin.odooCard.connect')}
          </Button>
        )}
      </div>
    </div>
  );
}
