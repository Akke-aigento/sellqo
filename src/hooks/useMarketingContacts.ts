import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { invokeWithErrorBody } from '@/lib/invokeWithErrorBody';

/**
 * MAIL-1b — marketingcontacten van de winkel (tab Abonnees in Marketing → E-mail).
 *
 * Bron: de RPC's uit migratie 20261019220000_mail_1b_subscribers.sql. Die voegen
 * customers (email_subscribed), wachtende newsletter_subscribers en
 * email_unsubscribes samen met dezelfde regels als de verzending.
 */
export type ContactStatus = 'subscribed' | 'pending' | 'unsubscribed' | 'bounced' | 'complaint';
export type ContactStatusFilter = 'all' | ContactStatus;

export interface MarketingContact {
  email: string;
  name: string | null;
  status: ContactStatus;
  source: string | null;
  status_at: string | null;
  customer_id: string | null;
  total_count: number;
}

export const CONTACTS_PAGE_SIZE = 50;

// De nieuwe functies staan nog niet in de gegenereerde types (types.ts wordt
// pas na de migratie geregenereerd); één getypte omweg in plaats van `any`.
type RpcFn = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc = supabase.rpc.bind(supabase) as unknown as RpcFn;

export function useMarketingContacts(params: { status: ContactStatusFilter; search: string; page: number }) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  return useQuery({
    queryKey: ['marketing-contacts', tenantId, params.status, params.search, params.page],
    enabled: !!tenantId,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await rpc('marketing_contacts', {
        p_tenant: tenantId,
        p_status: params.status,
        p_search: params.search || null,
        p_limit: CONTACTS_PAGE_SIZE,
        p_offset: params.page * CONTACTS_PAGE_SIZE,
      });
      if (error) throw new Error(error.message);
      const rows = (data as MarketingContact[]) || [];
      return { rows, total: rows.length ? Number(rows[0].total_count) : 0 };
    },
  });
}

/** Alle rijen van de huidige filter, voor de CSV-export (per 1000). */
export async function fetchAllMarketingContacts(tenantId: string, status: ContactStatusFilter, search: string) {
  const out: MarketingContact[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await rpc('marketing_contacts', {
      p_tenant: tenantId, p_status: status, p_search: search || null, p_limit: 1000, p_offset: offset,
    });
    if (error) throw new Error(error.message);
    const rows = (data as MarketingContact[]) || [];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

export function useMarketingContactCounts() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  return useQuery({
    queryKey: ['marketing-contact-counts', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await rpc('marketing_contact_counts', { p_tenant: tenantId });
      if (error) throw new Error(error.message);
      const counts: Record<ContactStatus, number> = { subscribed: 0, pending: 0, unsubscribed: 0, bounced: 0, complaint: 0 };
      for (const r of (data as { status: ContactStatus; total: number }[]) || []) counts[r.status] = Number(r.total);
      return counts;
    },
  });
}

export interface InviteResult {
  invited: number;
  resent: number;
  failed: number;
  // recent: wacht al op bevestiging en kreeg de laatste 7 dagen een mail (MAIL-1b-fix).
  skipped: { active: number; unsubscribed: number; invalid: number; duplicate: number; recent?: number };
}

export function useMarketingContactActions() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['marketing-contacts'] });
    queryClient.invalidateQueries({ queryKey: ['marketing-contact-counts'] });
    queryClient.invalidateQueries({ queryKey: ['marketing-stats'] });
  };

  const unsubscribe = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await rpc('marketing_unsubscribe_contact', { p_tenant: currentTenant?.id, p_email: email });
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  const erase = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await rpc('marketing_erase_contact', { p_tenant: currentTenant?.id, p_email: email });
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  const invite = useMutation({
    mutationFn: async (input: { emails: string[]; language?: string; consent: boolean }) =>
      invokeWithErrorBody<InviteResult>('newsletter-invite', {
        body: { tenant_id: currentTenant?.id, emails: input.emails, language: input.language, consent: input.consent },
      }),
    onSuccess: invalidate,
  });

  return { unsubscribe, erase, invite };
}

/** Haalt e-mailadressen uit vrije tekst of een CSV (komma, puntkomma, regels, tabs). */
export function parseEmailList(text: string): string[] {
  const found = text.match(/[^\s,;<>"'()[\]]+@[^\s,;<>"'()[\]]+\.[^\s,;<>"'()[\]]+/g) || [];
  return Array.from(new Set(found.map((e) => e.trim().toLowerCase())));
}
