// FOOD-1 — unit tests voor extra's (geen netwerk).
// Run: deno test --no-lock supabase/functions/_shared/productAddons.test.ts
import { AddonError, addonsLabel, applicableGroups, resolveAddonSelection } from './productAddons.ts';

function eq(actual: unknown, expected: unknown, msg = '') {
  const a = JSON.stringify(actual); const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg}\n  verwacht: ${e}\n  gekregen: ${a}`);
}
function throwsCode(fn: () => unknown, code: string) {
  try { fn(); } catch (e) { if (e instanceof AddonError && e.code === code) return; throw new Error(`verkeerde fout: ${e}`); }
  throw new Error(`verwachtte ${code}`);
}

const groups = [
  { id: 'g1', name: 'Extra toppings', min_select: 0, max_select: 3, category_ids: ['pizza'], product_ids: [] },
  { id: 'g2', name: 'Saus', min_select: 1, max_select: 1, category_ids: [], product_ids: ['p1'] },
  { id: 'g3', name: 'Leeg', min_select: 0, max_select: null, category_ids: ['pizza'], product_ids: [] },
  { id: 'g4', name: 'Dranken', min_select: 0, max_select: null, category_ids: ['drank'], product_ids: [] },
];
const options = [
  { id: 'o1', group_id: 'g1', name: 'Extra kaas', price: '1.5' },
  { id: 'o2', group_id: 'g1', name: 'Champignons', price: 1 },
  { id: 'o3', group_id: 'g1', name: 'Ham', price: 2 },
  { id: 'o4', group_id: 'g1', name: 'Salami', price: 2 },
  { id: 'o5', group_id: 'g2', name: 'Tomaat', price: 0 },
  { id: 'o6', group_id: 'g2', name: 'Room', price: 0.5 },
  { id: 'o7', group_id: 'g4', name: 'Cola', price: 2.5 },
];

Deno.test('groepen via product of categorie, lege groepen weg', () => {
  eq(applicableGroups(groups, options, 'p1', ['pizza']).map((g) => g.id), ['g1', 'g2']);
  eq(applicableGroups(groups, options, 'p2', ['pizza']).map((g) => g.id), ['g1']);
  eq(applicableGroups(groups, options, 'p3', []).map((g) => g.id), []);
  eq(applicableGroups(groups, options, 'p1', ['pizza'])[0].options[0].price, 1.5, 'prijs als getal');
});

const g = applicableGroups(groups, options, 'p1', ['pizza']);

Deno.test('geldige keuze: totaal, vaste volgorde en sleutel', () => {
  const r = resolveAddonSelection(g, ['o6', 'o2', 'o1']);
  eq(r.addons.map((a) => a.name), ['Extra kaas', 'Champignons', 'Room']);
  eq(r.total, 3);
  eq(r.key, 'o1,o2,o6');
  eq(resolveAddonSelection(g, ['o1', 'o2', 'o6']).key, r.key, 'zelfde keuze = zelfde sleutel');
});

Deno.test('dubbele ID tellen één keer', () => {
  eq(resolveAddonSelection(g, ['o5', 'o1', 'o1']).total, 1.5);
});

Deno.test('verplichte groep en maximum', () => {
  throwsCode(() => resolveAddonSelection(g, []), 'ADDON_MIN');
  throwsCode(() => resolveAddonSelection(g, ['o5', 'o6']), 'ADDON_MAX');
  throwsCode(() => resolveAddonSelection(g, ['o5', 'o1', 'o2', 'o3', 'o4']), 'ADDON_MAX');
});

Deno.test('optie van een ander product of onbekend', () => {
  throwsCode(() => resolveAddonSelection(g, ['o5', 'o7']), 'ADDON_INVALID');
  throwsCode(() => resolveAddonSelection(g, ['o5', 'bestaat-niet']), 'ADDON_INVALID');
});

Deno.test('product zonder extra\'s: geen sleutel, totaal 0', () => {
  eq(resolveAddonSelection([], undefined), { addons: [], total: 0, key: null });
  throwsCode(() => resolveAddonSelection([], ['o1']), 'ADDON_INVALID');
});

Deno.test('afronding en label', () => {
  const gg = applicableGroups([{ id: 'x', name: 'X', min_select: 0, max_select: null, category_ids: [], product_ids: ['p'] }],
    [{ id: 'a', group_id: 'x', name: 'A', price: 0.1 }, { id: 'b', group_id: 'x', name: 'B', price: 0.2 }], 'p', []);
  eq(resolveAddonSelection(gg, ['a', 'b']).total, 0.3);
  eq(addonsLabel([{ name: 'A' }, { name: 'B' }]), 'A, B');
  eq(addonsLabel(null), '');
});

Deno.test('ALLERGEN-2: allergenen van een extra alleen als ingevuld', () => {
  const groups = [{ id: 'g', name: 'Toppings', min_select: 0, max_select: null, category_ids: [], product_ids: ['p'] }];
  const opts = [
    { id: 'a', group_id: 'g', name: 'Ansjovis', price: 1.5, allergens: ['fish'] },
    { id: 'b', group_id: 'g', name: 'Rucola', price: 1, allergens: [] },
  ];
  const [g] = applicableGroups(groups, opts, 'p', []);
  if (JSON.stringify(g.options[0].allergens) !== '["fish"]') throw new Error('ansjovis = vis');
  if ('allergens' in g.options[1]) throw new Error('leeg = geen sleutel');
});
