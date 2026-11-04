// Spoorfilter zoals tracksAllow: items met tracks verbergen als geen van die sporen aanstaat.
import { H } from './h';
export function useNavItemVisibility() {
  const on = H.tracks ?? ['horeca'];
  return { isItemBlocked: (i: { id: string; tracks?: string[] }) => i.id.startsWith('platform') || (!!i.tracks?.length && !i.tracks.some((t) => on.includes(t))) };
}
