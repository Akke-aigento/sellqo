// PERSONEEL-1 — kassa-runtime: fiscale modus, bedrijfsperiode, tellers, in/uitklokken.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const inserts: { table: string; row: Record<string, unknown> }[] = [];
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => ({
      insert: async (row: Record<string, unknown>) => { inserts.push({ table, row }); return { error: null }; },
    }),
  },
}));

import { bookingPeriodIdFor, fiscalSettingsOf, KassaRuntime, takeTicketNo, FiscalUnavailableError } from '../runtime';
import { clock, isClockedIn } from '../attendance';
import { isLowerGuid } from '../../fiscal/identity';

const device = { tenantId: '11111111-1111-1111-1111-111111111111', terminalRowId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', deviceUuid: '1631678d-7a85-4ac3-b296-bb4565e873fe' };
const fiscalSim = { mode: 'simulator' as const, vatNo: 'BE0000000097', estNo: '2000000042', posId: 'CPOS0031234567', terminalId: 'TER-2-DIN' };

beforeEach(() => { inserts.length = 0; localStorage.clear(); });

describe('fiscale instellingen', () => {
  it('alles wat ontbreekt of onbekend is = niet-fiscaal', () => {
    expect(fiscalSettingsOf(null).mode).toBe('off');
    expect(fiscalSettingsOf({ fiscal: { mode: 'raar' } }).mode).toBe('off');
    expect(fiscalSettingsOf({ fiscal: { mode: 'simulator' } }).mode).toBe('simulator');
  });
  it('fiscale modus zonder vestigingsgegevens weigert', () => {
    const r = new KassaRuntime(device, { mode: 'simulator', posId: 'CPOS0031234567' });
    expect(() => r.posContext()).toThrow(FiscalUnavailableError);
  });
});

describe('bedrijfsperiode en tellers (ID-04, ID-09)', () => {
  it('bookingPeriodId: GUID in kleine letters, zelfde per zaak en dag, anders per dag', async () => {
    const a = await bookingPeriodIdFor(device.tenantId, '2026-10-23');
    expect(isLowerGuid(a)).toBe(true);
    expect(await bookingPeriodIdFor(device.tenantId, '2026-10-23')).toBe(a);
    expect(await bookingPeriodIdFor(device.tenantId, '2026-10-24')).not.toBe(a);
    expect(await bookingPeriodIdFor('22222222-2222-2222-2222-222222222222', '2026-10-23')).not.toBe(a);
  });
  it('ticketnummer per terminal en label, doorlopend', () => {
    expect(takeTicketNo('CPOS0031234567', 'T1', 'S')).toBe(1);
    expect(takeTicketNo('CPOS0031234567', 'T1', 'S')).toBe(2);
    expect(takeTicketNo('CPOS0031234567', 'T1', 'N')).toBe(1);
    expect(takeTicketNo('CPOS0031234567', 'T2', 'S')).toBe(1);
  });
});

describe('in- en uitklokken (USR-05)', () => {
  it('niet-fiscaal: naar het auditspoor', async () => {
    const r = new KassaRuntime(device, { mode: 'off' });
    expect(await clock(r, 'staff-1', null, 'in')).toEqual({ ok: true });
    expect(inserts).toEqual([{ table: 'fiscal_audit_log', row: expect.objectContaining({ action: 'work_in', tenant_id: device.tenantId }) }]);
    expect(isClockedIn(device.tenantId, 'staff-1')).toBe(true);
  });
  it('fiscaal zonder INSZ: geweigerd, niets verstuurd', async () => {
    const r = new KassaRuntime(device, fiscalSim);
    expect(await clock(r, 'staff-1', null, 'in')).toEqual({ ok: false, reason: 'no_insz' });
    expect(inserts).toEqual([]);
  });
  it('simulator: S-event ondertekend en in fiscal_events, zonder INSZ in een kolom', async () => {
    const r = new KassaRuntime(device, fiscalSim);
    expect(await clock(r, 'staff-1', '84022899837', 'in')).toEqual({ ok: true });
    expect(await clock(r, 'staff-1', '84022899837', 'out')).toEqual({ ok: true });
    const rows = inserts.filter((x) => x.table === 'fiscal_events').map((x) => x.row);
    expect(rows.map((x) => [x.mutation, x.event_label, x.pos_fiscal_ticket_no])).toEqual([['signWorkIn', 'S', 1], ['signWorkOut', 'S', 2]]);
    for (const row of rows) {
      for (const [k, v] of Object.entries(row)) {
        if (k === 'request_body' || k === 'response_body') continue;
        expect(String(v)).not.toContain('84022899837');
      }
      expect(row.staff_id).toBe('staff-1');
      expect(row.request_sha256).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(isClockedIn(device.tenantId, 'staff-1')).toBe(false);
  });
  it('echte FDM nog niet beschikbaar: duidelijke weigering', async () => {
    const r = new KassaRuntime(device, { ...fiscalSim, mode: 'fdm' });
    expect(await clock(r, 'staff-1', '84022899837', 'in')).toEqual({ ok: false, reason: 'fdm_not_available' });
  });
});
