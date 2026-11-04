import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { Monitor, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KassaStaffTab } from '@/components/admin/pos/KassaStaffTab';
import { KassaHoursCard } from '@/components/admin/pos/KassaHoursCard';
import { HorecaPaySettings } from '@/components/admin/pos/HorecaPaySettings';
import { HorecaLockSetting } from '@/components/admin/pos/HorecaLockSetting';
import { HorecaPrinters } from '@/components/admin/pos/HorecaPrinters';
import { PosTerminalsPanel } from '@/components/admin/pos/PosTerminalsPanel';
import { usePOSTerminals } from '@/hooks/usePOS';
import { useTranslation } from 'react-i18next';
import { useTracks } from '@/hooks/useBusinessModules';
import { isHorecaOnly } from '@/lib/tracks';
import { legacyPosTarget } from '@/lib/mijnZaak';

export default function POSPage() {
  const { t } = useTranslation();
  // PERSONEEL-1 — tabs bovenaan, deeplinkbaar (?tab=terminals|personeel).
  const [searchParams, setSearchParams] = useSearchParams();
  // BETAAL-1: ?tab=betalen — betaalinstellingen van SellQo Kassa (enkel met het horecaspoor).
  const { hasTrack: hasTrackForTabs, ready } = useTracks();
  const payTab = hasTrackForTabs('horeca');
  const rawTab = searchParams.get('tab');
  // PRINT-2: ?tab=printers — Bon & printers (horecaspoor).
  const tab = rawTab === 'personeel' ? 'personeel' : rawTab === 'betalen' && payTab ? 'betalen' : rawTab === 'printers' && payTab ? 'printers' : 'terminals';
  const setTab = (v: string) => {
    const next = new URLSearchParams(searchParams);
    if (v === 'terminals') next.delete('tab'); else next.set('tab', v);
    setSearchParams(next, { replace: true });
  };
  // Kassalijst, kassadagen, koppelen en de dialogen: PosTerminalsPanel (ook in Mijn zaak). Hier enkel
  // het laden (volledige pagina-spinner zoals voorheen) en de knop in de kop.
  const { isLoading } = usePOSTerminals();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // HORECA-INSTELLINGEN-1: horeca-only heeft geen Kassabeheer meer; elke tab gaat naar zijn nieuwe plek
  // (Mijn zaak of Personeel). Combinaties met webshop of events: ongewijzigd.
  if (ready && isHorecaOnly(hasTrackForTabs)) return <Navigate to={legacyPosTarget(rawTab)} replace />;

  // Ook wachten op de sporen: anders flitst Kassabeheer even voor de doorverwijzing.
  if (isLoading || !ready) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('admin.pOS.kassa_pos')}</h1>
          <p className="text-muted-foreground">
            {t('admin.pOS.beheer_je_kassaterminals_en_start_een')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/kassa">
              <Monitor className="mr-2 h-4 w-4" />
              {t('admin.pOS.openKassaApp')}
            </Link>
          </Button>
          {tab === 'terminals' && (
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('admin.pOS.nieuwe_terminal')}
            </Button>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="terminals">{t('admin.pOS.tabs.terminals')}</TabsTrigger>
          <TabsTrigger value="personeel">{t('admin.pOS.tabs.staff')}</TabsTrigger>
          {payTab ? <TabsTrigger value="betalen">{t('admin.pOS.tabs.pay')}</TabsTrigger> : null}
          {payTab ? <TabsTrigger value="printers">{t('admin.pOS.tabs.printers')}</TabsTrigger> : null}
        </TabsList>
        {payTab ? (
          <TabsContent value="betalen" className="mt-4 max-w-3xl">
            <HorecaPaySettings />
          </TabsContent>
        ) : null}
        {payTab ? (
          <TabsContent value="printers" className="mt-4 max-w-3xl">
            <HorecaPrinters />
          </TabsContent>
        ) : null}
        <TabsContent value="personeel" className="mt-4 space-y-4">
          {/* KASSA-UX-6: na hoeveel minuten de kassa terug op het PIN-scherm valt. */}
          <div className="max-w-3xl"><HorecaLockSetting /></div>
          <KassaStaffTab />
          {/* PERSONEEL-2: urenoverzicht (horecaspoor, zoals Betalen en Printers). */}
          {payTab ? <KassaHoursCard /> : null}
        </TabsContent>
        <TabsContent value="terminals" className="mt-4 space-y-6">
          <PosTerminalsPanel createOpen={showCreateDialog} onCreateOpenChange={setShowCreateDialog} showNotify={payTab} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
