// FOOD-2 — keukenscherm voor pizzeria's, kebabzaken en frituren. Webshop-, kassa- en
// telefoonbestellingen in één overzicht, gesorteerd op afhaal-/levertijd. Gemaakt voor
// een tablet aan de muur: grote knoppen, belletje bij een nieuwe bestelling.
// KASSA-UX-2: het bord zelf staat in KitchenBoard.tsx (ook gebruikt door SellQo Kassa).
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Bell, BellOff, BellRing, Maximize2, MonitorSmartphone, Printer } from 'lucide-react';
import { useTenant } from '@/hooks/useTenant';
import { printTicket } from '@/components/admin/kitchen/printTicket';
import { Button } from '@/components/ui/button';
import { useKitchenBoard } from '@/components/admin/kitchen/useKitchenBoard';
import { KitchenPauseControl } from '@/components/admin/kitchen/KitchenPauseControl';
import { KitchenColumns, StationSelect } from '@/components/admin/kitchen/KitchenBoard';
import { hhmm, ticketLabels, useFreshCards, useStationChoice } from '@/components/admin/kitchen/kitchenBoardUtils';
import { minutesLeft, type KitchenCard } from '@/components/admin/kitchen/kitchenModel';
import { useTranslation } from 'react-i18next';
import { useHideAdminBottomNav } from '@/hooks/useAdminBottomNav';
import { useTracks } from '@/hooks/useBusinessModules';
import { ding, readFlag } from '@/lib/ding';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useAppShell } from '@/hooks/useAppShell';
import { DeviceAlertsDialog } from '@/components/horeca/DeviceAlertsDialog';

const SOUND_KEY = 'sq_kitchen_sound';
const WAKE_KEY = 'sq_kitchen_wake';
const PRINT_KEY = 'sq_kitchen_autoprint';

