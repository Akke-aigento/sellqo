// HORECA-INSTELLINGEN-1 — "Personeel" (horeca): wie werkt hier, op één plek. Vroeger stond dit op twee
// plekken (Kassa › Personeel en Instellingen › Teamleden). Tabs bovenaan, deeplinkbaar (?tab=pin|uren|beheerders).
// Rechten zoals ze waren: kassapersoneel en uren met het kassarecht (route: pos), beheerders enkel de zaakvoerder.
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { KassaStaffTab } from '@/components/admin/pos/KassaStaffTab';
import { KassaHoursCard } from '@/components/admin/pos/KassaHoursCard';
import { TeamSettings } from '@/components/admin/settings/TeamSettings';
import { ModuleGateLoading, ModuleOffCard } from '@/components/admin/ModuleOffCard';
import { useHorecaModule } from '@/hooks/useHorecaModule';
import { useTracks } from '@/hooks/useBusinessModules';
import { useZaakAccess } from '@/hooks/useZaakAccess';
import { STAFF_TABS, legacyStaffTarget, mijnZaakUrl } from '@/lib/mijnZaak';
import { isHorecaOnly } from '@/lib/tracks';

export default function StaffPage() {
  const { t } = useTranslation();
  const horeca = useHorecaModule();
  const { ready, hasTrack } = useTracks();
  const canOpen = useZaakAccess();
  const [params, setParams] = useSearchParams();
  const tabs = STAFF_TABS.filter((tb) => canOpen(tb));
  const tab = tabs.find((tb) => tb.id === params.get('tab')) ?? tabs[0];
  const go = (id: string) => setParams((p) => { const n = new URLSearchParams(p); if (id === 'pin') n.delete('tab'); else n.set('tab', id); return n; }, { replace: true });

  if (!ready) return <ModuleGateLoading />;
  if (!horeca) return <ModuleOffCard module="horeca" />;
  // 1b: combinaties met webshop of events houden Kassabeheer › Personeel en Instellingen › Teamleden;
  // een rechtstreekse URL hierheen gaat daar naartoe (pas na `ready`, zie Settings.tsx).
  if (!isHorecaOnly(hasTrack)) return <Navigate to={legacyStaffTarget(params.get('tab'))} replace />;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl"><Users className="h-7 w-7 text-primary sm:h-8 sm:w-8" />{t('mijnZaak.staff.title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('mijnZaak.staff.intro')}</p>
      </div>
      <div role="tablist" aria-label={t('mijnZaak.staff.title')} className="flex gap-1 overflow-x-auto border-b">
        {tabs.map((x) => (
          <button key={x.id} type="button" role="tab" aria-selected={tab?.id === x.id} onClick={() => go(x.id)}
            className={cn('whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium', tab?.id === x.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {t(x.labelKey)}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="max-w-5xl space-y-4">
        {tab?.id === 'pin' ? <>
          <KassaStaffTab />
          {/* De vergrendeltijd stond hier; het is een instelling van de kassa, geen eigenschap van een medewerker. */}
          <Link to={mijnZaakUrl('toestellen', 'vergrendeling')} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            {t('mijnZaak.staff.lock_link')}<ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </> : null}
        {tab?.id === 'uren' ? <KassaHoursCard /> : null}
        {tab?.id === 'beheerders' ? <TeamSettings /> : null}
      </div>
    </div>
  );
}
