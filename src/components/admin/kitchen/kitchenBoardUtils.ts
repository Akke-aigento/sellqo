// KASSA-UX-2 — helpers en hooks bij het gedeelde keukenbord (KitchenBoard.tsx). Apart bestand
// zodat KitchenBoard.tsx enkel componenten exporteert (react-refresh).
import { useEffect, useMemo, useRef, useState } from 'react';
import type { TFunction } from 'i18next';
import type { TicketLabels } from './printTicket';
import { cardsForStation, type KitchenCard } from './kitchenModel';
import { usePrepStations, type PrepStation } from '@/hooks/usePrepStations';
import { ding } from '@/lib/ding';

export const STATION_KEY = 'sq_kitchen_station';

export const hhmm = (iso: string | number, lang: string) => new Date(iso).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });

/** Herkomst van een bon: "Webshop #1043", "Kassa" of "Telefoon". */
export const sourceName = (c: KitchenCard, t: TFunction) =>
  c.source === 'webshop' ? t('admin.kitchen.webshop_label', { label: c.label })
    : t(c.source === 'phone' ? 'admin.kitchen.source_phone' : c.source === 'table' ? 'admin.kitchen.source_table' : 'admin.kitchen.source_pos');
/** Tafel en/of klantnaam. */
export const whoName = (c: KitchenCard, t: TFunction) =>
  [c.table ? t('admin.kitchen.table', { table: c.table }) : null, c.customer].filter(Boolean).join(' · ');

export function ticketLabels(t: TFunction, lang: string): TicketLabels {
  return {
    lang,
    service: { pickup: t('admin.kitchen.print_pickup'), local_delivery: t('admin.kitchen.print_delivery'), eat_in: t('admin.kitchen.print_eat_in') },
    order: t('admin.kitchen.print_order'), asap: t('admin.kitchen.print_asap'), paid: t('admin.kitchen.print_paid'), toPay: t('admin.kitchen.print_to_pay'),
    source: (c) => sourceName(c, t), who: (c) => whoName(c, t),
    toPayAmount: (amount) => t('admin.kitchen.print_to_pay_amount', { amount }),
    footer: (ordered, printed) => t('admin.kitchen.print_footer', { ordered, printed }),
  };
}

const ALL = 'all';

/**
 * Welke post dit toestel toont (keuken, bar, … of alles); per toestel onthouden.
 * KASSA-UX-2: `fallback` = welke post zolang dit toestel nog niets koos (de kassa: de keuken).
 * "Alle posten" wordt bewaard als 'all', zodat die keuze niet terugvalt op `fallback`.
 */
export function useStationChoice(cards: KitchenCard[], fallback?: (stations: PrepStation[]) => string | null) {
  const { data: prep } = usePrepStations();
  const [stored, setStored] = useState<string | null>(() => { try { return localStorage.getItem(STATION_KEY) || null; } catch { return null; } });
  const stations = useMemo(() => prep?.stations ?? [], [prep]);
  const wanted = stored === ALL ? null : stored ?? (fallback ? fallback(stations) : null);
  const activeStation = wanted && stations.some((s) => s.id === wanted) ? wanted : null;
  const defaultStation = stations.find((s) => s.is_default)?.id ?? null;
  const filtered = useMemo(() => cardsForStation(cards, activeStation, defaultStation), [cards, activeStation, defaultStation]);
  const choose = (id: string) => {
    const v = id || ALL;
    setStored(v);
    try { localStorage.setItem(STATION_KEY, v); } catch { /* privémodus */ }
  };
  return { stations, activeStation, defaultStation, cards: filtered, choose };
}

/** Nieuwe bon: belletje, eventueel meteen afdrukken, en even laten oplichten. De eerste lading telt niet. */
export function useFreshCards(cards: KitchenCard[], isLoading: boolean, opts: { sound: boolean; onNew?: (added: KitchenCard[]) => void }) {
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const seen = useRef<Set<string> | null>(null);
  const { sound, onNew } = opts;
  useEffect(() => {
    if (isLoading) return;
    const open = cards.filter((c) => c.status === 'new').map((c) => c.key);
    if (seen.current === null) { seen.current = new Set(cards.map((c) => c.key)); return; }
    const added = open.filter((k) => !seen.current!.has(k));
    cards.forEach((c) => seen.current!.add(c.key));
    if (!added.length) return;
    if (sound) ding();
    onNew?.(cards.filter((c) => added.includes(c.key)));
    setFresh((f) => new Set([...f, ...added]));
    setTimeout(() => setFresh((f) => { const n = new Set(f); added.forEach((k) => n.delete(k)); return n; }), 20_000);
  }, [cards, isLoading, sound, onNew]);
  return fresh;
}

