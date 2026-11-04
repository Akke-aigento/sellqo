// KASSA-MOBIEL-1 — de kassa praat via haar eigen client; in het harnas dezelfde nep-Supabase.
export { supabase as kassaSupabase } from './supabase';
export const KASSA_AUTH_STORAGE_KEY = 'sb-sellqo-kassa-auth';
export const defaultAuthStorageKey = () => 'sb-gczmfcabnoofnmfpzeop-auth-token';
