// ODOO-API-2026 — unit tests voor bedrijf/persoon op res.partner over Odoo-versies heen (geen netwerk).
// Run: deno test --no-lock supabase/functions/_shared/odooPartnerType.test.ts
import { createPartnerTypeResolver, partnerTypeFields } from './odooPartnerType.ts';

function eq(actual: unknown, expected: unknown, msg = '') {
  const a = JSON.stringify(actual); const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg}\n  verwacht: ${e}\n  gekregen: ${a}`);
}

const odoo190 = { company_type: { type: 'selection', readonly: false }, is_company: { type: 'boolean', readonly: false } };
const odoo193 = { is_company: { type: 'boolean', readonly: false } };

Deno.test('Odoo 19.0: company_type zoals voorheen', async () => {
  const mode = await createPartnerTypeResolver(async () => odoo190)();
  eq(partnerTypeFields(mode, true), { company_type: 'company' }, 'bedrijf');
  eq(partnerTypeFields(mode, false), { company_type: 'person' }, 'persoon');
});

Deno.test('Odoo saas~19.3: nooit company_type, is_company enkel voor bedrijven', async () => {
  const mode = await createPartnerTypeResolver(async () => odoo193)();
  eq(partnerTypeFields(mode, true), { is_company: true }, 'bedrijf');
  eq(partnerTypeFields(mode, false), {}, 'persoon');
});

Deno.test('is_company alleen-lezen of fields_get faalt: niets meesturen', async () => {
  const ro = await createPartnerTypeResolver(async () => ({ is_company: { readonly: true } }))();
  eq(partnerTypeFields(ro, true), {}, 'readonly');
  const orig = console.warn; console.warn = () => {};
  try {
    const fail = await createPartnerTypeResolver(async () => { throw new Error('boom'); })();
    eq(partnerTypeFields(fail, true), {}, 'fout');
  } finally { console.warn = orig; }
});

Deno.test('fields_get draait één keer per resolver', async () => {
  let calls = 0;
  const r = createPartnerTypeResolver(async () => { calls++; return odoo193; });
  await Promise.all([r(), r(), r()]);
  eq(calls, 1, 'aantal calls');
});
