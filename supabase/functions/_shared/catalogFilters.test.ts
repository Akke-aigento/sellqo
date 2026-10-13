// CATALOG-FILTERS-1 — unit tests for catalog filter helpers (no network).
// Run: deno test --no-lock supabase/functions/_shared/catalogFilters.test.ts
import { buildOptionFacets, buildTagFacets, compareOptionValues, parseOptionFilter, productMatches } from './catalogFilters.ts';

function eq(actual: unknown, expected: unknown, msg = '') {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg}\n  expected ${e}\n  got      ${a}`);
}

const v = (attrs: Record<string, string>, stock = 5, track = true) => ({ attribute_values: attrs, stock, track_inventory: track });

Deno.test('parseOptionFilter normalises names and values, ignores junk', () => {
  const f = parseOptionFilter({ ' Maat ': ['S ', 'm'], Kleur: 'Blauw', Leeg: [] })!;
  eq([...f.keys()], ['maat', 'kleur']);
  eq([...f.get('maat')!], ['s', 'm']);
  eq(parseOptionFilter(null), null);
  eq(parseOptionFilter(['x']), null);
  eq(parseOptionFilter({}), null);
});

Deno.test('productMatches: option filter needs one variant matching every option', () => {
  const variants = [v({ Maat: 'S', Kleur: 'Blauw' }), v({ Maat: 'M ', Kleur: 'rood' })];
  eq(productMatches({}, variants, parseOptionFilter({ maat: ['m'], kleur: ['Rood'] }), false), true);
  eq(productMatches({}, variants, parseOptionFilter({ maat: ['s'], kleur: ['rood'] }), false), false, 'no single variant has S+rood');
  eq(productMatches({}, variants, parseOptionFilter({ maat: ['xl'] }), false), false);
});

Deno.test('productMatches: availability is per matching variant', () => {
  const variants = [v({ Maat: 'S' }, 0), v({ Maat: 'M' }, 3)];
  eq(productMatches({}, variants, parseOptionFilter({ maat: ['s'] }), true), false, 'S is sold out');
  eq(productMatches({}, variants, parseOptionFilter({ maat: ['m'] }), true), true);
  eq(productMatches({}, [v({ Maat: 'S' }, 0, false)], null, true), true, 'untracked stock counts as available');
});

Deno.test('productMatches: products without variants', () => {
  eq(productMatches({ track_inventory: true, stock: 0 }, [], null, true), false);
  eq(productMatches({ track_inventory: true, stock: 2 }, [], null, true), true);
  eq(productMatches({ track_inventory: false, stock: 0 }, [], null, false), true);
  eq(productMatches({ track_inventory: false }, [], parseOptionFilter({ maat: ['s'] }), false), false);
});

Deno.test('compareOptionValues: sizes, numbers, text', () => {
  eq(['XL', 's', 'M', 'xs', 'L'].sort(compareOptionValues), ['xs', 's', 'M', 'L', 'XL']);
  eq(['42', '38', '40'].sort(compareOptionValues), ['38', '40', '42']);
  eq(['rood', 'blauw'].sort(compareOptionValues), ['blauw', 'rood']);
});

Deno.test('buildOptionFacets: counts products once, merges spelling, sorts sizes', () => {
  const map = new Map([
    ['p1', [v({ Color: 'White ', Size: 'S ' }), v({ Color: 'White', Size: 'M' })]],
    ['p2', [v({ Color: 'white', Size: 's' }), v({ Color: 'Green', Size: 'XL' })]],
  ]);
  eq(buildOptionFacets(map), [
    { name: 'Color', values: [{ value: 'Green', count: 1 }, { value: 'White', count: 2 }] },
    { name: 'Size', values: [{ value: 'S', count: 2 }, { value: 'M', count: 1 }, { value: 'XL', count: 1 }] },
  ]);
});

Deno.test('buildTagFacets: most used first, case-insensitive', () => {
  eq(buildTagFacets([{ tags: ['Zomer', 'sale'] }, { tags: ['zomer'] }, { tags: null }]), [
    { value: 'Zomer', count: 2 }, { value: 'sale', count: 1 },
  ]);
});
