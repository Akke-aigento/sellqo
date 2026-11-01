// HORECA-ZIJBALK-1 (ronde 3) — waar een winkel haar boekhoudkoppeling (Odoo) vindt.
// Webshop/events: SellQo Connect › Boekhouding (de vaste plek). Horeca zonder webshop/events: Connect
// bestaat daar niet (spoor), dus Instellingen › Boekhouding. Eén plek per winkel, nooit twee.
import type { Track } from '@/lib/tracks';

export const CONNECT_ACCOUNTING_URL = '/admin/connect?tab=accounting';
export const SETTINGS_ACCOUNTING_URL = '/admin/settings?section=accounting';

export const accountingInSettings = (has: (t: Track) => boolean) => has('horeca') && !has('webshop') && !has('events');

export function accountingUrl(has: (t: Track) => boolean): string {
  return accountingInSettings(has) ? SETTINGS_ACCOUNTING_URL : CONNECT_ACCOUNTING_URL;
}
