// MODULES-1 → TRACKS-1 — scherm voor een onderdeel dat niet in het pakket van de winkel zit.
// Add-ons zijn betalend: de winkel ziet uitleg en een link naar de pakketten; alleen een
// platformadmin kan het hier meteen aanzetten (de database weigert het voor anderen).
import { Link } from 'react-router-dom';
import { Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useCan } from '@/hooks/useCan';
import { useBusinessModules, type BusinessModule } from '@/hooks/useBusinessModules';

export function ModuleOffCard({ module }: { module: BusinessModule }) {
  const { t } = useTranslation();
  const { setModule, saving } = useBusinessModules();
  const { isPlatformAdmin } = useAuth();
  const canSeePlans = useCan('read', 'platform_billing');
  const name = t(`admin.modules.${module}_title`);
  return (
    <div className="p-6">
      <Card className="mx-auto max-w-xl">
        <CardContent className="space-y-3 py-10 text-center">
          <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
          <h1 className="text-xl font-semibold">{name}</h1>
          <p className="text-sm font-medium">{t('admin.modules.not_in_plan')}</p>
          <p className="text-sm text-muted-foreground">{t(`admin.modules.${module}_desc`)}</p>
          {isPlatformAdmin ? (
            <Button disabled={saving} onClick={async () => { if (await setModule(module, true)) toast.success(t('admin.modules.turned_on', { name })); }}>
              {t('admin.modules.turn_on', { name })}
            </Button>
          ) : canSeePlans ? (
            <Button asChild>
              <Link to="/admin/billing">{t('admin.modules.see_plans')}</Link>
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
