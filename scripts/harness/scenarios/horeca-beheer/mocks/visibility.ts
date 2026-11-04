// Spoor- en rolfilter zoals de echte app (tracksAllow + excludeRoles); abonnement: alles mag.
import { H } from './h';
type I = { id: string; tracks?: string[]; excludeRoles?: string[]; allowedRoles?: string[]; horecaOnly?: boolean };
const only = H.tracks.includes('horeca') && !H.tracks.includes('webshop') && !H.tracks.includes('events');
const blocked = (i: I) => i.id.startsWith('platform') || (!!i.tracks?.length && !i.tracks.some((t) => H.tracks.includes(t)))
  || (i.horecaOnly === true && !only) || (!!i.excludeRoles?.includes(H.role)) || (!!i.allowedRoles && !i.allowedRoles.includes(H.role));
export function useNavItemVisibility() {
  return { isItemBlocked: blocked, shouldHideItem: blocked, isItemSubscriptionBlocked: () => false };
}
