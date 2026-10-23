import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import nl from '@/i18n/locales/nl.json';
import type { FloorPlanData } from '@/hooks/useFloorPlan';

// ZAAL-H1: de editor op desktop (canvas + paneel) en gsm (lijst + venster), met een
// nep-zaalplan. Geen login nodig; vervangt de screenshots op 390/1280 px.
function tr(key: string, o?: Record<string, unknown>): string {
  const v = key.split('.').reduce<unknown>((n, p) => (n && typeof n === 'object' ? (n as Record<string, unknown>)[p] : undefined), nl);
  if (typeof v !== 'string') return `MISSING:${key}`;
  return v.replace(/\{\{(\w+)\}\}/g, (_, k) => String(o?.[k] ?? ''));
}
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: tr }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/hooks/useTenant', () => ({ useTenant: () => ({ currentTenant: { id: 'ten1', slug: 'belgaleiro', name: 'Belgaleiro' } }) }));
let mobile = false;
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => mobile }));

const plan: FloorPlanData = {
  areas: [
    { id: 'a1', name: 'Belgaleiro', sort: 0, grid_w: 40, grid_h: 24, is_active: true },
    { id: 'a2', name: 'Terras', sort: 1, grid_w: 20, grid_h: 10, is_active: true },
  ],
  tables: [
    { id: 't1', area_id: 'a1', label: 'Blauw 1', kind: 'table', shape: 'square', seats: 4, x: 2, y: 2, w: 2, h: 2, rotation: 0, is_active: true, qr_token: 'a'.repeat(24) },
    { id: 't2', area_id: 'a1', label: 'Blauw 2', kind: 'table', shape: 'square', seats: 4, x: 3, y: 3, w: 2, h: 2, rotation: 0, is_active: true, qr_token: 'b'.repeat(24) },
    { id: 't3', area_id: 'a2', label: 'Ter-1', kind: 'table', shape: 'round', seats: 2, x: 0, y: 0, w: 2, h: 2, rotation: 0, is_active: true, qr_token: 'c'.repeat(24) },
  ],
  markers: [],
};
const mut = () => ({ mutateAsync: vi.fn().mockResolvedValue([]), isPending: false });
const mutations = {
  createArea: mut(), updateArea: mut(), deactivateArea: mut(), insertItems: mut(), updateTable: mut(),
  deactivateTable: mut(), updateMarker: mut(), deleteMarker: mut(), renewToken: mut(),
};
vi.mock('@/hooks/useFloorPlan', () => ({
  useFloorPlan: () => ({ data: plan, isLoading: false }),
  useFloorPlanMutations: () => mutations,
}));

const { FloorPlanEditor } = await import('@/components/admin/floorplan/FloorPlanEditor');

describe('FloorPlanEditor', () => {
  beforeEach(() => { mobile = false; vi.clearAllMocks(); });

  it('desktop: canvas, overlapwaarschuwing en eigenschappen na klik', () => {
    render(<FloorPlanEditor />);
    expect(screen.getAllByRole('tab').map((x) => x.textContent)).toEqual(['Belgaleiro2', 'Terras1']);
    expect(screen.getByText(/Overlappende items op dit plan: 2/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tafel Blauw 1, stoelen: 4' }));
    const label = screen.getByLabelText('Naam van de tafel') as HTMLInputElement;
    expect(label.value).toBe('Blauw 1');
    fireEvent.change(label, { target: { value: 'Blauw 9' } });
    fireEvent.blur(label);
    expect(mutations.updateTable.mutateAsync).toHaveBeenCalledWith({ id: 't1', patch: { label: 'Blauw 9' } });
    expect(document.body.textContent).not.toContain('MISSING:');
  });

  it('desktop: pijltje verschuift de gekozen tafel één vakje', () => {
    render(<FloorPlanEditor />);
    const btn = screen.getByRole('button', { name: 'Tafel Blauw 1, stoelen: 4' });
    fireEvent.click(btn);
    fireEvent.keyDown(btn, { key: 'ArrowRight' });
    expect(mutations.updateTable.mutateAsync).toHaveBeenCalledWith({ id: 't1', patch: { x: 3, y: 2 } });
  });

  it('desktop: dupliceren maakt de volgende in de reeks op een vrije plek', () => {
    render(<FloorPlanEditor />);
    fireEvent.click(screen.getByRole('button', { name: 'Tafel Blauw 1, stoelen: 4' }));
    fireEvent.click(screen.getByRole('button', { name: /Dupliceren/ }));
    const arg = mutations.insertItems.mutateAsync.mock.calls[0][0];
    expect(arg.areaId).toBe('a1');
    expect(arg.tables[0].label).toBe('Blauw 3');
  });

  it('gsm: lijst per ruimte in plaats van canvas', () => {
    mobile = true;
    render(<FloorPlanEditor />);
    expect(screen.queryByRole('group')).toBeNull();
    expect(screen.getAllByText('Stoelen: 4', { selector: 'span' })).toHaveLength(2);
    expect(screen.getByText(/Tafels verslepen doe je het makkelijkst/)).toBeInTheDocument();
  });
});
