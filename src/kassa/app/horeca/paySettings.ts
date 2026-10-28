// BETAAL-1 — betaalinstellingen van de zaak (Kassa › Betalen in het beheer, tabel horeca_pay_settings).
//
// De kassa leest ze bij het openen en bewaart de laatste stand per winkel lokaal, zodat afrekenen
// ook zonder netwerk dezelfde knoppen toont. Geen rij = de standaard: cash + overschrijving, geen
// terminal, fooi aan (het profiel van een zaak zonder betaalterminal).
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TenderMethod, TipMethod } from './pay';

export type TerminalMode = 'none' | 'standalone';
export type SettingMethod = 'cash' | 'transfer' | 'card' | 'cheque_meal' | 'voucher';
export const SETTING_METHODS: SettingMethod[] = ['cash', 'transfer', 'card', 'cheque_meal', 'voucher'];

/** PRINT-2: mail_button = knop "Mail bon" op het afrekenscherm (standaard aan; de kassa vraagt nooit zelf). */
export interface PaySettings { methods: SettingMethod[]; terminal: TerminalMode; kassa_tip: boolean; mail_button?: boolean }
export const DEFAULT_PAY_SETTINGS: PaySettings = { methods: ['cash', 'transfer'], terminal: 'none', kassa_tip: true, mail_button: true };

/** Normaliseer een rij uit de database (of een cache) tot geldige instellingen. */
export function normalizePaySettings(row: Partial<PaySettings> | null | undefined): PaySettings {
  if (!row) return DEFAULT_PAY_SETTINGS;
  const methods = (row.methods ?? []).filter((m): m is SettingMethod => (SETTING_METHODS as string[]).includes(m));
  return {
    methods: methods.length ? methods : DEFAULT_PAY_SETTINGS.methods,
    terminal: row.terminal === 'standalone' ? 'standalone' : 'none',
    kassa_tip: row.kassa_tip !== false,
    mail_button: row.mail_button !== false,
  };
}

/** De betaalwijzen die de kassa toont, in vaste volgorde. Kaart enkel met een terminal. */
export function availableTenders(s: PaySettings): TenderMethod[] {
  return SETTING_METHODS.filter((m) => s.methods.includes(m) && (m !== 'card' || s.terminal !== 'none'));
}

/** Fooi kan via cash, kaart of overschrijving — enkel wat de zaak aanbiedt. */
export function availableTipMethods(s: PaySettings): TipMethod[] {
  if (!s.kassa_tip) return [];
  return availableTenders(s).filter((m): m is TipMethod => m === 'cash' || m === 'card' || m === 'transfer');
}

const cacheKey = (tenantId: string) => `sq_kassa_pay_settings:${tenantId}`;
function readCache(tenantId: string): PaySettings | null {
  try { const raw = localStorage.getItem(cacheKey(tenantId)); return raw ? normalizePaySettings(JSON.parse(raw)) : null; } catch { return null; }
}
function writeCache(tenantId: string, s: PaySettings) {
  try { localStorage.setItem(cacheKey(tenantId), JSON.stringify(s)); } catch { /* opslag vol of uit: geen ramp */ }
}

export function useKassaPaySettings(tenantId: string | undefined): PaySettings {
  // Review B1: de cache één keer per winkel lezen. Telkens opnieuw parsen gaf bij elke render een
  // nieuw object en liet het afrekenvenster in een renderlus draaien (offline, bij een fout, tijdens laden).
  const cached = useMemo(() => (tenantId ? readCache(tenantId) : null), [tenantId]);
  const { data } = useQuery({
    queryKey: ['kassa-pay-settings', tenantId],
    enabled: !!tenantId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: row, error } = await supabase.from('horeca_pay_settings' as never)
        .select('methods, terminal, kassa_tip, mail_button').eq('tenant_id' as never, tenantId as never).maybeSingle();
      if (error) throw error;
      const s = normalizePaySettings(row as Partial<PaySettings> | null);
      writeCache(tenantId!, s);
      return s;
    },
  });
  return data ?? cached ?? DEFAULT_PAY_SETTINGS;
}
