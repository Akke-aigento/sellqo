import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import nl from '@/i18n/locales/nl.json';
import type { FloorArea, FloorMarker, FloorTable } from '@/lib/floorplan';

// ZAAL-H1: het alleen-lezen zaalplan (TAFEL-1 hergebruikt het voor het live zaalplan).
// Vertalingen komen echt uit nl.json, zodat een ontbrekende key hier opvalt.
function tr(key: string, o?: Record<string, unknown>): string {
  const v = key.split('.').reduce<unknown>((n, p) => (n && typeof n === 'object' ? (n as Record<string, unknown>)[p] : undefined), nl);
  if (typeof v !== 'string') return `MISSING:${key}`;
  return v.replace(/\{\{(\w+)\}\}/g, (_, k) => String(o?.[k] ?? ''));
}
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: tr }) }));

const { FloorPlanView } = await import('@/components/admin/floorplan/FloorPlanView');

const areas: FloorArea[] = [
  { id: 'a2', name: 'Terras', sort: 1, grid_w: 20, grid_h: 10, is_active: true },
  { id: 'a1', name: 'Belgaleiro', sort: 0, grid_w: 40, grid_h: 24, is_active: true },
  { id: 'a3', name: 'Weg', sort: 2, grid_w: 20, grid_h: 10, is_active: false },
];
const tb = (id: string, area_id: string, label: string, extra: Partial<FloorTable> = {}): FloorTable => ({
  id, area_id, label, kind: 'table', shape: 'square', seats: 4, x: 0, y: 0, w: 2, h: 2, rotation: 0, is_active: true, ...extra,
});
const tables: FloorTable[] = [
  tb('t1', 'a1', 'Blauw 1', { x: 2, y: 2 }),
  tb('t2', 'a1', 'Rond tafel', { x: 6, y: 2, shape: 'round', seats: 6 }),
  tb('t3', 'a1', 'B1', { x: 1, y: 10, w: 1, h: 1, kind: 'bar_seat', seats: 1, rotation: 90 }),
  tb('t4', 'a2', 'Ter-1', { x: 1, y: 1 }),
  tb('t5', 'a1', 'Oud', { is_active: false }),
];
const markers: FloorMarker[] = [{ id: 'm1', area_id: 'a1', kind: 'bar', label: null, x: 0, y: 9, w: 9, h: 1, rotation: 0 }];

describe('FloorPlanView', () => {
  it('toont de eerste ruimte (op volgorde), enkel actieve tafels, en decor', () => {
    render(<FloorPlanView areas={areas} tables={tables} markers={markers} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((x) => x.textContent)).toEqual(['Belgaleiro', 'Terras']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    const items = screen.getAllByTestId('floor-table');
    expect(items.map((x) => x.textContent)).toEqual(['Blauw 1', 'Rond tafel', 'B1']);
    expect(screen.getByTestId('floor-marker')).toHaveTextContent('Toog');
    expect(document.body.textContent).not.toContain('MISSING:');
    // Alleen-lezen zonder onTableClick: geen knoppen.
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('wisselt van ruimte', () => {
    render(<FloorPlanView areas={areas} tables={tables} markers={markers} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Terras' }));
    expect(screen.getAllByTestId('floor-table').map((x) => x.textContent)).toEqual(['Ter-1']);
  });

  it('status per tafel en klik (voor TAFEL-1)', () => {
    const onTableClick = vi.fn();
    render(<FloorPlanView areas={areas} tables={tables} markers={markers} status={{ t1: 'occupied', t2: 'attention' }} onTableClick={onTableClick} />);
    const blauw = screen.getByRole('button', { name: 'Tafel Blauw 1: bezet' });
    expect(blauw).toHaveAttribute('data-status', 'occupied');
    expect(screen.getByRole('button', { name: 'Tafel Rond tafel: vraagt aandacht' })).toHaveClass('rounded-full');
    expect(screen.getByRole('button', { name: 'Tafel B1, stoelen: 1' }).getAttribute('style')).toContain('rotate(90deg)');
    fireEvent.click(blauw);
    expect(onTableClick).toHaveBeenCalledWith(expect.objectContaining({ id: 't1', label: 'Blauw 1' }));
  });

  it('schaalt in rastereenheden', () => {
    render(<FloorPlanView areas={areas} tables={tables} markers={markers} />);
    const group = screen.getByRole('group', { name: 'Belgaleiro' });
    // jsdom heeft geen breedte → standaard 640 px: 640/40 = 16 px per vakje.
    expect(group.style.width).toBe('640px');
    expect(group.style.height).toBe('384px');
    const blauw = within(group).getAllByTestId('floor-table')[0];
    expect(blauw.style.left).toBe('32px');
    expect(blauw.style.width).toBe('32px');
  });

  it('lege staat zonder ruimtes', () => {
    render(<FloorPlanView areas={[]} tables={[]} markers={[]} />);
    expect(screen.getByText('Nog geen zaalplan.')).toBeInTheDocument();
  });
});
