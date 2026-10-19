import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import {
  buildAutomationPresetsPayload, PRESET_KEYS, PRESET_LANGS, PRESET_STEP_KEYS,
  type AutomationPresetKey, type PresetLang,
} from '@/lib/marketing/automationPresets';

/**
 * MAIL-2a — e-mailautomations (Marketing → Automatiseringen).
 *
 * Model (migratie 20261019230000_mail_2a_automations.sql):
 * - email_automations: één rij per preset_key per winkel; win-back-dagen in trigger_config.days.
 * - automation_steps: volgorde, wachttijd (delay_hours/minutes), actief. De wachttijd van de
 *   winkelwagenherinnering is de delay van stap 1.
 * - De inhoud van een stap staat in zijn verborgen systeemcampagne: email_campaigns met
 *   kind = 'automation' en automation_step_id = stap. NL in de hoofdvelden, andere talen in
 *   translations; de worker gebruikt translations enkel als available_languages > 1 taal heeft.
 * - automation_ensure_presets(p_tenant, p_presets) maakt ontbrekende presets aan (uit).
 *
 * De nieuwe kolommen staan nog niet in de gegenereerde types; één getypte omweg in plaats
 * van `any`, zoals useMarketingContacts.ts.
 */
export type { AutomationPresetKey, PresetLang };
export type AutomationRunStatus = 'scheduled' | 'running' | 'completed' | 'skipped' | 'failed' | 'cancelled';

export interface StepContent { subject?: string; preview_text?: string; html_content?: string }

export interface AutomationStepView {
  id: string;
  automation_id: string;
  step_order: number;
  step_key: string;
  delay_hours: number | null;
  delay_minutes: number | null;
  is_active: boolean | null;
  campaign_id: string | null;
  available_languages: string[];
  /** Inhoud per taal (nl uit de hoofdvelden). */
  content: Partial<Record<PresetLang, StepContent>>;
}

export interface EmailAutomationView {
  id: string;
  name: string;
  is_active: boolean;
  preset_key: AutomationPresetKey;
  trigger_config: Record<string, unknown> | null;
  total_sent: number | null;
  total_runs: number | null;
  total_completed: number | null;
  steps: AutomationStepView[];
}

export interface AutomationRun {
  id: string;
  automation_id: string;
  status: AutomationRunStatus;
  current_step: number | null;
  next_step_id: string | null;
  scheduled_for: string | null;
  recipient_email: string | null;
  created_at: string;
}

type DbResult = { data: unknown; error: { message: string } | null };
interface LooseQuery extends PromiseLike<DbResult> {
  select: (cols: string) => LooseQuery;
  update: (values: Record<string, unknown>) => LooseQuery;
  eq: (col: string, value: unknown) => LooseQuery;
  in: (col: string, values: unknown[]) => LooseQuery;
  not: (col: string, op: string, value: unknown) => LooseQuery;
  order: (col: string, opts?: { ascending?: boolean }) => LooseQuery;
  limit: (n: number) => LooseQuery;
}
const from = supabase.from.bind(supabase) as unknown as (table: string) => LooseQuery;
type RpcFn = (fn: string, args: Record<string, unknown>) => Promise<DbResult>;
const rpc = supabase.rpc.bind(supabase) as unknown as RpcFn;

async function run<T>(q: PromiseLike<DbResult>): Promise<T> {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data as T;
}

interface AutomationRow extends Omit<EmailAutomationView, 'steps'> { tenant_id: string }
interface StepRow { id: string; automation_id: string; step_order: number; delay_hours: number | null; delay_minutes: number | null; is_active: boolean | null }
interface CampaignRow {
  id: string; automation_step_id: string; subject: string | null; preview_text: string | null;
  html_content: string | null; translations: Record<string, StepContent> | null; available_languages: string[] | null;
}

