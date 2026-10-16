import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  fetchMediaLibrary, filterByName, isImageEntry, mediaLibrarySources, mergeLibrary, sortNewestFirst, toMediaItems,
  LIST_PAGE, type MediaItem, type StorageLike, type StorageListEntry,
} from '@/lib/storefrontMediaLibrary';

// EDITOR-MEDIA-1: mediabibliotheek van de beeldkiezer — prefixen, sortering, zoeken, paginering.

const TENANT = '54f6b480-280b-42e1-b843-d5beb2831acd';
const OTHER = '1671a91c-31fe-42ed-8a10-41f3117ceb50';
const url = (b: string, p: string) => `https://x.supabase.co/storage/v1/object/public/${b}/${p}`;

const file = (name: string, created_at: string, mimetype = 'image/png'): StorageListEntry =>
  ({ name, id: `id-${name}`, created_at, metadata: { mimetype, size: 10 } });
const item = (name: string, createdAt: string): MediaItem =>
  ({ key: `tenant-assets/${TENANT}/storefront/${name}`, bucket: 'tenant-assets', path: `${TENANT}/storefront/${name}`, name, url: name, createdAt });

describe('mediaLibrarySources — prefixen', () => {
  it('alleen mappen onder het eigen tenant-id', () => {
    const s = mediaLibrarySources(TENANT);
    expect(s).toEqual([
      { bucket: 'tenant-assets', prefix: `${TENANT}/storefront` },
      { bucket: 'tenant-assets', prefix: TENANT },
      { bucket: 'product-images', prefix: TENANT },
      { bucket: 'marketing-assets', prefix: TENANT },
    ]);
    expect(s.every((x) => x.prefix.startsWith(TENANT))).toBe(true);
  });

  it('geen of ongeldig tenant-id → niets (nooit de bucketwortel of een ander pad)', () => {
    expect(mediaLibrarySources(undefined)).toEqual([]);
    expect(mediaLibrarySources('')).toEqual([]);
    expect(mediaLibrarySources('../' + OTHER)).toEqual([]);
    expect(mediaLibrarySources(`${OTHER}/storefront`)).toEqual([]);
  });
});

describe('isImageEntry / toMediaItems', () => {
  it('mappen (id null), verborgen bestanden en niet-beelden vallen weg', () => {
    expect(isImageEntry({ name: 'storefront', id: null })).toBe(false);
    expect(isImageEntry({ name: '.emptyFolderPlaceholder', id: 'x', metadata: { mimetype: 'application/octet-stream' } })).toBe(false);
    expect(isImageEntry(file('a.pdf', '2026-01-01', 'application/pdf'))).toBe(false);
    expect(isImageEntry(file('a.webp', '2026-01-01', 'image/webp'))).toBe(true);
    expect(isImageEntry({ name: 'b.JPG', id: 'x' })).toBe(true); // geen mimetype → extensie
  });

  it('bouwt pad en publieke URL uit bucket + prefix', () => {
    const [i] = toMediaItems([file('1.png', '2026-02-01')], { bucket: 'product-images', prefix: TENANT }, url);
    expect(i.path).toBe(`${TENANT}/1.png`);
    expect(i.url).toBe(url('product-images', `${TENANT}/1.png`));
    expect(i.key).toBe(`product-images/${TENANT}/1.png`);
  });
});

describe('sortering en zoeken', () => {
  it('nieuwste eerst, zonder datum achteraan', () => {
    const out = sortNewestFirst([item('oud.png', '2026-01-01T00:00:00Z'), item('geen.png', ''), item('nieuw.png', '2026-10-01T00:00:00Z')]);
    expect(out.map((x) => x.name)).toEqual(['nieuw.png', 'oud.png', 'geen.png']);
  });

  it('mergeLibrary ontdubbelt op bucket+pad en sorteert', () => {
    const a = item('a.png', '2026-01-01');
    const b = item('b.png', '2026-03-01');
    expect(mergeLibrary([[a, b], [a]]).map((x) => x.name)).toEqual(['b.png', 'a.png']);
  });

  it('zoeken is hoofdletter- en accentongevoelig; alle woorden moeten passen', () => {
    const list = [item('Zomer-Café.jpg', '1'), item('winter-banner.png', '2'), item('zomer-banner.png', '3')];
    expect(filterByName(list, 'cafe').map((x) => x.name)).toEqual(['Zomer-Café.jpg']);
    expect(filterByName(list, 'ZOMER banner').map((x) => x.name)).toEqual(['zomer-banner.png']);
    expect(filterByName(list, '   ')).toHaveLength(3);
  });
});

