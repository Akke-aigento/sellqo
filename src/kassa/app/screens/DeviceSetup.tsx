// PERSONEEL-1 — eenmalig per toestel: welke zaak en welke kassa (pos_terminals) is dit.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Monitor } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { saveDevice, type DeviceConfig } from '../runtime';

interface TerminalRow { id: string; name: string; location_name: string | null; status: string }

export function DeviceSetup({ onDone }: { onDone: (d: DeviceConfig) => void }) {
  const { t } = useTranslation();
  const { currentTenant, tenants, setCurrentTenant, loading } = useTenant();
  const [terminals, setTerminals] = useState<TerminalRow[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!currentTenant) return;
    let alive = true;
    setTerminals(null);
    (async () => {
      const { data, error: e } = await supabase.from('pos_terminals').select('id, name, location_name, status').eq('tenant_id', currentTenant.id).order('name');
      if (!alive) return;
      if (e) setError(true); else setTerminals((data ?? []) as TerminalRow[]);
    })();
    return () => { alive = false; };
  }, [currentTenant]);

  if (!loading && !currentTenant) return <p className="p-6 text-center">{t('kassa.setup.noBusiness')}</p>;
  if (!currentTenant) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" aria-label={t('kassa.common.loading')} /></div>;

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 p-4">
      <h1 className="text-xl font-bold">{t('kassa.setup.title')}</h1>
      <p className="text-sm text-muted-foreground">{t('kassa.setup.intro')}</p>
      {tenants.length > 1 && (
        <label className="block space-y-1 text-sm">
          <span className="font-medium">{t('kassa.setup.business')}</span>
          <select className="h-11 w-full rounded-md border bg-background px-3" value={currentTenant.id}
            onChange={(e) => setCurrentTenant(tenants.find((x) => x.id === e.target.value) ?? null)}>
            {tenants.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{t('kassa.setup.loadError')}</p>}
      {!terminals && !error && <Loader2 className="h-5 w-5 animate-spin" aria-label={t('kassa.common.loading')} />}
      {terminals && !terminals.length && <p className="text-sm">{t('kassa.setup.noTerminals')}</p>}
      <div className="grid gap-3">
        {terminals?.filter((x) => x.status !== 'inactive').map((x) => (
          <button key={x.id} type="button" onClick={() => onDone(saveDevice(currentTenant.id, x.id))}
            className="flex min-h-16 items-center gap-3 rounded-xl border bg-card p-4 text-left active:bg-muted">
            <Monitor className="h-6 w-6 shrink-0 text-primary" />
            <span>
              <span className="block font-semibold">{x.name}</span>
              {x.location_name && <span className="block text-sm text-muted-foreground">{x.location_name}</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
