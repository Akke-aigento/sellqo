// PERSONEEL-1 — eenmalig per toestel: welke zaak en welke kassa (pos_terminals) is dit.
// KASSA-START-1 — nog geen kassa: de zaakvoerder (tenant_admin, zelfde regel als de RLS op pos_terminals)
// maakt er hier meteen een aan en dit toestel hangt er dan aan. Wie dat niet mag, leest wie het wel kan.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Monitor, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { canCreateTerminal } from '../setup';
import { saveDevice, type DeviceConfig } from '../runtime';

interface TerminalRow { id: string; name: string; location_name: string | null; status: string }

export function DeviceSetup({ onDone }: { onDone: (d: DeviceConfig) => void }) {
  const { t } = useTranslation();
  const { currentTenant, tenants, setCurrentTenant, loading } = useTenant();
  const [terminals, setTerminals] = useState<TerminalRow[] | null>(null);
  const [error, setError] = useState(false);
  const { roles, isPlatformAdmin } = useAuth();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const canCreate = !!currentTenant && canCreateTerminal(roles, currentTenant.id, isPlatformAdmin);

  const create = async () => {
    if (!currentTenant || creating) return;
    setCreating(true); setCreateError(null);
    const { data, error: e } = await supabase.from('pos_terminals')
      .insert({ tenant_id: currentTenant.id, name: name.trim() || t('kassa.setup.defaultName'), status: 'active',
        capabilities: { printer: false, scanner: false, cash_drawer: false }, settings: {} })
      .select('id').single();
    setCreating(false);
    if (e || !data) { setCreateError(e?.message ?? '?'); return; }
    onDone(saveDevice(currentTenant.id, (data as { id: string }).id));
  };

  useEffect(() => {
    if (!currentTenant) return;
    let alive = true;
    setTerminals(null);
    (async () => {
      const { data, error: e } = await supabase.from('pos_terminals').select('id, name, location_name, status').eq('tenant_id', currentTenant.id)
        // REKENING-ONLINE-1: de kassa "Online (QR)" is geen toestel.
        .is('settings->>virtual' as never, null).order('name');
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
      {terminals && !terminals.length && !canCreate && <p className="text-sm">{t('kassa.setup.noTerminals')}</p>}
      {terminals && !terminals.length && canCreate && (
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <p className="text-sm">{t('kassa.setup.noTerminalsAdmin')}</p>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">{t('kassa.setup.newName')}</span>
            <input className="h-11 w-full rounded-md border bg-background px-3" value={name} maxLength={60}
              placeholder={t('kassa.setup.defaultName')} onChange={(e) => setName(e.target.value)} />
          </label>
          {createError && <p role="alert" className="text-sm text-destructive">{t('kassa.setup.createFailed', { reason: createError })}</p>}
          <button type="button" onClick={create} disabled={creating}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-60">
            {creating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}{t('kassa.setup.create')}
          </button>
        </div>
      )}
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
