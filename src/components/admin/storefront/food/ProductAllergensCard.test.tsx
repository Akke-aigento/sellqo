// ALLERGEEN-VERKLAARD-1 — "Bevat geen van de 14 allergenen" naast de 14 vinkjes: aanvinken bewaart
// allergens_declared = true met een lege lijst; een allergeen aanvinken bewaart verklaard; het vinkje
// "bevat geen" kan niet zolang er een allergeen staat.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
let row: Record<string, unknown> = {};
const updates: Record<string, unknown>[] = [];
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: row, error: null }) }) }),
      update: (patch: Record<string, unknown>) => { updates.push(patch); return { eq: async () => ({ error: null }) }; },
    }),
  },
}));
const { ProductAllergensCard } = await import('./ProductAllergensCard');

const mount = () => render(<QueryClientProvider client={new QueryClient()}><ProductAllergensCard productId="p1" /></QueryClientProvider>);
const noneBox = () => screen.getByRole('checkbox', { name: 'admin.storefront.food.allergens_none_label' });

describe('ProductAllergensCard — bevat geen', () => {
  beforeEach(() => { updates.length = 0; });

  it('niet ingevuld: vinkje uit, hint zichtbaar; aanvinken bewaart een lege lijst als verklaard', async () => {
    row = { allergens: [], dietary: [], allergens_declared: false };
    mount();
    await waitFor(() => expect(noneBox()).toBeTruthy());
    expect(noneBox().getAttribute('data-state')).toBe('unchecked');
    expect(screen.getByText('admin.storefront.food.allergens_none_hint')).toBeTruthy();
    fireEvent.click(noneBox());
    await waitFor(() => expect(updates.at(-1)).toEqual({ allergens: [], dietary: [], allergens_declared: true }));
    expect(screen.queryByText('admin.storefront.food.allergens_none_hint')).toBeNull();
  });

  it('verklaard "geen": vinkje aan; een allergeen aanvinken blijft verklaard en schakelt "bevat geen" uit', async () => {
    row = { allergens: [], dietary: [], allergens_declared: true };
    mount();
    await waitFor(() => expect(noneBox().getAttribute('data-state')).toBe('checked'));
    fireEvent.click(screen.getByRole('checkbox', { name: 'admin.allergens.gluten' }));
    await waitFor(() => expect(updates.at(-1)).toEqual({ allergens: ['gluten'], dietary: [], allergens_declared: true }));
    expect(noneBox().hasAttribute('disabled')).toBe(true);
  });

  it('laatste allergeen weghalen = weer niet ingevuld (niet stil "bevat geen")', async () => {
    row = { allergens: ['milk'], dietary: [], allergens_declared: true };
    mount();
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'admin.allergens.milk' }).getAttribute('data-state')).toBe('checked'));
    fireEvent.click(screen.getByRole('checkbox', { name: 'admin.allergens.milk' }));
    await waitFor(() => expect(updates.at(-1)).toEqual({ allergens: [], dietary: [], allergens_declared: false }));
  });
});
