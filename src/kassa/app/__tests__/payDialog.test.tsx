// TAFEL-2 — afrekenvenster: rendert, rekent het restbedrag, contant afgerond + wisselgeld,
// gelijk delen en apart afrekenen (enkel UI; de geldlogica zit in pay.test.ts en de SQL-tests).
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ActionCtx } from '../horeca/actions';
import type { Check, CheckLine } from '../horeca/types';

const tenant: { name: string; iban?: string } = { name: 'Café Test' };
vi.mock('@/hooks/useTenant', () => ({ useTenant: () => ({ currentTenant: tenant }) }));
// BETAAL-1: instellingen van de zaak; standaard alles aan met een losse terminal.
const settings = { methods: ['cash', 'transfer', 'card', 'cheque_meal', 'voucher'], terminal: 'standalone', kassa_tip: true };
vi.mock('../horeca/paySettings', async (orig) => ({ ...(await orig<object>()), useKassaPaySettings: () => settings }));
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

describe('PayDialog — betaalinstellingen en overschrijving (BETAAL-1)', () => {
  const quickButtons = () => screen.getAllByRole('button').filter((b) => b.className.includes('h-14')).map((b) => b.textContent?.trim());

  it('zonder terminal geen kaart; enkel de betaalwijzen van de zaak', () => {
    Object.assign(settings, { methods: ['cash', 'transfer'], terminal: 'none', kassa_tip: true });
    render(<PayDialog ctx={ctx} check={check} onClose={() => {}} onPaid={() => {}} />);
    expect(quickButtons()).toEqual(['kassa.pay.method.cash', 'kassa.pay.method.transfer']);
    const options = [...(screen.getByLabelText('kassa.pay.methodLabel') as HTMLSelectElement).options].map((o) => o.value);
    expect(options).toEqual(['cash', 'transfer']);
  });

  it('fooi uit = geen fooiveld', () => {
    Object.assign(settings, { methods: ['cash'], terminal: 'none', kassa_tip: false });
    render(<PayDialog ctx={ctx} check={check} onClose={() => {}} onPaid={() => {}} />);
    expect(screen.queryByLabelText('kassa.pay.tip')).toBeNull();
  });

  it('overschrijving: QR met bedrag en mededeling, bevestigen pas na "gelukt"', () => {
    Object.assign(settings, { methods: ['cash', 'transfer'], terminal: 'none', kassa_tip: true });
    tenant.iban = 'BE68 5390 0754 7034';
    render(<PayDialog ctx={ctx} check={check} onClose={() => {}} onPaid={() => {}} />);
    fireEvent.click(screen.getAllByText('kassa.pay.method.transfer').find((e) => e.tagName === 'BUTTON' && e.closest('.grid'))!);
    expect(screen.getByText('kassa.pay.transfer.amount').nextElementSibling?.textContent).toContain('6,08');
    expect(screen.getByText(/^\+\+\+\d{3}\/\d{4}\/\d{5}\+\+\+$/)).toBeTruthy();
    const confirm = () => screen.getByText(/kassa.pay.confirm/).closest('button') as HTMLButtonElement;
    expect(confirm().disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('kassa.pay.transfer.seen'));
    expect(confirm().disabled).toBe(false);
    // Fooi via overschrijving gaat mee in het bedrag van de QR, en vraagt opnieuw bevestiging.
    fireEvent.change(screen.getByLabelText('kassa.pay.tip'), { target: { value: '1' } });
    fireEvent.click(screen.getAllByText('kassa.pay.method.transfer').find((e) => e.getAttribute('aria-pressed') !== null)!);
    expect(screen.getByText('kassa.pay.transfer.amount').nextElementSibling?.textContent).toContain('7,08');
    expect(confirm().disabled).toBe(true);
  });

  it('overschrijving zonder rekeningnummer: melding en geen bevestiging', () => {
    Object.assign(settings, { methods: ['transfer'], terminal: 'none', kassa_tip: true });
    delete tenant.iban;
    render(<PayDialog ctx={ctx} check={check} onClose={() => {}} onPaid={() => {}} />);
    expect(screen.getByText('kassa.pay.transfer.noIban')).toBeTruthy();
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

describe('PayDialog — online betaald aan tafel (REKENING-ONLINE-1)', () => {
  it('voorschot telt mee als "online"; aan de kassa enkel de rest', async () => {
    Object.assign(settings, { methods: ['cash', 'transfer', 'card'], terminal: 'standalone', kassa_tip: true });
    const { payCheck } = await import('../horeca/payActions');
    (payCheck as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, reason: 'server' });
    render(<PayDialog ctx={ctx} check={{ ...check, online_credit_cents: 200 }} onClose={() => {}} onPaid={() => {}} />);
    expect(screen.getByText(/kassa.pay.onlineCredit/)).toBeTruthy();
    // 6,08 totaal − 2,00 online = 4,08 aan de kassa
    expect((screen.getAllByLabelText('kassa.pay.amount')[0] as HTMLInputElement).value).toBe('4,08');
    fireEvent.click(screen.getByText(/kassa.pay.confirm/).closest('button')!);
    await Promise.resolve();
    const tenders = (payCheck as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[2];
    expect(tenders[0]).toEqual({ method: 'online', amount_cents: 200 });
    expect(tenders.reduce((s: number, x: { amount_cents: number }) => s + x.amount_cents, 0)).toBe(608);
  });

  it('terwijl een gast online betaalt: melding en niet bevestigen', () => {
    const until = new Date(Date.now() + 5 * 60_000).toISOString();
    render(<PayDialog ctx={ctx} check={{ ...check, online_pending_until: until }} onClose={() => {}} onPaid={() => {}} />);
    expect(screen.getByText('kassa.pay.onlineBusy')).toBeTruthy();
    expect((screen.getByText(/kassa.pay.confirm/).closest('button') as HTMLButtonElement).disabled).toBe(true);
  });
});
