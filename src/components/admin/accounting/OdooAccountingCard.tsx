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
import { nl } from 'date-fns/locale';

interface Props {
  tenantId: string | undefined;
  onOpen: () => void;
}

export function OdooAccountingCard({ tenantId, onOpen }: Props) {
  const { checkFeature } = useUsageLimits();
  const hasAccess = checkFeature('odoo_sync');
  const { status } = useOdooConnection(tenantId);
  const { settings } = useTenantOdooSettings(tenantId);

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
              <Badge variant="secondary" className="text-[10px]">Pro / Enterprise</Badge>
            </div>
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Lock className="w-3.5 h-3.5" /> Beschikbaar op Pro of Enterprise
            </span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Automatische facturen- en creditnota-sync met jouw eigen Odoo Accounting. Upgrade om deze koppeling te activeren.
        </p>
        <Button asChild className="w-full">
          <Link to="/pricing">Bekijk abonnementen</Link>
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
              <Badge variant="secondary" className="text-[10px]">Boekhouding</Badge>
            </div>
            {configured ? (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle className="w-4 h-4" />
                Verbonden{version ? ` · v${version}` : ''}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">Niet verbonden</span>
            )}
          </div>
        </div>
        {configured && (
          <Button variant="ghost" size="icon" onClick={onOpen} aria-label="Instellingen">
            <Settings className="w-5 h-5" />
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Push facturen en creditnota's automatisch naar jouw eigen Odoo Accounting. Klanten (res.partner), BTW en dagboeken worden gemapt.
      </p>

      {configured && (
        <div className="rounded-lg p-3 mb-4 bg-violet-50">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Sync</p>
              <p className="font-semibold">{syncEnabled ? 'Aan' : 'Uit'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Laatste test</p>
              <p className="font-semibold">
                {lastTest ? formatDistanceToNow(new Date(lastTest), { addSuffix: true, locale: nl }) : 'Nog niet'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {configured ? (
          <Button variant="outline" className="flex-1" onClick={onOpen}>
            Instellingen
          </Button>
        ) : (
          <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={onOpen}>
            <Clock className="w-4 h-4 mr-2" />
            Verbind Odoo
          </Button>
        )}
      </div>
    </div>
  );
}
