// WEBSITE-HORECA-1 — welke homepage-secties een horecazaak zonder webshop of events kan toevoegen.
// Enkel wat op haar website ook echt iets toont of werkt:
//   - event_agenda: toont tickets (eventsspoor);
//   - newsletter: inschrijvingen gaan naar e-mailmarketing, die bij webshop/events hoort;
//   - external_reviews: winkelreviews beheer je in Instellingen › Reviews (webshopspoor).
// Bestaande secties van die soort blijven in de lijst staan (verbergen of verwijderen kan dan nog).
import { isHorecaOnly, type Track } from '@/lib/tracks';

// HORECA-INSTELLINGEN-1: de regel woont nu in src/lib/tracks.ts; hier enkel doorgegeven voor bestaande imports.
export { isHorecaOnly };

const HORECA_ONLY_HIDDEN = new Set(['event_agenda', 'newsletter', 'external_reviews']);

/** Mag deze sectie toegevoegd worden? Voor elke andere zaak: alles zoals voorheen. */
export function canAddSection(type: string, has: (t: Track) => boolean): boolean {
  return !(isHorecaOnly(has) && HORECA_ONLY_HIDDEN.has(type));
}