function fakeClient(tree: Record<string, StorageListEntry[]>, failing: string[] = []) {
  const calls: Array<{ bucket: string; path: string; offset: number }> = [];
  const client: StorageLike = {
    storage: {
      from: (bucket: string) => ({
        list: async (path, opts) => {
          calls.push({ bucket, path, offset: opts.offset });
          if (failing.includes(`${bucket}/${path}`)) return { data: null, error: { message: 'nope' } };
          const all = tree[`${bucket}/${path}`] || [];
          return { data: all.slice(opts.offset, opts.offset + opts.limit), error: null };
        },
        getPublicUrl: (p: string) => ({ data: { publicUrl: url(bucket, p) } }),
      }),
    },
  };
  return { client, calls };
}

describe('fetchMediaLibrary', () => {
  it('leest de vier eigen mappen, voegt samen en sorteert nieuwste eerst', async () => {
    const { client, calls } = fakeClient({
      [`tenant-assets/${TENANT}/storefront`]: [file('hero.webp', '2026-02-15T19:49:20Z')],
      [`tenant-assets/${TENANT}`]: [{ name: 'storefront', id: null }, file('logo.png', '2026-01-01T00:00:00Z')],
      [`product-images/${TENANT}`]: [{ name: 'printful', id: null }, file('p1.jpg', '2026-10-05T00:00:00Z', 'image/jpeg')],
      [`marketing-assets/${TENANT}`]: [{ name: 'social', id: null }, file('banner.png', '2026-06-01T00:00:00Z')],
    });
    const res = await fetchMediaLibrary(client, TENANT);
    expect(res.failed).toEqual([]);
    expect(res.items.map((i) => i.name)).toEqual(['p1.jpg', 'banner.png', 'hero.webp', 'logo.png']);
    expect(new Set(calls.map((c) => c.bucket))).toEqual(new Set(['tenant-assets', 'product-images', 'marketing-assets']));
    expect(calls.every((c) => c.path.startsWith(TENANT))).toBe(true);
  });

  it('pagineert per map tot een onvolledige pagina', async () => {
    const many = Array.from({ length: LIST_PAGE + 5 }, (_, n) => file(`f${n}.png`, `2026-01-01T00:00:${String(n % 60).padStart(2, '0')}Z`));
    const { client, calls } = fakeClient({ [`product-images/${TENANT}`]: many });
    const res = await fetchMediaLibrary(client, TENANT);
    expect(res.items).toHaveLength(LIST_PAGE + 5);
    expect(calls.filter((c) => c.bucket === 'product-images').map((c) => c.offset)).toEqual([0, LIST_PAGE]);
  });

  it('een map die faalt wordt gemeld, niet stil weggeslikt', async () => {
    const { client } = fakeClient({ [`product-images/${TENANT}`]: [file('p.png', '2026-01-01')] }, [`tenant-assets/${TENANT}`]);
    const res = await fetchMediaLibrary(client, TENANT);
    expect(res.failed).toEqual([`tenant-assets/${TENANT}`]);
    expect(res.items.map((i) => i.name)).toEqual(['p.png']);
  });

  it('zonder tenant geen enkele list-aanroep', async () => {
    const { client, calls } = fakeClient({});
    expect(await fetchMediaLibrary(client, null)).toEqual({ items: [], failed: [] });
    expect(calls).toHaveLength(0);
  });
});

