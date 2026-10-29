// KASSA-UX-2 — het barscherm en het keukenscherm in SellQo Kassa.
//
// Binnenkomend (bar): QR-bestellingen per tafel (op de rekening zetten of weigeren) en de bonnen
// voor de post Bar (nieuw → klaar → opgediend). Op een tablet staat dit naast het zaalplan, op een
// gsm onder "Bar". Keuken: hetzelfde bord als /admin/keuken (KitchenBoard), met de keuze van de post.
// Geen eigen data: de bonnen komen uit useKitchenBoard, de QR-bestellingen uit de HorecaStore.
import { useTranslation } from 'react-i18next';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { KitchenColumns, StationSelect, TicketCard } from '@/components/admin/kitchen/KitchenBoard';
import { ticketLabels } from '@/components/admin/kitchen/kitchenBoardUtils';
import { printTicket } from '@/components/admin/kitchen/printTicket';
import { NEXT_STATUS, PREV_STATUS, type KitchenCard, type KitchenStatus } from '@/components/admin/kitchen/kitchenModel';
import type { PrepStation } from '@/hooks/usePrepStations';
import type { ActionCtx } from '../horeca/actions';
import type { TableRequest } from '../horeca/requests';
import { RequestList } from './RequestInbox';

interface Board { now: number; busy: boolean; fresh: Set<string>; storeName: string; onMove: (card: KitchenCard, status: KitchenStatus) => void }

/** Bonnen die aan de bar nog iets vragen (niet afgewerkt of geannuleerd). */
const openCards = (cards: KitchenCard[]) => cards.filter((c) => c.status === 'new' || c.status === 'preparing' || c.status === 'ready');

export function BarPanel({ ctx, requests, cards, barName, wide, board }: {
  ctx: ActionCtx; requests: TableRequest[]; cards: KitchenCard[]; barName: string | null; wide: boolean; board: Board;
}) {
  const { t, i18n } = useTranslation();
  const open = openCards(cards);
  const empty = !requests.length && !open.length;
  return (
    <div className="flex flex-col gap-4 p-3">
      {!wide && <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground"><Inbox className="h-4 w-4" aria-hidden />{t('kassa.bar.incoming')}</h2>}
      {empty ? (
        <p className="rounded-xl border-2 border-dashed p-6 text-center text-sm text-muted-foreground">{t(barName ? 'kassa.bar.empty' : 'kassa.bar.emptyNoBar')}</p>
      ) : null}
      {requests.length ? (
        <section className="space-y-2">
          <h3 className="text-base font-bold">{t('kassa.requests.title', { count: requests.length })}</h3>
          <RequestList ctx={ctx} requests={requests} />
        </section>
      ) : null}
      {barName && open.length ? (
        <section className="space-y-2">
          <h3 className="text-base font-bold">{t('kassa.bar.tickets', { name: barName, count: open.length })}</h3>
          <div className={cn('grid gap-3', wide && 'sm:grid-cols-2 xl:grid-cols-3')}>
            {open.map((c) => (
              <TicketCard key={c.key} card={c} now={board.now} busy={board.busy} fresh={board.fresh.has(c.key)} linkOrders={false} compact
                onAdvance={() => { const s = NEXT_STATUS[c.status]; if (s) board.onMove(c, s); }}
                onBack={() => { const s = PREV_STATUS[c.status]; if (s) board.onMove(c, s); }}
                onPrint={() => printTicket(c, board.storeName, ticketLabels(t, i18n.language))} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function KitchenView({ cards, stations, activeStation, onStation, isLoading, error, board }: {
  cards: KitchenCard[]; stations: PrepStation[]; activeStation: string | null; onStation: (id: string) => void; isLoading: boolean; error: unknown; board: Board;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {stations.length ? (
        <div className="flex items-center justify-end border-b bg-background px-3 py-2">
          <StationSelect stations={stations} value={activeStation} onChange={onStation} className="h-11 max-w-[14rem]" />
        </div>
      ) : null}
      <KitchenColumns cards={cards} now={board.now} isLoading={isLoading} error={error} busy={board.busy} fresh={board.fresh} storeName={board.storeName}
        onMove={board.onMove} linkOrders={false} />
    </div>
  );
}
