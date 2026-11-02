// KASSA-MOBIEL-1 — welke Supabase-client (en dus welke sessie) een gedeelde hook gebruikt.
//
// Beheer en kassa hebben elk een eigen aanmelding: beheer de gegenereerde client
// (@/integrations/supabase/client, standaard-storageKey), de kassa een eigen client met een eigen
// storageKey (src/kassa/app/kassaSupabase.ts). Gedeelde hooks en componenten (zaalplan, keukenbord,
// bereidingsposten, printerstatus, meldingen op dit toestel) vragen hun client hier op. Zonder provider
// is dat altijd de beheer-client: beheer verandert dus niet.
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type Db = SupabaseClient<Database>;

/** Met welke account en client "Meldingen aanzetten" op dit toestel inschrijft. */
export interface PushIdentity {
  db: Db;
  userId: string | null;
  /** Service-worker-scope voor web push: een eigen inschrijving per omgeving, zodat de kassa-account en de
   *  beheer-account in dezelfde browser elk een eigen push-endpoint hebben. Leeg = '/' (beheer). */
  scope?: string;
}

export interface SupabaseScope {
  /** De client van deze omgeving (kassa of beheer). */
  client: Db;
  /** De aangemelde gebruiker van díe client (de toestelaccount in de kassa). */
  userId: string | null;
  /** Push op dit toestel. In de SellQo-app (native) is er één pushtoken per installatie, en dat hoort bij beheer
   *  als daar iemand aangemeld is; in de aparte Kassa-app en op het web bij de kassa. */
  push: PushIdentity;
}

const SupabaseScopeContext = createContext<SupabaseScope | null>(null);

export function SupabaseScopeProvider({ client, userId, push, children }: SupabaseScope & { children: ReactNode }) {
  const value = useMemo(() => ({ client, userId, push }), [client, userId, push]);
  return <SupabaseScopeContext.Provider value={value}>{children}</SupabaseScopeContext.Provider>;
}

/** De omgeving (kassa) of null in beheer. */
export function useSupabaseScope(): SupabaseScope | null {
  return useContext(SupabaseScopeContext);
}

/** De client voor deze plek: de kassa-client binnen de kassa, anders de beheer-client. */
export function useSupabaseClient(): Db {
  return useContext(SupabaseScopeContext)?.client ?? supabase;
}
