// HORECA-INSTELLINGEN-1: useHorecaStatus leest normalizePaySettings uit de kassa; die module laadt de kassa-client.
export { supabase as kassaSupabase } from './supabase';
export const KASSA_AUTH_STORAGE_KEY = 'sb-sellqo-kassa-auth';
export const defaultAuthStorageKey = () => 'sb-test-auth-token';
