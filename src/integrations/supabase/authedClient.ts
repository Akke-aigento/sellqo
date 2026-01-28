/**
 * Creates a Supabase client with an explicit Authorization header.
 * Use this for critical writes where we need to guarantee the token is sent.
 * 
 * This bypasses any potential issues with supabase-js not sending the token
 * due to timing/internal state issues.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Creates a Supabase client that explicitly includes the Authorization header.
 * This ensures the Bearer token is always sent, regardless of library internal state.
 * 
 * @param accessToken - The JWT access token from a verified session
 * @returns A Supabase client configured with explicit auth headers
 */
export function getAuthedClient(accessToken: string): SupabaseClient<Database> {
  if (!accessToken) {
    throw new Error('getAuthedClient requires a valid access token');
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
