// HORECA-ZIJBALK-1 — "Zaal": het live zaaloverzicht (standaard) en het zaalplan bewerken (?tab=bewerken).
// Vroeger opende "Zaal" in de zijbalk meteen de editor (/admin/bestellen?tab=zaal); die link stuurt
// nu hierheen door. Alleen met de horeca-module.
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FloorPlanEditor } from '@/components/admin/floorplan/FloorPlanEditor';
import { LiveFloorOverview } from '@/components/admin/horeca/LiveFloorOverview';
import { ModuleGateLoading, ModuleOffCard } from '@/components/admin/ModuleOffCard';
import { useHorecaModule } from '@/hooks/useHorecaModule';
import { useTracks } from '@/hooks/useBusinessModules';

const TABS = [
  { id: 'live', labelKey: 'admin.liveFloor.tab_live' },
  { id: 'bewerken', labelKey: 'admin.liveFloor.tab_edit' },
] as const;
type Tab = (typeof TABS)[number]['id'];
const DEFAULT_TAB: Tab = 'live';

export default function FloorPage() {
  const { t } = useTranslation();
  const horeca = useHorecaModule();
  const { ready } = useTracks();
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const tab: Tab = TABS.some((x) => x.id === raw) ? (raw as Tab) : DEFAULT_TAB;
  const go = (next: Tab) => setParams((p) => { const n = new URLSearchParams(p); if (next === DEFAULT_TAB) n.delete('tab'); else n.set('tab', next); return n; }, { replace: true });

  if (!ready) return <ModuleGateLoading />;
  if (!horeca) return <ModuleOffCard module="horeca" />;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl"><LayoutGrid className="h-7 w-7 text-primary sm:h-8 sm:w-8" />{t('navigation.items.floor')}</h1>
        <p className="mt-1 text-muted-foreground">{t('admin.liveFloor.intro')}</p>
      </div>
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b">
        {TABS.map((x) => (
          <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} onClick={() => go(x.id)}
            className={cn('whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium', tab === x.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {t(x.labelKey)}
          </button>
        ))}
      </div>
      <div className="max-w-5xl">
        {tab === 'live' ? <LiveFloorOverview onEditPlan={() => go('bewerken')} /> : <FloorPlanEditor />}
      </div>
    </div>
  );
}
