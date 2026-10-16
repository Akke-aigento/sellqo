/* eslint-disable @typescript-eslint/no-explicit-any -- testharnas: ongetypeerde databankrijen */
// SEC-DOMAIN-2 — createClient geeft de nep-databank terug die de test op globalThis zet.
export const createClient: any = () => (globalThis as any).__fakeDb; export type SupabaseClient = any;
