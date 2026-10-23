// HORECA-0 — herkent "de verbinding viel weg" bij een supabase-js-aanroep.
// PostgREST geeft bij een fetch-fout geen exception maar een error-object met lege code en
// een bericht als "TypeError: Failed to fetch" / "Load failed" (Safari) / "NetworkError".
// Een echte databasefout (RLS, constraint) heeft altijd een code en valt hier dus buiten.
const NETWORK_MSG = /failed to fetch|load failed|networkerror|network request failed|fetch failed|the internet connection appears to be offline|err_internet_disconnected|timeout|aborted/i;

export function isPosNetworkError(error: unknown): boolean {
  if (!error) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (error instanceof TypeError) return true;
  const e = error as { code?: string | null; message?: string; name?: string };
  if (e.name === 'AbortError') return true;
  if (e.code && e.code !== '' && !/^(ECONN|ETIMEDOUT|ENOTFOUND)/.test(e.code)) return false;
  return NETWORK_MSG.test(String(e.message ?? error));
}