export function useEmailAutomations() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  return useQuery({
    queryKey: ['email-automations', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const automations = (await run<AutomationRow[]>(
        from('email_automations')
          .select('id, tenant_id, name, is_active, preset_key, trigger_config, total_sent, total_runs, total_completed')
          .eq('tenant_id', tenantId)
          .in('preset_key', PRESET_KEYS),
      )) || [];
      const ids = automations.map((a) => a.id);
      const steps = ids.length
        ? (await run<StepRow[]>(
            from('automation_steps')
              .select('id, automation_id, step_order, delay_hours, delay_minutes, is_active')
              .in('automation_id', ids)
              .order('step_order', { ascending: true }),
          )) || []
        : [];
      const stepIds = steps.map((s) => s.id);
      const campaigns = stepIds.length
        ? (await run<CampaignRow[]>(
            from('email_campaigns')
              .select('id, automation_step_id, subject, preview_text, html_content, translations, available_languages')
              .eq('tenant_id', tenantId)
              .eq('kind', 'automation')
              .in('automation_step_id', stepIds),
          )) || []
        : [];

      const byKey: Partial<Record<AutomationPresetKey, EmailAutomationView>> = {};
      for (const a of automations) {
        const own = steps.filter((s) => s.automation_id === a.id);
        byKey[a.preset_key] = {
          ...a,
          steps: own.map((s) => {
            const c = campaigns.find((x) => x.automation_step_id === s.id);
            const content: Partial<Record<PresetLang, StepContent>> = {};
            if (c) {
              content.nl = { subject: c.subject || '', preview_text: c.preview_text || '', html_content: c.html_content || '' };
              for (const l of PRESET_LANGS) if (l !== 'nl' && c.translations?.[l]) content[l] = c.translations[l];
            }
            return {
              ...s,
              step_key: PRESET_STEP_KEYS[a.preset_key]?.[s.step_order] ?? 'unknown',
              campaign_id: c?.id ?? null,
              available_languages: c?.available_languages?.length ? c.available_languages : ['nl'],
              content,
            };
          }),
        };
      }
      return byKey;
    },
  });
}

export function useAutomationRuns() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  return useQuery({
    queryKey: ['automation-runs', tenantId],
    enabled: !!tenantId,
    queryFn: () =>
      run<AutomationRun[]>(
        from('automation_runs')
          .select('id, automation_id, status, current_step, next_step_id, scheduled_for, recipient_email, created_at')
          .eq('tenant_id', tenantId)
          .not('recipient_email', 'is', null)
          .order('created_at', { ascending: false })
          .limit(50),
      ).then((rows) => rows || []),
  });
}

export function useEmailAutomationActions() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['email-automations'] });

  /** Aan/uit. Bestaat de preset nog niet, dan eerst aanmaken (idempotent, standaard uit). */
  const setActive = useMutation({
    mutationFn: async (input: { presetKey: AutomationPresetKey; automationId?: string; active: boolean }) => {
      let id = input.automationId;
      if (!id) {
        await run(rpc('automation_ensure_presets', {
          p_tenant: tenantId,
          p_presets: buildAutomationPresetsPayload([input.presetKey]),
        }));
        const rows = await run<{ id: string }[]>(
          from('email_automations').select('id').eq('tenant_id', tenantId).eq('preset_key', input.presetKey).limit(1),
        );
        id = rows?.[0]?.id;
      }
      if (!id) throw new Error('automation_ensure_presets: preset niet gevonden');
      await run(from('email_automations').update({ is_active: input.active }).eq('id', id));
    },
    onSettled: invalidate,
  });

  /** Win-back: aantal dagen zonder bestelling (trigger_config.days). */
  const setWinBackDays = useMutation({
    mutationFn: async (input: { automation: EmailAutomationView; days: number }) => {
      await run(from('email_automations')
        .update({ trigger_config: { ...(input.automation.trigger_config || {}), days: input.days } })
        .eq('id', input.automation.id));
    },
    onSettled: invalidate,
  });

  /** Wachttijd van een stap in uren (ook de winkelwagenvertraging: stap 1). */
  const setStepDelay = useMutation({
    mutationFn: async (input: { stepId: string; hours: number }) => {
      await run(from('automation_steps').update({ delay_hours: input.hours, delay_minutes: 0 }).eq('id', input.stepId));
    },
    onSettled: invalidate,
  });

  /** Stap opslaan: actief en wachttijd op de stap, inhoud op de systeemcampagne. */
  const saveStep = useMutation({
    mutationFn: async (input: {
      step: AutomationStepView;
      content: Partial<Record<PresetLang, StepContent>>;
      is_active: boolean;
      delay_hours?: number;
    }) => {
      const stepValues: Record<string, unknown> = { is_active: input.is_active };
      if (input.delay_hours !== undefined) Object.assign(stepValues, { delay_hours: input.delay_hours, delay_minutes: 0 });
      await run(from('automation_steps').update(stepValues).eq('id', input.step.id));

      if (!input.step.campaign_id) return;
      const nl = input.content.nl || {};
      const translations: Record<string, StepContent> = {};
      const langs: string[] = ['nl'];
      for (const l of PRESET_LANGS) {
        if (l === 'nl') continue;
        const v = input.content[l];
        if (v && (v.subject || v.html_content)) {
          translations[l] = {
            subject: v.subject || nl.subject,
            preview_text: v.preview_text || nl.preview_text,
            html_content: v.html_content || nl.html_content,
          };
          langs.push(l);
        }
      }
      await run(from('email_campaigns').update({
        subject: nl.subject || '',
        preview_text: nl.preview_text || null,
        html_content: nl.html_content || '',
        translations,
        available_languages: langs,
      }).eq('id', input.step.campaign_id));
    },
    onSettled: invalidate,
  });

  return { setActive, setWinBackDays, setStepDelay, saveStep };
}
