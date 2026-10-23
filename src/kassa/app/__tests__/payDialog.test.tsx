// TAFEL-2 — afrekenvenster: rendert, rekent het restbedrag, contant afgerond + wisselgeld,
// gelijk delen en apart afrekenen (enkel UI; de geldlogica zit in pay.test.ts en de SQL-tests).
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ActionCtx } from '../horeca/actions';
import type { Check, CheckLine } from '../horeca/types';

vi.mock('@/hooks/useTenant', () => ({ useTenant: () => ({ currentTenant: { name: 'Café Test' } }) }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k), i18n: { language: 'nl' } }),
}));
vi.mock('../horeca/payActions', async (orig) => ({ ...(await orig<object>()), payCheck: vi.fn() }));

const { PayDialog, SplitDialog } = await import('../screens/PayDialog');

const line = (over: Partial<CheckLine>): CheckLine => ({
  id: 'l1', seq: 1, product_id: 'p', variant_id: null, name: 'Cola', department_id: '1', department_name: 'Dranken', vat_label: 'A', vat_rate: 21,
  unit_price_cents: 304, qty: 2, addons: [], note: null, course: null, station_id: null, state: 'sent', round_id: 'r', neg_reason: null,
  corrects_line_id: null, price_changes: [], void_reason: null, created_by: null, created_at: '', open_qty: 2, ...over,
});
const check: Check = { id: 'c1', table_id: 't1', name: null, status: 'open', guests: null, opened_at: '', bill_requested_at: null, reference: 'c1', version: 1, next_grouping_id: 1, lines: [line({})] };
const ctx = { runtime: { fiscal: { mode: 'off' } }, staffName: 'Jan' } as unknown as ActionCtx;

describe('PayDialog', () => {
  it('kaart voor het hele bedrag klopt meteen; contant toont afgerond bedrag en wisselgeld', () => {
    render(<PayDialog ctx={ctx} check={check} onClose={() => {}} onPaid={() => {}} />);
    expect(screen.getByText('kassa.pay.balanced')).toBeTruthy();
    fireEvent.click(screen.getAllByText('kassa.pay.method.cash').find((e) => e.tagName === 'BUTTON' && e.closest('.grid'))!);
    // 6,08 contant → 6,10 te ontvangen (UC201)
    expect(screen.getByText('kassa.pay.cashDue').parentElement?.textContent).toContain('6,10');
    fireEvent.change(screen.getByLabelText('kassa.pay.given'), { target: { value: '10' } });
    expect(screen.getByText('kassa.pay.change').parentElement?.textContent).toContain('3,90');
  });

  it('gelijk delen door 3 maakt drie regels die samen kloppen', () => {
    render(<PayDialog ctx={ctx} check={check} onClose={() => {}} onPaid={() => {}} />);
    fireEvent.click(screen.getByText('3'));
    expect(screen.getAllByLabelText('kassa.pay.amount').map((i) => (i as HTMLInputElement).value)).toEqual(['2,03', '2,03', '2,02']);
    expect(screen.getByText('kassa.pay.balanced')).toBeTruthy();
  });

  it('te weinig = restbedrag en geen bevestiging', () => {
    render(<PayDialog ctx={ctx} check={check} onClose={() => {}} onPaid={() => {}} />);
    fireEvent.change(screen.getAllByLabelText('kassa.pay.amount')[0], { target: { value: '5' } });
    expect(screen.getByText(/kassa.pay.remaining/)).toBeTruthy();
    expect((screen.getByText(/kassa.pay.confirm/).closest('button') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('SplitDialog', () => {
  it('kiest per lijn een aantal binnen wat openstaat', () => {
    const onConfirm = vi.fn();
    render(<SplitDialog check={check} busy={false} onClose={() => {}} onConfirm={onConfirm} />);
    const plus = screen.getByLabelText('kassa.checks.more1');
    fireEvent.click(plus); fireEvent.click(plus); fireEvent.click(plus);
    fireEvent.click(screen.getByText(/kassa.pay.splitConfirm/));
    expect(onConfirm).toHaveBeenCalledWith([{ lineId: 'l1', qty: 2 }]);
  });
});