// ── Component: tabblad Mediabibliotheek in VisualMediaPicker ─────────────────
const tree: Record<string, StorageListEntry[]> = {
  [`tenant-assets/${TENANT}/storefront`]: Array.from({ length: 30 }, (_, n) =>
    file(`beeld-${String(n).padStart(2, '0')}.png`, `2026-10-${String(1 + (n % 28)).padStart(2, '0')}T00:00:00Z`)),
  [`product-images/${TENANT}`]: [file('zomer-actie.jpg', '2026-10-30T00:00:00Z', 'image/jpeg')],
};
const listed: string[] = [];
// MEDIA-1: de kiezer leest ook media_assets. Eén rij is een dubbel van een storage-bestand
// (moet wegvallen), één staat op een externe server (moet erbij komen).
const SHOPIFY = 'https://cdn.shopify.com/s/files/1/x/files/oude-tee.png?v=1';
const mediaRows = [
  { file_name: 'zomer-actie.jpg', file_url: url('product-images', `${TENANT}/zomer-actie.jpg`), file_type: 'image/jpeg', created_at: '2026-10-30T00:00:00Z' },
  { file_name: 'oude-tee.png', file_url: SHOPIFY, file_type: 'image/png', created_at: '2026-09-01T00:00:00Z' },
];
const mediaQueries: string[] = [];
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      const q = {
        select: () => q,
        eq: (_c: string, v: string) => { mediaQueries.push(`${table}:${v}`); return q; },
        order: () => q,
        limit: () => q,
        then: (resolve: (r: { data: unknown; error: null }) => unknown) => resolve({ data: table === 'media_assets' ? mediaRows : [], error: null }),
        upsert: async () => ({ error: null }),
      };
      return q;
    },
    storage: {
      from: (bucket: string) => ({
        list: async (path: string, opts: { limit: number; offset: number }) => {
          listed.push(`${bucket}/${path}`);
          return { data: (tree[`${bucket}/${path}`] || []).slice(opts.offset, opts.offset + opts.limit), error: null };
        },
        upload: async () => ({ error: null }),
        getPublicUrl: (p: string) => ({ data: { publicUrl: url(bucket, p) } }),
      }),
    },
  },
}));
vi.mock('@/hooks/useTenant', () => ({ useTenant: () => ({ currentTenant: { id: TENANT } }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o?.name ? `${k}:${o.name}` : k) }),
}));

describe('VisualMediaPicker — Mediabibliotheek', () => {
  it('toont eigen beelden nieuwste eerst, zoekt, laadt meer en kiest bij klik', async () => {
    const { VisualMediaPicker } = await import('@/components/admin/storefront/visual-editor/VisualMediaPicker');
    const onSelect = vi.fn();
    render(<VisualMediaPicker onSelect={onSelect} />);
    fireEvent.click(screen.getByText('admin.storefront.mediaPicker.placeholder'));
    const tab = screen.getByRole('tab', { name: 'admin.storefront.mediaPicker.tab_library' });
    fireEvent.mouseDown(tab); // Radix Tabs activeert op mousedown
    fireEvent.click(tab);

    const first = await screen.findByRole('button', { name: 'admin.storefront.mediaPicker.choose_named:zomer-actie.jpg' });
    expect(listed.every((p) => p.split('/')[1] === TENANT)).toBe(true);
    const tiles = () => screen.getAllByRole('button', { name: /choose_named:/ });
    expect(tiles()[0]).toBe(first); // nieuwste eerst
    expect(tiles()).toHaveLength(24);
    expect(mediaQueries).toEqual([`media_assets:${TENANT}`]);
    fireEvent.click(screen.getByRole('button', { name: 'admin.storefront.mediaPicker.load_more' }));
    // 31 storage-bestanden + de externe Shopify-foto; de dubbele zomer-actie telt één keer.
    expect(tiles()).toHaveLength(32);
    expect(screen.getByRole('button', { name: 'admin.storefront.mediaPicker.choose_named:oude-tee.png' })).toBeTruthy();

    fireEvent.change(screen.getByLabelText('admin.storefront.mediaPicker.search_placeholder'), { target: { value: 'ZOMER' } });
    expect(tiles()).toHaveLength(1);

    fireEvent.click(tiles()[0]);
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(url('product-images', `${TENANT}/zomer-actie.jpg`)));
  });
});
