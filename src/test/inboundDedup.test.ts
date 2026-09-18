import { describe, expect, it, vi } from 'vitest';
import { findExistingInbound, isUniqueViolation } from '../../supabase/functions/_shared/inboundDedup.ts';

// APP-INBOX-CRASH-1: een Resend-replay gaf op 18-09 een tweede rij en een
// tweede melding. Bestaande resend_id → duplicaat, geen insert.

function fakeClient(result: { data: { id: string } | null; error: unknown }) {
  const filters: Array<[string, unknown]> = [];
  const insert = vi.fn();
  const chain = {
    select: () => chain,
    eq: (col: string, val: unknown) => { filters.push([col, val]); return chain; },
    limit: () => chain,
    maybeSingle: async () => result,
    insert,
  };
  return { client: { from: () => chain }, filters, insert };
}

describe('findExistingInbound', () => {
  it('bestaande resend_id → id van de bestaande rij, geen insert', async () => {
    const { client, filters, insert } = fakeClient({ data: { id: 'eff89884' }, error: null });
    expect(await findExistingInbound(client, 'd92eab7d')).toBe('eff89884');
    expect(filters).toEqual([['direction', 'inbound'], ['resend_id', 'd92eab7d']]);
    expect(insert).not.toHaveBeenCalled();
  });
  it('nieuwe resend_id → null (verwerken)', async () => {
    const { client } = fakeClient({ data: null, error: null });
    expect(await findExistingInbound(client, 'nieuw')).toBeNull();
  });
  it('geen email_id → null, zonder query', async () => {
    const { client, filters } = fakeClient({ data: { id: 'x' }, error: null });
    expect(await findExistingInbound(client, undefined)).toBeNull();
    expect(filters).toEqual([]);
  });
  it('lookup faalt → null: liever verwerken dan een klantmail missen', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { client } = fakeClient({ data: null, error: { message: 'timeout' } });
    expect(await findExistingInbound(client, 'd92eab7d')).toBeNull();
  });
});

describe('isUniqueViolation', () => {
  it('23505 → duplicaat', () => expect(isUniqueViolation({ code: '23505' })).toBe(true));
  it('andere fout → geen duplicaat', () => {
    expect(isUniqueViolation({ code: '42501' })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});
