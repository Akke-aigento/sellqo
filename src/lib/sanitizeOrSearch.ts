/**
 * Maakt een zoekterm veilig voor gebruik in een PostgREST `.or()`-filter
 * (bv. `name.ilike.%${term}%`). Komma's, haakjes, dubbele quotes en
 * backslashes zijn daar gereserveerd en breken de query ("Doe, John" of
 * "(test)" gaf een fout). We vervangen ze door `_`, de ilike-joker voor
 * precies één teken: "Doe, John" vindt dus nog steeds "Doe, John".
 * Enkele quotes zijn niet gereserveerd en blijven staan (O'Brien).
 */
export function sanitizeOrSearch(term: string | null | undefined): string {
  if (!term) return '';
  return term.replace(/[,()"\\]/g, '_').trim();
}
