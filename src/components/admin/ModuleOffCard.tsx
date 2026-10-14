// MODULES-1 — scherm van een sectormodule die (nog) niet aanstaat: uitleg + zelf aanzetten.
import { Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useBusinessModules, type BusinessModule } from '@/hooks/useBusinessModules';

export function ModuleOffCard({ module }: { module: BusinessModule }) {
  const { t } = useTranslation();
  const { setModule, saving } = useBusinessModules();
  const { userRole, isPlatformAdmin } = useAuth();
  const canSwitch = isPlatformAdmin || userRole === 'tenant_admin';
  const name = t(`admin.modules.${module}_title`);
  return (
    <div className="p-6">
      <Card className="mx-auto max-w-xl">
        <CardContent className="space-y-3 py-10 text-center">
          <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
          <h1 className="text-xl font-semibold">{name}</h1>
          <p className="text-sm text-muted-foreground">{t(`admin.modules.${module}_desc`)}</p>
          {canSwitch ? (
            <Button disabled={saving} onClick={async () => { if (await setModule(module, true)) toast.success(t('admin.modules.turned_on', { name })); }}>
              {t('admin.modules.turn_on', { name })}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">{t('admin.modules.ask_admin')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
