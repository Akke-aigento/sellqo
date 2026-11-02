// KASSA-MOBIEL-1 — de kassa heeft een eigen Supabase-client met een eigen sessie (storageKey), los van beheer.
// Zo kunnen kassa en beheer naast elkaar op hetzelfde toestel en in dezelfde browser draaien: de eigenaar blijft
// aangemeld in beheer, het toestel blijft gekoppeld in de kassa, en afmelden of ontkoppelen aan de ene kant raakt
// de andere nooit.
//
// Zelfde URL en publishable key als de gegenereerde client (src/integrations/supabase/client.ts, die we niet
// wijzigen: Lovable genereert hem). Geen brokered preview-opslag: de kassa-sessie hoort enkel op dit toestel.
// detectSessionInUrl uit: een #access_token of ?code= in de URL is voor beheer (wachtwoord-reset, uitnodiging).
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

/** Sleutel van de kassa-sessie in localStorage. Nooit wijzigen: dan staat elk gekoppeld toestel ontkoppeld. */
export const KASSA_AUTH_STORAGE_KEY = 'sb-sellqo-kassa-auth';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

/** Sleutel die supabase-js standaard gebruikt (sb-<projectref>-auth-token): daar staat de beheer-sessie, en daar
 *  stond tot KASSA-MOBIEL-1 ook de sessie van een gekoppeld toestel. */
export function defaultAuthStorageKey(url: string = SUPABASE_URL): string {
  try {
    return `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
  } catch {
    return 'sb-gczmfcabnoofnmfpzeop-auth-token';
  }
}

export const kassaSupabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storageKey: KASSA_AUTH_STORAGE_KEY,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
