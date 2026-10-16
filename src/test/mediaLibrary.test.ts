import { describe, expect, it, vi } from 'vitest';
import {
  buildUsageMap, containsUrl, extensionFor, fileNameFromUrl, isExternalImageUrl, isOwnStorageUrl, replaceInArray, urlHost,
} from '@/lib/mediaLibrary';
import { buildMediaRow, recordMediaDimensions, registerMediaAsset } from '@/lib/mediaRegistry';
import { mediaAssetsToItems, mergeLibrary, type MediaItem } from '@/lib/storefrontMediaLibrary';

const OWN = 'https://gczmfcabnoofnmfpzeop.supabase.co/storage/v1/object/public/product-images/t1/123-abc.png';
const SHOPIFY = 'https://cdn.shopify.com/s/files/1/0923/2072/7423/files/tee.png?v=1773469149';

describe('MEDIA-1 — URL-herkenning', () => {
  it('eigen storage is niet extern, Shopify wel', () => {
    expect(isOwnStorageUrl(OWN)).toBe(true);
    expect(isExternalImageUrl(OWN)).toBe(false);
    expect(isExternalImageUrl(SHOPIFY)).toBe(true);
  });
  it('lege, relatieve en data-URL\'s zijn nooit extern', () => {
    expect(isExternalImageUrl(null)).toBe(false);
    expect(isExternalImageUrl('')).toBe(false);
    expect(isExternalImageUrl('/assets/x.png')).toBe(false);
    expect(isExternalImageUrl('data:image/png;base64,AAAA')).toBe(false);
  });
  it('host en bestandsnaam zonder querystring', () => {
    expect(urlHost(SHOPIFY)).toBe('cdn.shopify.com');
    expect(urlHost('geen url')).toBe('');
    expect(fileNameFromUrl(SHOPIFY)).toBe('tee.png');
    expect(fileNameFromUrl('https://x.test/')).toBe('afbeelding');
  });
  it('extensie: content-type wint, dan de URL, anders jpg', () => {
    expect(extensionFor('image/webp', SHOPIFY)).toBe('webp');
    expect(extensionFor('image/png; charset=binary', 'https://x/y')).toBe('png');
    expect(extensionFor(null, SHOPIFY)).toBe('png');
    expect(extensionFor('', 'https://x/foto.JPEG')).toBe('jpg');
    expect(extensionFor('application/octet-stream', 'https://x/zonder')).toBe('jpg');
  });
});

describe('MEDIA-1 — lijsten vervangen', () => {
  it('vervangt elke voorkomen en laat de rest staan', () => {
    expect(replaceInArray(['a', SHOPIFY, 'b', SHOPIFY], SHOPIFY, 'n')).toEqual(['a', 'n', 'b', 'n']);
    expect(replaceInArray(null, SHOPIFY, 'n')).toBeNull();
    expect(containsUrl(['a'], 'a')).toBe(true);
    expect(containsUrl(null, 'a')).toBe(false);
  });
  it('gebruikskaart telt featured_image één keer per product', () => {
    const map = buildUsageMap([
      { id: 'p1', name: 'Tee', images: [SHOPIFY, OWN], featured_image: SHOPIFY },
      { id: 'p2', name: 'Hoodie', images: [SHOPIFY] },
    ]);
    expect(map.get(SHOPIFY)).toEqual([{ id: 'p1', name: 'Tee' }, { id: 'p2', name: 'Hoodie' }]);
    expect(map.get(OWN)).toEqual([{ id: 'p1', name: 'Tee' }]);
  });
});

function fakeClient(opts: { upsertError?: { code?: string; message: string }; existing?: boolean } = {}) {
  const calls: { op: string; args: unknown[] }[] = [];
  const tableApi = {
    upsert: (...args: unknown[]) => { calls.push({ op: 'upsert', args }); return Promise.resolve({ error: opts.upsertError ?? null }); },
    insert: (...args: unknown[]) => { calls.push({ op: 'insert', args }); return Promise.resolve({ error: null }); },
    select: () => ({ eq: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: opts.existing ? [{ id: 'x' }] : [], error: null }) }) }) }),
    update: (row: unknown) => ({ eq: (_c: string, id: string) => ({ is: () => { calls.push({ op: 'update', args: [row, id] }); return Promise.resolve({ error: null }); } }) }),
  };
  return { client: { from: () => tableApi }, calls };
}

