// HORECA-INSTELLINGEN-1 — het register van alle instellingen voor de zoekbalk (bovenaan Mijn zaak en
// ⌘K/Ctrl-K in de hele admin). Per instelling: label, waar ze woont (route + section + tab + anker),
// groep, synoniemen (i18n, per taal een kommalijst) en wie ze mag openen (rol/recht, spoor).
//
// De tabs van Mijn zaak komen rechtstreeks uit ZAAK_GROUPS (één bron); daarnaast de plekken buiten
// Instellingen die een cafébaas als "instelling" zoekt (Personeel, Reservaties, extra's, allergenen).
// settingsIndex.test.ts controleert dat elk pad naar een bestaande route/sectie/tab leidt.
import { isHorecaOnly, type Track } from '@/lib/tracks';
import { KAART_PATH, RESERVATIONS_PATH, STAFF_TABS, ZAAK_GROUPS, mijnZaakUrl, staffUrl } from '@/lib/mijnZaak';
import type { AccessRule } from '@/hooks/useZaakAccess';

export interface SettingsEntry {
  id: string;
  /** i18n-key van het label. */
  labelKey: string;
  /** i18n-key van de groep (Je zaak, Betalen, Personeel, …). */
  groupKey: string;
  /** Volledige url: route, ?section=&tab= of ?tab=, eventueel #anker. */
  path: string;
  /** i18n-key met synoniemen, komma-gescheiden, in elke taal. */
  synKey: string;
  rule: AccessRule;
}

/** Het Nu-paneel staat bovenaan Vandaag (het dashboard). */
const TODAY_PATH = '/admin';
const TODAY_GROUP = 'navigation.bottom.today';

const syn = (id: string) => `settingsSearch.syn.${id.replace(/[.-]/g, '_')}`;

function buildIndex(): SettingsEntry[] {
  const out: SettingsEntry[] = [];
  for (const g of ZAAK_GROUPS) {
    for (const tab of g.tabs) {
      const id = `${g.id}.${tab.id}`;
      out.push({ id, labelKey: tab.labelKey, groupKey: g.titleKey, path: mijnZaakUrl(g.id, tab.id), synKey: syn(id), rule: { requiredRead: tab.requiredRead, adminOnly: tab.adminOnly } });
    }
  }
  for (const tab of STAFF_TABS) {
    const id = `personeel.${tab.id}`;
    out.push({ id, labelKey: tab.labelKey, groupKey: 'mijnZaak.staff.title', path: staffUrl(tab.id), synKey: syn(id), rule: { requiredRead: tab.requiredRead, adminOnly: tab.adminOnly } });
  }
  out.push(
    { id: 'reservaties.lijst', labelKey: 'reservations.title', groupKey: 'navigation.groups.daily', path: RESERVATIONS_PATH, synKey: syn('reservaties.lijst'), rule: { requiredRead: 'orders' } },
    { id: 'kaart.extras', labelKey: 'admin.orderingHub.tab_extras', groupKey: 'admin.orderingHub.tab_menu', path: `${KAART_PATH}?tab=extras`, synKey: syn('kaart.extras'), rule: { requiredRead: 'orders' } },
    { id: 'kaart.allergens', labelKey: 'admin.orderingHub.tab_allergens', groupKey: 'admin.orderingHub.tab_menu', path: `${KAART_PATH}?tab=allergens`, synKey: syn('kaart.allergens'), rule: { requiredRead: 'orders' } },
  );
  // HORECA-NU-1 (samenvoeging met HORECA-INSTELLINGEN-1): de schakelaars voor tijdens de dienst wonen in het
  // Nu-paneel bovenaan Vandaag (/admin), niet in Mijn zaak. Rechten zoals de tegels (NowPanel.tsx): zones voor
  // personeel, dagschotel/uitverkocht volgens producten, keuken pauzeren en vandaag dicht enkel de zaakvoerder.
  out.push(
    { id: 'nu.zone', labelKey: 'settingsSearch.nu_zone', groupKey: TODAY_GROUP, path: TODAY_PATH, synKey: syn('nu.zone'), rule: { requiredRead: 'orders' } },
    { id: 'nu.dagschotel', labelKey: 'admin.now.special.title', groupKey: TODAY_GROUP, path: TODAY_PATH, synKey: syn('nu.dagschotel'), rule: { requiredRead: 'products' } },
    { id: 'nu.uitverkocht', labelKey: 'admin.now.soldout.title', groupKey: TODAY_GROUP, path: TODAY_PATH, synKey: syn('nu.uitverkocht'), rule: { requiredRead: 'products' } },
    { id: 'nu.keuken', labelKey: 'admin.now.pause.title', groupKey: TODAY_GROUP, path: TODAY_PATH, synKey: syn('nu.keuken'), rule: { adminOnly: true } },
    { id: 'nu.dicht', labelKey: 'admin.now.closed.title', groupKey: TODAY_GROUP, path: TODAY_PATH, synKey: syn('nu.dicht'), rule: { adminOnly: true } },
  );
  return out;
}

export const SETTINGS_INDEX: SettingsEntry[] = buildIndex();

/**
 * Wat deze zaak kan doorzoeken. Het register beschrijft de horeca-only indeling (Mijn zaak, Personeel);
 * andere zaken hebben die plekken niet en krijgen dus niets (hun Instellingen blijven zoals ze waren).
 */
export function settingsIndexFor(has: (t: Track) => boolean): SettingsEntry[] {
  return isHorecaOnly(has) ? SETTINGS_INDEX : [];
}

/** Kleine letters, zonder accenten (café = cafe, Gerät = gerat). */
export const normalizeSearch = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export interface ResolvedEntry extends SettingsEntry { label: string; group: string; synonyms: string[] }

/**
 * Zoeken: elk woord van de zoekterm moet in het label, de groep of een synoniem staan. Een treffer in
 * label of synoniem weegt zwaarder dan in de groep, zodat "fooi" eerst Betalen › Fooi geeft.
 */
export function searchSettings(entries: ResolvedEntry[], query: string): ResolvedEntry[] {
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return entries;
  const scored: { e: ResolvedEntry; score: number }[] = [];
  for (const e of entries) {
    const label = normalizeSearch(e.label);
    const group = normalizeSearch(e.group);
    const syns = e.synonyms.map(normalizeSearch);
    let score = 0;
    let all = true;
    for (const w of words) {
      if (syns.some((x) => x === w)) score += 4;
      else if (label.startsWith(w)) score += 4;
      else if (label.includes(w)) score += 3;
      else if (syns.some((x) => x.includes(w))) score += 2;
      else if (group.includes(w)) score += 1;
      else { all = false; break; }
    }
    if (all) scored.push({ e, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((x) => x.e);
}