export default function KitchenPage() {
  const { t, i18n } = useTranslation();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(id); }, []);
  const { cards: allCards, isLoading, error, setStatus } = useKitchenBoard(now);
  // TAFEL-1 — dit scherm toont één post (bar, keuken, …) of alles; per toestel onthouden.
  const { stations, activeStation, cards, choose } = useStationChoice(allCards);
  // HORECA-0 — het keukenscherm ligt over de admin heen: de navigatiepil van de
  // admin (ook z-50, later in de DOM) mag er niet over zweven.
  useHideAdminBottomNav(true);
  // MELDING-1: scherm wakker (per toestel, standaard aan), push als het scherm dicht is, eigen beginscherm-app.
  useAppShell('/keuken.webmanifest', 'Keuken', '#111827');
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [wake, setWake] = useState(() => readFlag(WAKE_KEY, true));
  const wakeActive = useWakeLock(wake);
  const [sound, setSound] = useState(() => { try { return localStorage.getItem(SOUND_KEY) === '1'; } catch { return false; } });
  const [autoPrint, setAutoPrint] = useState(() => { try { return localStorage.getItem(PRINT_KEY) === '1'; } catch { return false; } });
  const { currentTenant } = useTenant();
  const storeName = currentTenant?.name || '';
  // KASSA-UX-2: een horecazaak springt met één tik naar de kassa (en daar terug naar Keuken).
  const { hasTrack } = useTracks();
  // FOOD-4 — nieuwe bon meteen naar de bonprinter (als dat op dit toestel aan staat).
  const onNew = useCallback((added: KitchenCard[]) => {
    if (autoPrint) added.forEach((c, i) => setTimeout(() => printTicket(c, storeName, ticketLabels(t, i18n.language)), i * 1500));
  }, [autoPrint, storeName, t, i18n.language]);
  const fresh = useFreshCards(cards, isLoading, { sound, onNew });

  const toggleAutoPrint = () => {
    const next = !autoPrint;
    setAutoPrint(next);
    try { localStorage.setItem(PRINT_KEY, next ? '1' : '0'); } catch { /* privémodus */ }
  };

  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    try { localStorage.setItem(SOUND_KEY, next ? '1' : '0'); } catch { /* privémodus */ }
    if (next) ding(); // ook om de browser audio te laten toestaan
  };

  const count = (s: KitchenCard['status']) => cards.filter((c) => c.status === s).length;
  const nextHour = cards.filter((c) => c.status !== 'done' && c.requestedTime && minutesLeft(c, now) >= 0 && minutesLeft(c, now) <= 60).length;

  return (
    // HORECA-0 — notch en statusbalk (app) en de home-balk onderaan respecteren.
    // WANDELING: een dekkende achtergrond. Met enkel bg-muted/40 schemerde de zijbalk van het beheer door het keukenscherm.
    <div className="fixed inset-0 z-50 flex flex-col bg-background" style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)', backgroundImage: 'linear-gradient(hsl(var(--muted) / 0.4), hsl(var(--muted) / 0.4))' }}>
      <header className="flex items-center gap-2 sm:gap-3 border-b bg-background px-3 sm:px-4 py-3">
        <Button asChild variant="ghost" size="icon" aria-label={t('admin.kitchen.back_to_admin')}><Link to="/admin"><ArrowLeft className="h-5 w-5" /></Link></Button>
        <h1 className="text-lg sm:text-xl font-bold truncate">{t('admin.kitchen.title')}</h1>
        <span className="text-xl sm:text-2xl font-bold tabular-nums">{hhmm(now, i18n.language)}</span>
        <span className="hidden text-sm text-muted-foreground xl:inline">
          {t('admin.kitchen.summary', { new: count('new'), preparing: count('preparing'), ready: count('ready'), nextHour })}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <StationSelect stations={stations} value={activeStation} onChange={choose} />
          <KitchenPauseControl now={now} />
          <Button variant={autoPrint ? 'secondary' : 'outline'} size="sm" onClick={toggleAutoPrint} title={t('admin.kitchen.auto_print_hint')} aria-label={autoPrint ? t('admin.kitchen.auto_print_aan') : t('admin.kitchen.auto_print_uit')}>
            <Printer className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">{autoPrint ? t('admin.kitchen.auto_print_aan') : t('admin.kitchen.auto_print_uit')}</span>
          </Button>
          <Button variant={sound ? 'secondary' : 'outline'} size="sm" onClick={toggleSound} aria-label={sound ? t('admin.kitchen.geluid_aan') : t('admin.kitchen.geluid_uit')}>
            {sound ? <Bell className="h-4 w-4 sm:mr-1.5" /> : <BellOff className="h-4 w-4 sm:mr-1.5" />}<span className="hidden sm:inline">{sound ? t('admin.kitchen.geluid_aan') : t('admin.kitchen.geluid_uit')}</span>
          </Button>
          <Button variant="outline" size="icon" onClick={() => setAlertsOpen(true)} aria-label={t('deviceAlerts.title')} title={t('deviceAlerts.title')}>
            <BellRing className="h-4 w-4" />
          </Button>
          {hasTrack('horeca') ? (
            <Button asChild variant="outline" size="sm" aria-label={t('admin.kitchen.to_kassa')}>
              <Link to="/kassa"><MonitorSmartphone className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">{t('admin.kitchen.to_kassa')}</span></Link>
            </Button>
          ) : null}
          <Button variant="outline" size="icon" className="hidden sm:inline-flex" aria-label={t('admin.kitchen.fullscreen')}
            onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => undefined)}>
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {alertsOpen && currentTenant ? (
        <DeviceAlertsDialog open={alertsOpen} onOpenChange={setAlertsOpen} tenantId={currentTenant.id} kind="station"
          defaultName={stations.find((x) => x.id === activeStation)?.name ?? t('deviceAlerts.defaultName.station')}
          stationId={activeStation} stationNames={new Map(stations.map((x) => [x.id, x.name]))}
          wakeKey={WAKE_KEY} wakeDefault onWakeChange={setWake} wakeActive={wakeActive} manageHref="/admin/pos" />
      ) : null}

      <KitchenColumns cards={cards} now={now} isLoading={isLoading} error={error} busy={setStatus.isPending} fresh={fresh} storeName={storeName}
        onMove={(card, status) => setStatus.mutate({ card, status })} />
    </div>
  );
}
