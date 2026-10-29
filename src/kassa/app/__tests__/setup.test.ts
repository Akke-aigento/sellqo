// KASSA-START-1 — knop "Kassa aanmaken" enkel voor wie het volgens de RLS mag.
import { describe, expect, it } from 'vitest';
import { canCreateTerminal } from '../setup';

describe('canCreateTerminal', () => {
  it('zaakvoerder van deze zaak mag', () => {
    expect(canCreateTerminal([{ role: 'tenant_admin', tenant_id: 't1' }], 't1', false)).toBe(true);
  });
  it('zaakvoerder van een andere zaak of personeel mag niet', () => {
    expect(canCreateTerminal([{ role: 'tenant_admin', tenant_id: 't2' }], 't1', false)).toBe(false);
    expect(canCreateTerminal([{ role: 'staff', tenant_id: 't1' }], 't1', false)).toBe(false);
    expect(canCreateTerminal(null, 't1', false)).toBe(false);
  });
  it('platformbeheer mag altijd', () => {
    expect(canCreateTerminal([], 't1', true)).toBe(true);
  });
});
