import { vi } from 'vitest';

/**
 * Creates a chainable Supabase query builder mock.
 * Each method returns `this` for chaining, and the final call
 * (select, insert, update, upsert, delete, maybeSingle, single)
 * resolves with the configured data.
 */
export function createQueryBuilder(resolveData: unknown = null, resolveError: unknown = null, resolveCount: number | null = null) {
  const builder: Record<string, any> = {};
  const chainMethods = [
    'select', 'insert', 'update', 'upsert', 'delete',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in',
    'or', 'not', 'is', 'order', 'limit', 'range',
    'head', 'csv',
  ];

  const result = { data: resolveData, error: resolveError, count: resolveCount };

  for (const method of chainMethods) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }

  // Terminal methods return the result
  builder.single = vi.fn().mockResolvedValue(result);
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  builder.then = vi.fn((resolve: Function) => resolve(result));

  // Make the builder itself thenable (for await)
  const proxy = new Proxy(builder, {
    get(target, prop) {
      if (prop === 'then') {
        return (resolve: Function) => resolve(result);
      }
      return target[prop as string];
    },
  });

  return proxy;
}

/**
 * Creates a mock Supabase client with configurable table responses.
 */
export function createMockSupabase(tableResponses: Record<string, { data?: unknown; error?: unknown; count?: number | null }> = {}) {
  const fromMock = vi.fn((table: string) => {
    const response = tableResponses[table] || { data: null, error: null, count: null };
    return createQueryBuilder(response.data, response.error, response.count);
  });

  const functionsInvokeMock = vi.fn().mockResolvedValue({ data: null, error: null });

  const authGetUserMock = vi.fn().mockResolvedValue({
    data: { user: { id: 'user-1', email: 'test@test.com' } },
    error: null,
  });

  return {
    from: fromMock,
    functions: { invoke: functionsInvokeMock },
    auth: { getUser: authGetUserMock },
    // Helpers for test assertions
    _fromMock: fromMock,
    _functionsInvokeMock: functionsInvokeMock,
    _authGetUserMock: authGetUserMock,
  };
}

/**
 * Mock the supabase import for hook tests.
 * Call this before importing the hook under test.
 */
export function mockSupabaseModule(mockClient: ReturnType<typeof createMockSupabase>) {
  vi.mock('@/integrations/supabase/client', () => ({
    supabase: mockClient,
  }));
}
