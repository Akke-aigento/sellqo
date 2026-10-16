import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { SchemaField } from '@/components/admin/storefront/schema/schemaTypes';

// EDITOR-SECTIONS-1: een schemaveld met `media: 'image'` wordt de beeldkiezer (zelfde
// VisualMediaPicker als hero/tekst+beeld), een gewoon tekstveld blijft een tekstveld.

const TENANT = '54f6b480-280b-42e1-b843-d5beb2831acd';
const uploads: Array<{ bucket: string; path: string }> = [];

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string) => { uploads.push({ bucket, path }); return { error: null }; },
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/${bucket}/${path}` } }),
      }),
    },
  },
}));
vi.mock('@/hooks/useTenant', () => ({ useTenant: () => ({ currentTenant: { id: TENANT } }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k }),
}));

const { SchemaForm } = await import('@/components/admin/storefront/schema/SchemaForm');

const imageField: SchemaField = {
  key: 'image_url', type: 'text', label: 'Afbeelding (link)', default: '',
  placeholder: 'https://…', pattern: '^https://\\S+$', media: 'image',
  help: 'Plak de link naar een afbeelding (https://…). Leeg = een vlak in je merkkleur.',
};
const textField: SchemaField = { key: 'title', type: 'text', label: 'Titel', default: '' };

beforeEach(() => { uploads.length = 0; });

describe('SchemaForm — media-tak', () => {
  it('media: image → beeldkiezer, geen URL-tekstveld en geen plak-uitleg', () => {
    render(<SchemaForm fields={[imageField]} values={{}} onChange={() => {}} />);
    expect(screen.getByText('admin.storefront.schema.schemaForm.kies_of_upload_afbeelding')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByText(/Plak de link/)).toBeNull();
  });

  it('zonder media → gewoon tekstveld (ongewijzigd gedrag)', () => {
    const onChange = vi.fn();
    render(<SchemaForm fields={[textField]} values={{ title: 'Hallo' }} onChange={onChange} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('Hallo');
    fireEvent.change(input, { target: { value: 'Dag' } });
    expect(onChange).toHaveBeenCalledWith({ title: 'Dag' });
  });

  it('bestaand beeld wordt getoond en "Verwijderen" maakt het veld leeg', () => {
    const onChange = vi.fn();
    const { container } = render(<SchemaForm fields={[imageField, textField]} values={{ image_url: 'https://cdn.example/a.jpg', title: 'T' }} onChange={onChange} />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://cdn.example/a.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'common.delete' }));
    expect(onChange).toHaveBeenCalledWith({ image_url: '', title: 'T' });
  });

  it('upload gaat naar tenant-assets/<tenant>/storefront en zet de publieke https-URL in het veld', async () => {
    const onChange = vi.fn();
    render(<SchemaForm fields={[imageField]} values={{}} onChange={onChange} />);
    fireEvent.click(screen.getByText('admin.storefront.schema.schemaForm.kies_of_upload_afbeelding'));
    const input = await waitFor(() => {
      const el = document.querySelector('input[type="file"]');
      if (!el) throw new Error('geen file-input');
      return el as HTMLInputElement;
    });
    const file = new File(['x'], 'dia.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(uploads).toHaveLength(1);
    expect(uploads[0].bucket).toBe('tenant-assets');
    expect(uploads[0].path).toMatch(new RegExp(`^${TENANT}/storefront/\\d+\\.png$`));
    const url = onChange.mock.calls[0][0].image_url as string;
    expect(url).toMatch(/^https:\/\/\S+$/); // voldoet aan het schema-pattern en aan safeImg in de winkel
  });
});
