// BETAAL-1 — betaalinstellingen van de zaak (Kassa › Betalen in het beheer, tabel horeca_pay_settings).
//
// De kassa leest ze bij het openen en bewaart de laatste stand per winkel lokaal, zodat afrekenen
// ook zonder netwerk dezelfde knoppen toont. Geen rij = de standaard: cash + overschrijving, geen
// terminal, fooi aan (het profiel van een zaak zonder betaalterminal).
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
// KASSA-MOBIEL-1: de kassa-client (eigen sessie van het toestel), niet de beheer-sessie.
import { kassaSupabase as supabase } from '@/kassa/app/kassaSupabase';
import type { TenderMethod, TipMethod } from './pay';
import { DEFAULT_LOCK_MINUTES, normalizeLockMinutes } from './kassaUx';
import { DEFAULT_COURSE_SETTINGS, normalizeCourseSettings, type CourseSettings } from './courses';

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

/**
 * KASSA-UX-6 — na hoeveel minuten zonder aanraking de kassa op het PIN-scherm valt (0 = nooit),
 * ingesteld in Kassa › Personeel (horeca_pay_settings.kassa_lock_minutes). Een eigen query: ontbreekt de
 * kolom nog (migratie niet gedraaid) of is er geen netwerk, dan blijft de vorige waarde of 2 minuten
 * en het afrekenen lijdt er niet onder.
 */
export function useKassaLockMinutes(tenantId: string | undefined): number {
  const key = tenantId ? `sq_kassa_lock_minutes:${tenantId}` : null;
  const cached = useMemo(() => {
    if (!key) return null;
    try { const raw = localStorage.getItem(key); return raw === null ? null : normalizeLockMinutes(raw); } catch { return null; }
  }, [key]);
  const { data } = useQuery({
    queryKey: ['kassa-lock-minutes', tenantId],
    enabled: !!tenantId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: row, error } = await supabase.from('horeca_pay_settings' as never)
        .select('kassa_lock_minutes').eq('tenant_id' as never, tenantId as never).maybeSingle();
      if (error) throw error;
      const v = normalizeLockMinutes((row as { kassa_lock_minutes?: number } | null)?.kassa_lock_minutes ?? DEFAULT_LOCK_MINUTES);
      try { localStorage.setItem(key!, String(v)); } catch { /* geen opslag */ }
      return v;
    },
  });
  return data ?? cached ?? DEFAULT_LOCK_MINUTES;
}

/**
 * GANGEN-1 — gangen aan/uit en de standaardgang per categorie (horeca_pay_settings, Bestellen › Posten).
 * Standaard uit. Zoals de vergrendeltijd: eigen query met een lokale kopie, zodat een ontbrekende kolom of
 * geen netwerk de kassa nooit tegenhoudt (dan gewoon zonder gangen).
 */
export function useKassaCourseSettings(tenantId: string | undefined): CourseSettings {
  const key = tenantId ? `sq_kassa_courses:${tenantId}` : null;
  const cached = useMemo(() => {
    if (!key) return null;
    try { const raw = localStorage.getItem(key); return raw ? normalizeCourseSettings(JSON.parse(raw)) : null; } catch { return null; }
  }, [key]);
  const { data } = useQuery({
    queryKey: ['kassa-course-settings', tenantId],
    enabled: !!tenantId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: row, error } = await supabase.from('horeca_pay_settings' as never)
        .select('courses_enabled, course_by_category').eq('tenant_id' as never, tenantId as never).maybeSingle();
      if (error) throw error;
      const r = row as { courses_enabled?: boolean; course_by_category?: unknown } | null;
      try { localStorage.setItem(key!, JSON.stringify(r ?? {})); } catch { /* geen opslag */ }
      return normalizeCourseSettings(r);
    },
  });
  return data ?? cached ?? DEFAULT_COURSE_SETTINGS;
}
