import { describe, expect, it } from 'vitest';
import { fetchAllRows } from '@/lib/salesStats';

// Simuleert PostgREST: .range(from, to) inclusief, nooit meer dan de gevraagde pagina.
function fakeTable(total: number) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i }));
  const calls: Array<[number, number]> = [];
  const build = (from: number, to: number) => {
    calls.push([from, to]);
    return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
  };
  return { build, calls };
}

describe('EXPORT-ALL-1 fetchAllRows', () => {
  it('haalt alle rijen op over meerdere pagina\'s (geen stille 1000-limiet)', async () => {
    const t = fakeTable(2500);
    const out = await fetchAllRows(t.build);
    expect(out).toHaveLength(2500);
    expect(out[0].id).toBe(0);
    expect(out[2499].id).toBe(2499);
    expect(t.calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it('vraagt één extra lege pagina bij een exact veelvoud van de paginagrootte', async () => {
    const t = fakeTable(2000);
    const out = await fetchAllRows(t.build);
    expect(out).toHaveLength(2000);
    expect(t.calls).toHaveLength(3);
  });

  it('stopt na één pagina als er minder rijen zijn', async () => {
    const t = fakeTable(3);
    expect(await fetchAllRows(t.build)).toHaveLength(3);
    expect(t.calls).toEqual([[0, 999]]);
  });

  it('respecteert een eigen paginagrootte', async () => {
    const t = fakeTable(5);
    expect(await fetchAllRows(t.build, 2)).toHaveLength(5);
    expect(t.calls).toEqual([
      [0, 1],
      [2, 3],
      [4, 5],
    ]);
  });

  it('gooit de PostgREST-fout door', async () => {
    const err = { message: 'boom' };
    await expect(
      fetchAllRows(() => Promise.resolve({ data: null, error: err })),
    ).rejects.toBe(err);
  });

  it('behandelt data: null als lege pagina', async () => {
    expect(await fetchAllRows(() => Promise.resolve({ data: null, error: null }))).toEqual([]);
  });
});
