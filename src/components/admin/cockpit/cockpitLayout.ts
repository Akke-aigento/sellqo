// DASH-2b — welke kaarten de cockpit toont, in welke volgorde en hoe breed. Puur, zodat de
// spoorregels en de persoonlijke volgorde testbaar zijn. De volgorde en verborgen kaarten
// bewaren we per gebruiker in dashboard_preferences, met layout_type 'cockpit' als merkteken:
// rijen van het oude dashboard (andere layout_type) worden genegeerd.
import type { Track } from '@/lib/tracks';

export const COCKPIT_LAYOUT_TYPE = 'cockpit';

export type CockpitCardId =
  | 'event'
  | 'kitchen'
  | 'today'
  | 'goal'
  | 'rush'
  | 'menu'
  | 'todo'
  | 'channels'
  | 'feed'
  | 'deliveries'
  | 'top';

export interface CockpitCardDef {
  id: CockpitCardId;
  /** Kolommen op brede schermen (grid van 3). */
  span: 1 | 2 | 3;
  /** Toon alleen als de winkel minstens één van deze sporen heeft; leeg = altijd. */
  tracks: Track[];
}

export const COCKPIT_CARDS: CockpitCardDef[] = [
  { id: 'event', span: 3, tracks: ['events'] },
  { id: 'kitchen', span: 3, tracks: ['horeca'] },
  { id: 'today', span: 2, tracks: [] },
  { id: 'goal', span: 1, tracks: [] },
  { id: 'rush', span: 2, tracks: ['horeca'] },
  { id: 'menu', span: 1, tracks: ['horeca'] },
  { id: 'todo', span: 1, tracks: [] },
  { id: 'channels', span: 1, tracks: [] },
  { id: 'feed', span: 1, tracks: [] },
  { id: 'deliveries', span: 1, tracks: ['horeca'] },
  { id: 'top', span: 3, tracks: [] },
];

const DEFAULT_ORDER = COCKPIT_CARDS.map((c) => c.id);
const isCardId = (id: string): id is CockpitCardId => (DEFAULT_ORDER as string[]).includes(id);

/** Kaarten die bij deze winkel horen (spoorregels), in de standaardvolgorde. */
export function availableCards(tracks: readonly Track[]): CockpitCardDef[] {
  return COCKPIT_CARDS.filter((c) => c.tracks.length === 0 || c.tracks.some((t) => tracks.includes(t)));
}

export interface StoredLayout {
  layout_type?: string | null;
  widget_order?: string[] | null;
  hidden_widgets?: string[] | null;
}

export interface CockpitLayout {
  /** Alle beschikbare kaarten in de volgorde van de gebruiker (verborgen inbegrepen). */
  order: CockpitCardDef[];
  hidden: Set<CockpitCardId>;
}

/**
 * Volgorde van de gebruiker, toegepast op de beschikbare kaarten. Onbekende ids vallen weg;
 * nieuwe kaarten (nog niet in de bewaarde volgorde) komen op hun standaardplek.
 */
export function resolveLayout(tracks: readonly Track[], stored: StoredLayout | null | undefined): CockpitLayout {
  const available = availableCards(tracks);
  const own = stored?.layout_type === COCKPIT_LAYOUT_TYPE;
  const saved = own ? (stored?.widget_order ?? []).filter(isCardId) : [];
  const hidden = new Set(own ? (stored?.hidden_widgets ?? []).filter(isCardId) : []);

  const rank = new Map<CockpitCardId, number>();
  saved.forEach((id, i) => rank.set(id, i));
  // Een kaart die nog niet bewaard was, krijgt de positie van zijn voorganger in de
  // standaardvolgorde + een halve stap, zodat hij niet achteraan belandt.
  let last = -1;
  for (const id of DEFAULT_ORDER) {
    if (rank.has(id)) last = rank.get(id)!;
    else rank.set(id, last + 0.5);
  }

  const order = [...available].sort((a, b) => rank.get(a.id)! - rank.get(b.id)! || DEFAULT_ORDER.indexOf(a.id) - DEFAULT_ORDER.indexOf(b.id));
  return { order, hidden };
}

/** Een kaart één plek op of neer schuiven. */
export function moveCard(order: CockpitCardId[], id: CockpitCardId, dir: -1 | 1): CockpitCardId[] {
  const i = order.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return order;
  const next = [...order];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export const spanClass = (span: 1 | 2 | 3) =>
  span === 3 ? 'md:col-span-2 xl:col-span-3' : span === 2 ? 'md:col-span-2' : '';
