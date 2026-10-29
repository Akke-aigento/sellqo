// PERSONEEL-1 — USR-01: geen handeling zonder aangemelde medewerker; vergrendelen na inactiviteit.
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { KassaSessionProvider, useKassaSession } from '../session';

function Probe() {
  const { staff, employeeId, signIn, lock, setIdlePaused, guard } = useKassaSession();
  return (
    <div>
      <button onClick={() => setIdlePaused(true)}>pauze</button>
      <button onClick={() => { (window as unknown as { __guard?: boolean }).__guard = guard(); }}>guard</button>
      <span data-testid="who">{staff?.display_name ?? 'niemand'}</span>
      <span data-testid="insz">{employeeId ? 'ja' : 'nee'}</span>
      <button onClick={() => signIn({ id: '1', display_name: 'Jan', role: 'waiter', employee_no: 1, avatar_color: null }, '84022899837')}>in</button>
      <button onClick={lock}>lock</button>
    </div>
  );
}

describe('kassasessie', () => {
  it('vergrendelt na inactiviteit en wist het INSZ uit het geheugen', () => {
    vi.useFakeTimers();
    render(<KassaSessionProvider idleMs={1000}><Probe /></KassaSessionProvider>);
    act(() => { screen.getByText('in').click(); });
    expect(screen.getByTestId('who').textContent).toBe('Jan');
    expect(screen.getByTestId('insz').textContent).toBe('ja');
    act(() => { vi.advanceTimersByTime(900); });
    act(() => { window.dispatchEvent(new Event('pointerdown')); });
    act(() => { vi.advanceTimersByTime(900); });
    expect(screen.getByTestId('who').textContent).toBe('Jan');
    act(() => { vi.advanceTimersByTime(200); });
    expect(screen.getByTestId('who').textContent).toBe('niemand');
    expect(screen.getByTestId('insz').textContent).toBe('nee');
    vi.useRealTimers();
  });

  it('KASSA-UX-3: Keuken/Bar vergrendelt niet, maar na de wachttijd vraagt een handeling eerst de PIN', () => {
    vi.useFakeTimers();
    render(<KassaSessionProvider idleMs={1000}><Probe /></KassaSessionProvider>);
    act(() => { screen.getByText('in').click(); });
    act(() => { screen.getByText('pauze').click(); });
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByTestId('who').textContent).toBe('Jan');
    // Tikken op het scherm aan de muur telt niet als activiteit van de medewerker.
    act(() => { window.dispatchEvent(new Event('pointerdown')); });
    act(() => { screen.getByText('guard').click(); });
    expect((window as unknown as { __guard?: boolean }).__guard).toBe(false);
    expect(screen.getByTestId('who').textContent).toBe('niemand');
    vi.useRealTimers();
  });
});
