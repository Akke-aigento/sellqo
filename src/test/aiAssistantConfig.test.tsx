import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { resolveAIConfig, DEFAULT_AI_ASSISTANT_CONFIG, isPersistedConfig } from '@/lib/aiAssistantConfig';
import type { AIAssistantConfig } from '@/types/ai-assistant';

// APP-INBOX-CRASH-1: een leespad schrijft niet. Ontbrekend of onleesbaar = defaults.

const TENANT = '54f6b480-280b-42e1-b843-d5beb2831acd';

const calls = { select: 0, insert: 0, upsert: 0, update: 0 };
let selectResult: { data: unknown; error: unknown } = { data: null, error: null };

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => {
        calls.select++;
        const chain = {
          eq: () => chain,
          maybeSingle: async () => selectResult,
          then: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
        };
        return chain;
      },
      insert: () => { calls.insert++; return { select: () => ({ single: async () => ({}) }) }; },
      upsert: async () => { calls.upsert++; return { error: null }; },
      update: () => { calls.update++; return { eq: async () => ({ error: null }) }; },
    }),
    functions: { invoke: async () => ({ error: null }) },
  },
}));
vi.mock('@/hooks/useTenant', () => ({ useTenant: () => ({ currentTenant: { id: TENANT } }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

const { useAIAssistant } = await import('@/hooks/useAIAssistant');

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const row = { ...DEFAULT_AI_ASSISTANT_CONFIG, id: 'cfg-1', tenant_id: TENANT, chatbot_enabled: true } as AIAssistantConfig;

describe('resolveAIConfig', () => {
  it('(a) rij aanwezig → die rij', () => {
    expect(resolveAIConfig(TENANT, row, null)).toBe(row);
  });
  it('(b) 0 rijen → defaults voor deze winkel, niet opgeslagen', () => {
    const cfg = resolveAIConfig(TENANT, null, null);
    expect(cfg.tenant_id).toBe(TENANT);
    expect(cfg.reply_suggestions_auto_generate).toBe(false);
    expect(isPersistedConfig(cfg)).toBe(false);
  });
  it('(c) fout (RLS 42501) → defaults', () => {
    const cfg = resolveAIConfig(TENANT, null, { code: '42501' });
    expect(cfg).toEqual({ ...DEFAULT_AI_ASSISTANT_CONFIG, tenant_id: TENANT });
  });
});

describe('useAIAssistant — geen write in het leespad', () => {
  beforeEach(() => {
    Object.assign(calls, { select: 0, insert: 0, upsert: 0, update: 0 });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it.each([
    ['config aanwezig', { data: row, error: null }, 'cfg-1'],
    ['0 rijen', { data: null, error: null }, ''],
    ['fout', { data: null, error: { code: '42501', message: 'rls' } }, ''],
  ])('%s → config zonder insert/upsert en zonder herhaalde renders', async (_label, result, expectedId) => {
    selectResult = result;
    let renders = 0;
    const { result: hook } = renderHook(() => { renders++; return useAIAssistant(); }, { wrapper });
    await waitFor(() => expect(hook.current.isLoading).toBe(false));
    const rendersAfterLoad = renders;
    await new Promise(r => setTimeout(r, 50));

    expect(hook.current.config?.id).toBe(expectedId);
    expect(hook.current.config?.tenant_id).toBe(TENANT);
    expect(calls.insert).toBe(0);
    expect(calls.upsert).toBe(0);
    expect(renders).toBe(rendersAfterLoad);
    expect(renders).toBeLessThan(10);
  });
});
