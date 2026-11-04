// HORECA-INSTELLINGEN-1 — de stand van een horecazaak: één bron voor de checklist "Je zaak inrichten"
// (Mijn zaak), het oude horeca-overzicht (Instellingen › Horeca, enkel nog bij horeca + webshop/events)
// en Kaart › Overzicht. De ruwe cijfers komen uit useHorecaStatus (src/hooks/useHorecaStatus.ts);
// hier staat enkel de regel wat "klaar" betekent. Puur, zodat het getest kan worden.
import { FLOOR_EDIT_PATH, mijnZaakUrl, staffUrl } from '@/lib/mijnZaak';

export interface HorecaStatus {
  // Bedrijfsgegevens (tenants)
  name: string; address: string; postalCode: string; city: string; vat: string;
  logo: boolean;
  hoursSet: boolean;
  // Kassa
  terminals: number;
  /** Gekoppelde SellQo Kassa-toestellen (accounts of een hartslag). */
  pairedDevices: number;
  /** Actieve kassamedewerkers die aan de kassa mogen; een PIN is verplicht bij het aanmaken. */
  cashiers: number;
  /** Betaalwijzen aan de kassa (horeca_pay_settings.methods; zonder rij de standaard: 2). */
  payMethods: number;
  kassaTip: boolean;
  terminalMode: string;
  receiptPrint: boolean; mailOnline: boolean;
  notifyDevices: number;
  // Zaal en keuken
  tables: number; areas: number; stations: number; printers: number;
  // Gasten
  qrMode: 'off' | 'view' | 'order';
  qrFlow: 'order' | 'check';
  qrPayCounter: boolean; qrPayOnline: boolean;
  /** Tafelrekening online afrekenen (horeca_pay_settings.online_pay). */
  checkOnline: boolean; onlineTip: boolean;
  leadMinutes: number;
  // Website en webshop
  shopLive: boolean; shopOrdering: boolean;
  pickup: boolean; delivery: boolean; slots: boolean; payOnPickup: boolean;
  addonGroups: number; menuItems: number;
  // Online betalen
  stripe: boolean;
}

export interface SetupStep {
  id: string;
  labelKey: string;
  done: boolean;
  /** Telt niet mee in "X van Y klaar". */
  optional?: boolean;
  to: string;
}

/** Moet de zaak online kunnen betalen? Enkel als QR-betalen of online bestellen aanstaat. */
export const needsOnlinePay = (s: HorecaStatus): boolean =>
  (s.qrMode === 'order' && (s.qrFlow === 'check' ? s.checkOnline : s.qrPayOnline)) || (s.shopLive && s.shopOrdering);

export function setupSteps(s: HorecaStatus): SetupStep[] {
  const filled = (v: string) => v.trim().length > 0;
  const steps: SetupStep[] = [
    { id: 'company', labelKey: 'mijnZaak.setup.company', done: [s.name, s.address, s.postalCode, s.city, s.vat].every(filled), to: mijnZaakUrl('zaak', 'gegevens') },
    { id: 'hours', labelKey: 'mijnZaak.setup.hours', done: s.hoursSet, to: mijnZaakUrl('zaak', 'uren') },
    { id: 'logo', labelKey: 'mijnZaak.setup.logo', done: s.logo, to: mijnZaakUrl('zaak', 'merk') },
    { id: 'kassa', labelKey: 'mijnZaak.setup.kassa', done: s.terminals > 0 && s.pairedDevices > 0, to: mijnZaakUrl('toestellen', 'kassas') },
    { id: 'staff', labelKey: 'mijnZaak.setup.staff', done: s.cashiers > 0, to: staffUrl('pin') },
    { id: 'floor', labelKey: 'mijnZaak.setup.floor', done: s.tables > 0, to: FLOOR_EDIT_PATH },
    { id: 'station', labelKey: 'mijnZaak.setup.station', done: s.stations > 0, to: mijnZaakUrl('zaal-keuken', 'posten') },
    { id: 'printer', labelKey: 'mijnZaak.setup.printer', done: s.printers > 0, optional: true, to: mijnZaakUrl('zaal-keuken', 'printers') },
    // 1b: geen stappen "QR-menu aan" en "Betaalwijze aan de kassa" meer. Die stonden groen zonder dat de
    // zaak iets koos: qr_mode staat standaard op 'view' (elke tafel heeft vanzelf een qr_token), en
    // horeca_pay_settings valt zonder rij terug op contant + overschrijving. Een eigen keuze is niet
    // aan te tonen: een fulfillment_settings-rij ontstaat ook via pauze, afhalen of de shopschakelaar, en
    // een horeca_pay_settings-rij ook via printers, gangen of de vergrendeltijd (geen eigen tijdstempel
    // per veld). Een checklist die vanzelf groen staat, liegt; dus geschrapt.
  ];
  // Online betalen is enkel een stap als de zaak het nodig heeft.
  if (needsOnlinePay(s)) steps.push({ id: 'stripe', labelKey: 'mijnZaak.setup.stripe', done: s.stripe, to: mijnZaakUrl('betalen', 'online') });
  steps.push({ id: 'website', labelKey: 'mijnZaak.setup.website', done: s.shopLive, to: '/admin/storefront' });
  return steps;
}

/** "X van Y klaar", zonder de optionele stappen. */
export function setupProgress(steps: SetupStep[]): { done: number; total: number } {
  const counted = steps.filter((x) => !x.optional);
  return { done: counted.filter((x) => x.done).length, total: counted.length };
}
