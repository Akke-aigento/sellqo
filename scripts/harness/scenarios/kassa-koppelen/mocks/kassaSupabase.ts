// KASSA-MOBIEL-1 — de kassa-client in het harnas: dezelfde nep-Supabase (aanroepen in window.__calls, met
// client 'kassa' erbij zodat de test ziet welke client wat deed).
import { supabase } from './supabase';
const w = window as unknown as { __calls: { name: string; client?: string }[] };
export const KASSA_AUTH_STORAGE_KEY = 'sb-sellqo-kassa-auth';
export const defaultAuthStorageKey = () => 'sb-gczmfcabnoofnmfpzeop-auth-token';
export const kassaSupabase = {
  ...supabase,
  functions: { invoke: async (name: string, opts: { body: Record<string, unknown> }) => { const r = await supabase.functions.invoke(name, opts); w.__calls[w.__calls.length - 1].client = 'kassa'; return r; } },
  auth: { signInWithPassword: async (c: unknown) => { const r = await supabase.auth.signInWithPassword(c); w.__calls[w.__calls.length - 1].client = 'kassa'; return r; } },
};
