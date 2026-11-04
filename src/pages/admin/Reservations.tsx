// HORECA-INSTELLINGEN-1 — "Reservaties" (horeca-only): de dagelijst en de online aanvragen, als eigen
// item in de zijbalk (stond onder Kaart). De instellingen (paars vanaf, te laat na, online reserveren)
// staan in Mijn zaak › Je gasten › Reserveren. Combinaties met webshop/events: Kaart › Reservaties, ongewijzigd.
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarClock } from 'lucide-react';
import { ReservationsManager } from '@/components/admin/horeca/ReservationsManager';
import { ModuleGateLoading, ModuleOffCard } from '@/components/admin/ModuleOffCard';
import { useHorecaModule } from '@/hooks/useHorecaModule';
import { useTracks } from '@/hooks/useBusinessModules';
import { isHorecaOnly } from '@/lib/tracks';
import { KAART_PATH } from '@/lib/mijnZaak';

export default function ReservationsPage() {
  const { t } = useTranslation();
  const horeca = useHorecaModule();
  const { ready, hasTrack } = useTracks();
  if (!ready) return <ModuleGateLoading />;
  if (!horeca) return <ModuleOffCard module="horeca" />;
  // 1b: combinaties met webshop of events houden Kaart › Reservaties (pas na `ready`, zie Settings.tsx).
  if (!isHorecaOnly(hasTrack)) return <Navigate to={`${KAART_PATH}?tab=reservaties`} replace />;
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl"><CalendarClock className="h-7 w-7 text-primary sm:h-8 sm:w-8" />{t('reservations.title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('mijnZaak.reservations.intro')}</p>
      </div>
      <div className="max-w-5xl"><ReservationsManager part="list" /></div>
    </div>
  );
}
