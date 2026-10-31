// MODULES-1 → TRACKS-1 → ADDON-SELF-1 — scherm voor een onderdeel dat niet in het pakket zit.
// Add-ons zijn betalend: wie het pakket beheert (zaakvoerder of platformadmin) gaat naar
// Instellingen › Je pakket, waar de prijs vooraf staat en betalen vóór aanzetten komt. Nooit
// meer rechtstreeks aanzetten vanaf hier (dat sloeg de prijs en de bevestiging over).
import { Link } from 'react-router-dom';
import { Loader2, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTenant } from '@/hooks/useTenant';
import type { BusinessModule } from '@/hooks/useBusinessModules';
import { useCanManagePackage } from '@/hooks/useTenantPackage';

export function ModuleOffCard({ module }: { module: BusinessModule }) {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const canManage = useCanManagePackage(currentTenant?.id);
  const name = t(`admin.modules.${module}_title`);
  return (
    <div className="p-6">
      <Card className="mx-auto max-w-xl">
        <CardContent className="space-y-3 py-10 text-center">
          <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
          <h1 className="text-xl font-semibold">{name}</h1>
          <p className="text-sm font-medium">{t('admin.modules.not_in_plan')}</p>
          <p className="text-sm text-muted-foreground">{t(`admin.modules.${module}_desc`)}</p>
          {canManage ? (
            <Button asChild>
              <Link to="/admin/settings?section=modules">{t('admin.modules.see_price', { name })}</Link>
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">{t('admin.modules.ask_admin')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** WANDELING: zolang winkel en pakket laden, een spinner in plaats van "Niet in je pakket". */
export function ModuleGateLoading() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
