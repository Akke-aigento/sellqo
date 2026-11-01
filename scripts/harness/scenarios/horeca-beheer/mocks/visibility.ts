// Spoor- en rolfilter zoals de echte app (tracksAllow + excludeRoles); abonnement: alles mag.
import { H } from './h';
type I = { id: string; tracks?: string[]; excludeRoles?: string[]; allowedRoles?: string[] };
const blocked = (i: I) => i.id.startsWith('platform') || (!!i.tracks?.length && !i.tracks.some((t) => H.tracks.includes(t)))
  || (!!i.excludeRoles?.includes(H.role)) || (!!i.allowedRoles && !i.allowedRoles.includes(H.role));
export function useNavItemVisibility() {
  return { isItemBlocked: blocked, shouldHideItem: blocked, isItemSubscriptionBlocked: () => false };
}