describe('MEDIA-1 — registreren', () => {
  it('upsert met ignoreDuplicates op (tenant_id, file_url)', async () => {
    const { client, calls } = fakeClient();
    const ok = await registerMediaAsset(client, { tenantId: 't1', url: OWN, folder: 'products', width: 1200, height: 1600 });
    expect(ok).toBe(true);
    expect(calls[0].op).toBe('upsert');
    expect(calls[0].args[1]).toEqual({ onConflict: 'tenant_id,file_url', ignoreDuplicates: true });
    expect((calls[0].args[0] as Record<string, unknown>).width).toBe(1200);
  });
  it('zonder unieke sleutel (vóór de migratie): eerst kijken, dan insert', async () => {
    const { client, calls } = fakeClient({ upsertError: { code: '42P10', message: 'no unique constraint' } });
    expect(await registerMediaAsset(client, { tenantId: 't1', url: OWN })).toBe(true);
    expect(calls.map((c) => c.op)).toEqual(['upsert', 'insert']);
  });
  it('bestaat de rij al zonder sleutel, dan geen tweede insert', async () => {
    const { client, calls } = fakeClient({ upsertError: { code: '42P10', message: 'x' }, existing: true });
    expect(await registerMediaAsset(client, { tenantId: 't1', url: OWN })).toBe(true);
    expect(calls.map((c) => c.op)).toEqual(['upsert']);
  });
  it('een andere fout breekt niets: false en geen insert', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { client, calls } = fakeClient({ upsertError: { code: '42501', message: 'rls' } });
    expect(await registerMediaAsset(client, { tenantId: 't1', url: OWN })).toBe(false);
    expect(calls.map((c) => c.op)).toEqual(['upsert']);
    warn.mockRestore();
  });
  it('zonder tenant of url: niets doen', async () => {
    const { client, calls } = fakeClient();
    expect(await registerMediaAsset(client, { tenantId: '', url: OWN })).toBe(false);
    expect(calls).toHaveLength(0);
  });
  it('rij-defaults', () => {
    const row = buildMediaRow({ tenantId: 't1', url: SHOPIFY });
    expect(row).toMatchObject({ file_name: 'tee.png', folder: 'general', source: 'upload', file_type: 'image/jpeg' });
  });
  it('afmetingen alleen aanvullen bij geldige waarden', async () => {
    const { client, calls } = fakeClient();
    await recordMediaDimensions(client, 'm1', 0, 100);
    expect(calls).toHaveLength(0);
    await recordMediaDimensions(client, 'm1', 1200, 1600);
    expect(calls[0]).toEqual({ op: 'update', args: [{ width: 1200, height: 1600 }, 'm1'] });
  });
});

describe('MEDIA-1 — storefront-kiezer leest ook media_assets', () => {
  it('ontdubbelt op URL tussen storage en bibliotheek', () => {
    const storage: MediaItem[] = [{ key: 'product-images/t1/123-abc.png', bucket: 'product-images', path: 't1/123-abc.png', name: '123-abc.png', url: OWN, createdAt: '2026-10-16' }];
    const lib = mediaAssetsToItems([
      { file_name: '123-abc.png', file_url: OWN, file_type: 'image/png', created_at: '2026-10-16' },
      { file_name: 'tee.png', file_url: SHOPIFY, file_type: 'image/png', created_at: '2026-10-01' },
      { file_name: 'doc.pdf', file_url: 'https://x/doc.pdf', file_type: 'application/pdf' },
    ]);
    const merged = mergeLibrary([storage, lib]);
    expect(merged.map((m) => m.url)).toEqual([OWN, SHOPIFY]);
    expect(merged[0].bucket).toBe('product-images');
    expect(merged[1].bucket).toBe('library');
  });
});
