// PLANS-2 — add-ons (webshop, horeca, events) uit public.platform_addons: één bron voor
// prijzenpagina, teksten en (later) de facturatie.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PlatformAddon {
  id: string;
  name: string;
  track: 'webshop' | 'horeca' | 'events';
  monthly_price: number;
  yearly_price: number;
  ticket_fee: number;
  active: boolean;
  sort_order: number;
}

export function usePlatformAddons() {
  const { data, isLoading } = useQuery({
    queryKey: ['platform-addons'],
    queryFn: async () => {
      // De tabel staat nog niet in de gegenereerde types; de vorm staat hierboven.
      const { data, error } = await (supabase as unknown as {
        from: (t: string) => { select: (c: string) => { eq: (k: string, v: boolean) => { order: (c: string) => Promise<{ data: PlatformAddon[] | null; error: unknown }> } } };
      }).from('platform_addons').select('*').eq('active', true).order('sort_order');
      if (error) throw error;
      return (data ?? []).map((a) => ({ ...a, monthly_price: Number(a.monthly_price), yearly_price: Number(a.yearly_price), ticket_fee: Number(a.ticket_fee) }));
    },
    staleTime: 5 * 60 * 1000,
  });
  return { addons: data ?? [], isLoading };
}
