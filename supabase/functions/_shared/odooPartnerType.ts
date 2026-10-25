// ODOO-API-2026: res.partner bedrijf/persoon versie-onafhankelijk zetten.
//
// Odoo saas~19.3 verwijderde het veld `company_type` op res.partner
// (https://mergebot.odoo.com/odoo/odoo/pull/211043). Een create/write met dat
// veld faalt daar met "Invalid field 'company_type' in 'res.partner'" — sinds
// 24-10-2026 faalde zo élke Fonske-factuursync.
//
// Werkwijze: eenmalig per Odoo-omgeving `fields_get` op res.partner en dan:
//   - `company_type` bestaat → zoals voorheen ('company' / 'person');
//   - anders `is_company` bestaat en is schrijfbaar → `is_company: true` enkel
//     voor bedrijven; voor personen het veld weglaten (default false; in 19.3
//     wordt het bovendien afgeleid uit het btw-nummer);
//   - anders (of fields_get faalt) → niets meesturen.

export type PartnerTypeMode = 'company_type' | 'is_company' | 'none'

type FieldsGet = (fields: string[]) => Promise<unknown>

interface FieldInfo { readonly?: boolean }

export async function detectPartnerTypeMode(fieldsGet: FieldsGet): Promise<PartnerTypeMode> {
  let fields: Record<string, FieldInfo>
  try {
    fields = ((await fieldsGet(['company_type', 'is_company'])) || {}) as Record<string, FieldInfo>
  } catch (e) {
    console.warn('[odooPartnerType] fields_get op res.partner faalde, stuur geen bedrijf/persoon-veld mee:', e instanceof Error ? e.message : e)
    return 'none'
  }
  if (fields.company_type) return 'company_type'
  if (fields.is_company && fields.is_company.readonly !== true) return 'is_company'
  return 'none'
}

export function partnerTypeFields(mode: PartnerTypeMode, isCompany: boolean): Record<string, unknown> {
  if (mode === 'company_type') return { company_type: isCompany ? 'company' : 'person' }
  if (mode === 'is_company' && isCompany) return { is_company: true }
  return {}
}

// Memoiseert de detectie: één fields_get per resolver (= per tenant-run).
export function createPartnerTypeResolver(fieldsGet: FieldsGet): () => Promise<PartnerTypeMode> {
  let pending: Promise<PartnerTypeMode> | null = null
  return () => (pending ??= detectPartnerTypeMode(fieldsGet))
}
