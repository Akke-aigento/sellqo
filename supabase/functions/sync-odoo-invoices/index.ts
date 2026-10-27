// ODOO-2: per-tenant Odoo sync driven by tenant_odoo_credentials.
// - Iterates tenants where odoo_sync_enabled=true AND credentials exist.
// - Groups by (url, db, login): one authenticate per group, reused across tenants.
// - Per-tenant try/catch: one tenant's failure never breaks the whole run.
// - Pushes issued invoices + credit notes; account.move.name = Sellqo number.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2'
// BUILD-GREEN-1: `ReturnType<typeof createClient>` werd met de nieuwere supabase-js een
// client met schema `never` (elke rij `never`). Het type uit dezelfde module heeft
// een ongetypeerd schema en past altijd op wat createClient hier teruggeeft.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2'
import { denyUnlessCron } from '../_shared/marketplaceSyncAuth.ts'
import { decryptOdooKey } from '../_shared/odooCrypto.ts'
import { createPartnerTypeResolver, partnerTypeFields, type PartnerTypeMode } from '../_shared/odooPartnerType.ts'
import { amountsMatch, describeAmounts, planOdooLines, type Amounts, type SourceLine } from '../_shared/odooBooking.ts'
import { odooRpc as sharedOdooRpc, odooAuthenticate as sharedAuth, odooVersion as sharedVersion, assertValidOdooUrl, type OdooEnv } from '../_shared/odooRpc.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ISSUED_STATUSES = ['unpaid', 'sent', 'processing', 'paid'] as const
const ISSUED_CN_STATUSES = ['sent', 'processed'] as const

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message
  try { return JSON.stringify(e) } catch { return String(e) }
}

const odooRpc = sharedOdooRpc
const odooAuthenticate = sharedAuth
const odooVersion = sharedVersion

function execKw(env: OdooEnv, uid: number, model: string, method: string, args: unknown[], kwargs: Record<string, unknown> = {}) {
  return odooRpc(env, 'object', 'execute_kw', [env.db, uid, env.apiKey, model, method, args, kwargs])
}

interface SyncCtx {
  env: OdooEnv
  uid: number
  versionMajor: number
  journalId: number
  taxCache: Map<string, number> // key: `${rate}` -> tax id
  dummyPartnerId: number | null
  aggregateB2C: boolean
  dummyPartnerName: string
  tenantId: string
  supabase: SupabaseClient
  peppolSendEnabled: boolean
  tenantName: string
  channelAliases: Record<string, string>
  channelPartnerIds: Record<string, number>
  autoPost: boolean
  // ODOO-API-2026: company_type bestaat niet meer vanaf Odoo saas~19.3.
  partnerTypeMode: () => Promise<PartnerTypeMode>
}

// Known marketplace slugs on orders.marketplace_source that we treat as
// distinct sales channels for accounting aggregation.
const KNOWN_MARKETPLACES = new Set(['bol_com', 'amazon', 'ebay'])

const DEFAULT_CHANNEL_LABELS: Record<string, string> = {
  bol_com: 'Bol.com verkopen',
  webshop: 'Webshop verkopen',
  amazon: 'Amazon verkopen',
  ebay: 'eBay verkopen',
  subscription: 'Abonnementen',
  manual: 'Handmatige verkopen',
}

function resolveChannelDisplayName(ctx: SyncCtx, channel: string): string | null {
  const alias = ctx.channelAliases?.[channel]
  if (alias && typeof alias === 'string' && alias.trim()) return alias.trim()
  return DEFAULT_CHANNEL_LABELS[channel] ?? null
}

// Resolve the sales channel for a set of invoices in one batched query.
// DATA FACT: orders.sales_channel is unreliable for older Bol orders, so
//   1. invoice.order_id set -> order.marketplace_source if known marketplace,
//      else order.sales_channel, else 'webshop'
//   2. invoice.subscription_id set -> 'subscription'
//   3. neither -> 'manual'
async function resolveChannelsForInvoices(
  supabase: SupabaseClient,
  tenantId: string,
  invoiceIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (!invoiceIds.length) return out
  const { data: invRows } = await supabase
    .from('invoices')
    .select('id, order_id, subscription_id')
    .eq('tenant_id', tenantId)
    .in('id', invoiceIds)
  const rows = (invRows || []) as Array<{ id: string; order_id: string | null; subscription_id: string | null }>
  const orderIds = Array.from(new Set(rows.map(r => r.order_id).filter((v): v is string => !!v)))
  const orderMap = new Map<string, { marketplace_source: string | null; sales_channel: string | null }>()
  if (orderIds.length) {
    const { data: ordRows } = await supabase
      .from('orders')
      .select('id, marketplace_source, sales_channel')
      .eq('tenant_id', tenantId)
      .in('id', orderIds)
    for (const o of (ordRows || []) as Array<{ id: string; marketplace_source: string | null; sales_channel: string | null }>) {
      orderMap.set(o.id, { marketplace_source: o.marketplace_source, sales_channel: o.sales_channel })
    }
  }
  for (const r of rows) {
    if (r.order_id) {
      const o = orderMap.get(r.order_id)
      const ms = o?.marketplace_source
      if (ms && KNOWN_MARKETPLACES.has(ms)) out.set(r.id, ms)
      else if (o?.sales_channel) out.set(r.id, o.sales_channel)
      else out.set(r.id, 'webshop')
    } else if (r.subscription_id) {
      out.set(r.id, 'subscription')
    } else {
      out.set(r.id, 'manual')
    }
  }
  return out
}

async function resolveChannelsForCreditNotes(
  supabase: SupabaseClient,
  tenantId: string,
  cnIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (!cnIds.length) return out
  const { data: cnRows } = await supabase
    .from('credit_notes')
    .select('id, original_invoice_id')
    .eq('tenant_id', tenantId)
    .in('id', cnIds)
  const rows = (cnRows || []) as Array<{ id: string; original_invoice_id: string | null }>
  const invIds = Array.from(new Set(rows.map(r => r.original_invoice_id).filter((v): v is string => !!v)))
  const invChannels = await resolveChannelsForInvoices(supabase, tenantId, invIds)
  for (const r of rows) {
    if (r.original_invoice_id) {
      out.set(r.id, invChannels.get(r.original_invoice_id) || 'manual')
    } else {
      out.set(r.id, 'manual')
    }
  }
  return out
}

// Find-or-create the per-channel aggregate B2C partner in Odoo and cache the id
// in tenant_odoo_settings.channel_partner_ids.
async function ensureChannelPartner(ctx: SyncCtx, channel: string, displayName: string): Promise<number> {
  const cached = ctx.channelPartnerIds[channel]
  if (cached && Number.isFinite(cached)) return cached
  const name = `${displayName} — ${ctx.tenantName}`
  const existing = await execKw(ctx.env, ctx.uid, 'res.partner', 'search',
    [[['name', '=', name], ['customer_rank', '>', 0]]],
    { limit: 1 }) as number[]
  let id: number
  if (existing.length) id = existing[0]
  else {
    id = await execKw(ctx.env, ctx.uid, 'res.partner', 'create', [{
      name,
      ...partnerTypeFields(await ctx.partnerTypeMode(), false),
      customer_rank: 1,
      comment: 'SellQo aggregated B2C consumer sales — individual customers anonymized in accounting',
    }]) as number
  }
  ctx.channelPartnerIds[channel] = id
  await ctx.supabase.from('tenant_odoo_settings')
    .update({ channel_partner_ids: ctx.channelPartnerIds })
    .eq('tenant_id', ctx.tenantId)
  return id
}

interface OdooTaxRow { id: number; name?: string; tax_group_id?: [number, string] | false }

// Does an Odoo tax name reference the destination country ISO? VanXcel names its
// OSS taxes "<rate> <ISO> BTW" (e.g. "21.0% NL BTW").
function taxNameMatchesCountry(name: string | undefined, country: string): boolean {
  if (!name) return false
  return new RegExp(`(^|[^A-Z])${country.toUpperCase()}([^A-Z]|$)`).test(name.toUpperCase())
}

/**
 * ODOO-GUARD-1: welke 0%-code (exacte naam in Odoo nomadix-bv, gelezen 27-10) bij welk regime:
 * IC goederen "0% EU M" (rooster 46), driehoeksverkeer "0% EU T", IC diensten "0% EU S" (44),
 * export "0% EX" (47), anders binnenlands "0%". Tot 27-10 kreeg elke 0%-regel de eerste
 * 0%-code, dus het verkeerde roostervak. Exacte namen: een naamfragment kon een verkeerde code
 * raken; nu geeft een hernoemde code een duidelijke fout in plaats van een stille.
 */
function zeroTaxToken(regime: string | null): string {
  const r = String(regime || '')
  if (r === 'ic_supply_triangulation') return '0% EU T'
  if (r === 'ic_supply_goods' || r.startsWith('intracom_goods')) return '0% EU M'
  if (r === 'ic_supply_services' || r.startsWith('intracom_services')) return '0% EU S'
  if (r.startsWith('export')) return '0% EX'
  return '0%'
}

async function resolveTax(ctx: SyncCtx, rate: number, opts?: { oss?: boolean; country?: string | null; included?: boolean; zeroToken?: string | null }): Promise<number> {
  const roundedRate = Math.round(rate * 100) / 100
  const country = opts?.country ? String(opts.country).toUpperCase() : ''
  // ODOO-GUARD-1: prijs-inclusieve of exclusieve variant. Bestaande codes hebben
  // price_include_override leeg (= bedrijfsinstelling, exclusief).
  const included = opts?.included === true
  const inclDomain = included
    ? [['price_include_override', '=', 'tax_included']]
    : ['|', ['price_include_override', '=', false], ['price_include_override', '=', 'tax_excluded']]
  const missing = (what: string) => new Error(
    included
      ? `Prijs-inclusieve btw-code ${what} ontbreekt in Odoo (verkoop, "Inbegrepen in prijs"). Maak ze aan als kopie van de gewone code.`
      : `No Odoo sales tax found for ${what} (type_tax_use=sale)`,
  )

  // Non-OSS (domestic / IC / export): first matching rate.
  if (!opts?.oss || !country) {
    const zero = Number(rate) === 0 && opts?.zeroToken ? opts.zeroToken : null
    const key = `${included ? 'incl' : 'excl'}:${roundedRate}:${zero ?? ''}`
    const cached = ctx.taxCache.get(key)
    if (cached) return cached
    const zeroDomain = zero ? [['name', '=', zero]] : []
    const ids = await execKw(ctx.env, ctx.uid, 'account.tax', 'search',
      [[['amount', '=', Number(rate)], ['type_tax_use', '=', 'sale'], ['name', 'not ilike', 'OSS'], ['name', 'not ilike', ' BTW'], ...zeroDomain, ...inclDomain]],
      { limit: 1, order: 'sequence, id' }) as number[]
    if (!ids.length) throw missing(zero ? `0% (${zero})` : `${rate}%`)
    ctx.taxCache.set(key, ids[0])
    return ids[0]
  }

  // OSS: must land on the destination-country specific tax. Never silently fall
  // back to the domestic tax — that is exactly the misposting we're fixing.
  const key = `oss:${included ? 'incl' : 'excl'}:${country}:${roundedRate}`
  const cached = ctx.taxCache.get(key)
  if (cached) return cached

  const fields = { fields: ['id', 'name', 'tax_group_id'], limit: 50 }
  let rows = await execKw(ctx.env, ctx.uid, 'account.tax', 'search_read',
    [[['amount', '=', Number(rate)], ['type_tax_use', '=', 'sale'], ['name', 'ilike', 'OSS'], ...inclDomain]],
    fields) as OdooTaxRow[]
  let match = (rows || []).find(r => taxNameMatchesCountry(r.name, country))

  if (!match) {
    // Fallback: rate-only search, then match on tax group starting with "OSS"
    // plus the country ISO in the tax name.
    rows = await execKw(ctx.env, ctx.uid, 'account.tax', 'search_read',
      [[['amount', '=', Number(rate)], ['type_tax_use', '=', 'sale'], ...inclDomain]],
      fields) as OdooTaxRow[]
    match = (rows || []).find(r => {
      const group = Array.isArray(r.tax_group_id) ? String(r.tax_group_id[1] || '') : ''
      return group.trim().toUpperCase().startsWith('OSS') && taxNameMatchesCountry(r.name, country)
    })
  }

  if (!match) throw missing(`OSS ${country} ${rate}%`)
  ctx.taxCache.set(key, match.id)
  return match.id
}

async function ensureDummyPartner(ctx: SyncCtx): Promise<number> {
  if (ctx.dummyPartnerId) return ctx.dummyPartnerId
  const existing = await execKw(ctx.env, ctx.uid, 'res.partner', 'search',
    [[['name', '=', ctx.dummyPartnerName], ['customer_rank', '>', 0]]],
    { limit: 1 }) as number[]
  let id: number
  if (existing.length) id = existing[0]
  else {
    id = await execKw(ctx.env, ctx.uid, 'res.partner', 'create', [{
      name: ctx.dummyPartnerName,
      ...partnerTypeFields(await ctx.partnerTypeMode(), false),
      customer_rank: 1,
      comment: 'SellQo aggregated B2C consumer sales — individual customers anonymized in accounting',
    }]) as number
  }
  ctx.dummyPartnerId = id
  await ctx.supabase.from('tenant_odoo_settings').update({ b2c_dummy_partner_odoo_id: id }).eq('tenant_id', ctx.tenantId)
  return id
}

async function findOrCreatePartner(ctx: SyncCtx, opts: {
  name: string; email: string; phone?: string; vatNumber?: string; companyName?: string;
  street?: string; city?: string; zip?: string; country?: string;
}): Promise<{ partnerId: number; hasVat: boolean }> {
  const hasVat = !!(opts.vatNumber && opts.vatNumber.trim())
  // Try VAT first, then email
  if (hasVat) {
    const byVat = await execKw(ctx.env, ctx.uid, 'res.partner', 'search',
      [[['vat', '=', opts.vatNumber]]], { limit: 1 }) as number[]
    if (byVat.length) return { partnerId: byVat[0], hasVat }
  }
  if (opts.email) {
    const byEmail = await execKw(ctx.env, ctx.uid, 'res.partner', 'search',
      [[['email', '=', opts.email]]], { limit: 1 }) as number[]
    if (byEmail.length) return { partnerId: byEmail[0], hasVat }
  }
  // Country → country_id
  let countryId: number | false = false
  if (opts.country) {
    const cids = await execKw(ctx.env, ctx.uid, 'res.country', 'search',
      [[['code', '=', opts.country.toUpperCase()]]], { limit: 1 }) as number[]
    if (cids.length) countryId = cids[0]
  }
  const partnerId = await execKw(ctx.env, ctx.uid, 'res.partner', 'create', [{
    name: opts.companyName || opts.name,
    ...partnerTypeFields(await ctx.partnerTypeMode(), !!opts.companyName),
    email: opts.email || false,
    phone: opts.phone || false,
    vat: opts.vatNumber || false,
    street: opts.street || false,
    city: opts.city || false,
    zip: opts.zip || false,
    country_id: countryId,
    customer_rank: 1,
  }]) as number
  return { partnerId, hasVat }
}

// Best-effort Peppol send. Never throws — returns a status label.
async function tryPeppolSend(ctx: SyncCtx, moveId: number): Promise<{ status: 'sent' | 'skipped' | 'manual'; note?: string }> {
  // Odoo 17+/18: account.move.send wizard; older: action_invoice_send.
  try {
    // Attempt: create send wizard with peppol checking method
    // We'll call action_send_and_print if present (Odoo 17+).
    try {
      await execKw(ctx.env, ctx.uid, 'account.move', 'action_send_and_print',
        [[moveId]], { context: { discard_logo_check: true } })
      return { status: 'sent' }
    } catch (e1) {
      // Fallback: mark move as needing Peppol → user clicks in Odoo
      return { status: 'manual', note: `Auto Peppol-send unavailable on this Odoo version (${errMsg(e1)}). Posted; send manually from Odoo.` }
    }
  } catch (e) {
    return { status: 'manual', note: errMsg(e) }
  }
}

type SellqoLine = SourceLine

interface RegimeCtx { vat_regime: string | null; reporting_country: string | null }

// ODOO-GUARD-1: één Odoo-regel per SellQo-regel, hoeveelheid 1, bruto met prijs-inclusieve
// btw (of netto aan 0%). Zie _shared/odooBooking.ts.
async function buildOdooLines(ctx: SyncCtx, lines: SellqoLine[], regimeCtx: RegimeCtx, lineTotalIsNet: boolean): Promise<unknown[]> {
  const isOss = regimeCtx.vat_regime === 'oss_b2c_eu'
  const out: unknown[] = []
  for (const p of planOdooLines(lines, { lineTotalIsNet })) {
    const taxId = isOss && p.rate > 0
      ? await resolveTax(ctx, p.rate, { oss: true, country: regimeCtx.reporting_country, included: p.included })
      : await resolveTax(ctx, p.rate, { included: p.included, zeroToken: p.rate === 0 ? zeroTaxToken(regimeCtx.vat_regime) : null })
    out.push([0, 0, {
      name: p.name,
      quantity: 1,
      price_unit: p.price_unit,
      tax_ids: [[6, 0, [taxId]]],
    }])
  }
  return out
}

/**
 * ODOO-GUARD-1: maak (of hergebruik) de Odoo-boeking als concept, lees Odoo's totalen terug
 * en boek ze pas definitief als ze tot op de cent gelijk zijn aan SellQo. Hergebruik: een
 * boeking met hetzelfde nummer in hetzelfde dagboek (vorige poging liep na de create vast)
 * wordt niet dubbel aangemaakt. Bij een verschil blijft het concept staan en volgt een fout
 * (= sync-log 'failed' + melding).
 */
async function bookMove(ctx: SyncCtx, args: {
  name: string
  moveType: 'out_invoice' | 'out_refund'
  moveData: Record<string, unknown>
  expected: Amounts
  documentId: string
}): Promise<number> {
  const existing = await execKw(ctx.env, ctx.uid, 'account.move', 'search',
    [[['name', '=', args.name], ['journal_id', '=', ctx.journalId], ['move_type', '=', args.moveType], ['state', '!=', 'cancel']]],
    { limit: 1 }) as number[]
  const moveId = existing.length
    ? existing[0]
    : await execKw(ctx.env, ctx.uid, 'account.move', 'create', [args.moveData]) as number
  const [mv] = await execKw(ctx.env, ctx.uid, 'account.move', 'read',
    [[moveId], ['state', 'amount_untaxed', 'amount_tax', 'amount_total']]) as Array<{ state: string; amount_untaxed: number; amount_tax: number; amount_total: number }>
  const odoo: Amounts = { untaxed: mv.amount_untaxed, tax: mv.amount_tax, total: mv.amount_total }
  if (!amountsMatch(odoo, args.expected)) {
    const msg = `ODOO_MISMATCH: Odoo ${describeAmounts(odoo)} ≠ SellQo ${describeAmounts(args.expected)} (boeking ${args.name}, Odoo-id ${moveId}, ${mv.state === 'draft' ? 'concept, niet geboekt' : mv.state})`
    await notifyMismatch(ctx, args.documentId, args.name, msg)
    throw new Error(msg)
  }
  if (mv.state === 'draft' && ctx.autoPost) {
    await execKw(ctx.env, ctx.uid, 'account.move', 'action_post', [[moveId]])
  }
  return moveId
}

async function notifyMismatch(ctx: SyncCtx, documentId: string, number: string, message: string): Promise<void> {
  const { error } = await ctx.supabase.from('notifications').insert({
    tenant_id: ctx.tenantId,
    category: 'integrations',
    type: 'integration_error',
    priority: 'high',
    title: `Odoo-boeking ${number} wijkt af`,
    message: `${message}. Niets definitief geboekt; kijk het concept in Odoo na.`,
    data: { document_id: documentId, number, dedupe_key: `odoo_mismatch:${documentId}` },
  })
  if (error && (error as { code?: string }).code !== '23505') console.error('notify mismatch failed', errMsg(error))
}

async function loadCustomer(ctx: SyncCtx, customerId: string | null) {
  if (!customerId) return null
  const { data } = await ctx.supabase
    .from('customers')
    .select('email, first_name, last_name, phone, customer_type, company_name, vat_number, billing_street, billing_city, billing_postal_code, billing_country')
    .eq('id', customerId)
    .maybeSingle()
  return data
}

async function syncInvoice(ctx: SyncCtx, invoiceId: string, channel: string): Promise<{ moveId: number; peppol: { status: string; note?: string } }> {
  const { data: inv, error } = await ctx.supabase
    .from('invoices')
    .select('id, tenant_id, invoice_number, issue_date, customer_id, is_b2b, order_id, reporting_country, vat_regime, subtotal, tax_amount, total')
    .eq('id', invoiceId)
    .single()
  if (error || !inv) throw new Error(`Invoice not found: ${errMsg(error)}`)

  const { data: lines, error: linesErr } = await ctx.supabase
    .from('invoice_lines')
    .select('description, quantity, unit_price, vat_rate, line_type, vat_amount, net_amount, gross_amount, line_total')
    .eq('invoice_id', inv.id)
    .order('sort_order', { ascending: true })
  if (linesErr) throw new Error(`Invoice lines: ${errMsg(linesErr)}`)
  if (!lines || !lines.length) throw new Error('Invoice has no lines')

  const cust = await loadCustomer(ctx, inv.customer_id)
  const hasVat = !!(cust?.vat_number && cust.vat_number.trim())
  const isB2B = inv.is_b2b === true || hasVat

  let partnerId: number
  let audit: string | null = null
  const displayName = resolveChannelDisplayName(ctx, channel)
  if (ctx.aggregateB2C && !isB2B) {
    if (displayName) {
      partnerId = await ensureChannelPartner(ctx, channel, displayName)
    } else {
      partnerId = await ensureDummyPartner(ctx)
    }
    audit = `SellQo customer: ${[cust?.first_name, cust?.last_name].filter(Boolean).join(' ') || 'consumer'}${cust?.email ? ` <${cust.email}>` : ''} (invoice ${inv.invoice_number})`
  } else {
    const p = await findOrCreatePartner(ctx, {
      name: [cust?.first_name, cust?.last_name].filter(Boolean).join(' ') || cust?.company_name || 'Klant',
      email: cust?.email || '',
      phone: cust?.phone || undefined,
      vatNumber: cust?.vat_number || undefined,
      companyName: cust?.company_name || undefined,
      street: cust?.billing_street || undefined,
      city: cust?.billing_city || undefined,
      zip: cust?.billing_postal_code || undefined,
      country: cust?.billing_country || undefined,
    })
    partnerId = p.partnerId
  }

  const moveLines = await buildOdooLines(ctx, lines as SellqoLine[], {
    vat_regime: (inv as { vat_regime?: string | null }).vat_regime ?? null,
    reporting_country: (inv as { reporting_country?: string | null }).reporting_country ?? null,
  }, false)
  const moveData: Record<string, unknown> = {
    move_type: 'out_invoice',
    partner_id: partnerId,
    invoice_date: inv.issue_date || new Date().toISOString().split('T')[0],
    name: inv.invoice_number, // Sellqo number is the legal number
    journal_id: ctx.journalId,
    invoice_line_ids: moveLines,
  }
  if (audit) moveData.narration = audit
  if (displayName) moveData.ref = displayName

  const moveId = await bookMove(ctx, {
    name: inv.invoice_number,
    moveType: 'out_invoice',
    moveData,
    expected: { untaxed: Number(inv.subtotal), tax: Number(inv.tax_amount), total: Number(inv.total) },
    documentId: inv.id,
  })

  let peppol: { status: string; note?: string } = { status: 'skipped' }
  if (!ctx.autoPost) {
    // Concept-modus: laat het boeken + Peppol aan de boekhouder in Odoo.
    // Alleen B2B-documenten met BTW-nummer krijgen 'manual' (relevant voor Peppol);
    // B2C blijft 'skipped' zodat de bron-peppol_status niet muteert.
    if (isB2B && hasVat) {
      peppol = { status: 'manual', note: 'concept-modus: boeken + Peppol-verzending gebeurt in Odoo' }
    }
  } else if (ctx.peppolSendEnabled && isB2B && hasVat) {
    peppol = await tryPeppolSend(ctx, moveId)
  }
  return { moveId, peppol }
}

async function syncCreditNote(ctx: SyncCtx, cnId: string, channel: string): Promise<{ moveId: number; peppol: { status: string; note?: string } }> {
  const { data: cn, error } = await ctx.supabase
    .from('credit_notes')
    .select('id, tenant_id, credit_note_number, issue_date, customer_id, reason, original_invoice_id, subtotal, tax_amount, total')
    .eq('id', cnId)
    .single()
  if (error || !cn) throw new Error(`Credit note not found: ${errMsg(error)}`)

  // Resolve the source invoice's regime so OSS credit notes land on the
  // correct destination-country tax (mirror of syncInvoice's behaviour).
  let regimeCtx: RegimeCtx = { vat_regime: null, reporting_country: null }
  if (cn.original_invoice_id) {
    const { data: srcInv } = await ctx.supabase
      .from('invoices')
      .select('vat_regime, reporting_country')
      .eq('id', cn.original_invoice_id)
      .maybeSingle()
    if (srcInv) {
      regimeCtx = {
        vat_regime: srcInv.vat_regime ?? null,
        reporting_country: srcInv.reporting_country ?? null,
      }
    }
  }

  const { data: lines, error: linesErr } = await ctx.supabase
    .from('credit_note_lines')
    .select('description, quantity, unit_price, vat_rate, line_type, vat_amount, line_total')
    .eq('credit_note_id', cn.id)
  if (linesErr) throw new Error(`CN lines: ${errMsg(linesErr)}`)
  if (!lines || !lines.length) throw new Error('Credit note has no lines')

  const cust = await loadCustomer(ctx, cn.customer_id)
  const hasVat = !!(cust?.vat_number && cust.vat_number.trim())
  const isB2B = hasVat

  let partnerId: number
  let audit: string | null = cn.reason ? `Reason: ${cn.reason}` : null
  const displayName = resolveChannelDisplayName(ctx, channel)
  if (ctx.aggregateB2C && !isB2B) {
    if (displayName) {
      partnerId = await ensureChannelPartner(ctx, channel, displayName)
    } else {
      partnerId = await ensureDummyPartner(ctx)
    }
  } else {
    const p = await findOrCreatePartner(ctx, {
      name: [cust?.first_name, cust?.last_name].filter(Boolean).join(' ') || cust?.company_name || 'Klant',
      email: cust?.email || '',
      phone: cust?.phone || undefined,
      vatNumber: cust?.vat_number || undefined,
      companyName: cust?.company_name || undefined,
      street: cust?.billing_street || undefined,
      city: cust?.billing_city || undefined,
      zip: cust?.billing_postal_code || undefined,
      country: cust?.billing_country || undefined,
    })
    partnerId = p.partnerId
  }

  const moveLines = await buildOdooLines(ctx, lines as SellqoLine[], regimeCtx, true)

  // ODOO-GUARD-1: de creditnota verwijst naar de Odoo-boeking van haar factuur.
  let reversedEntryId: number | null = null
  let originalNumber: string | null = null
  if (cn.original_invoice_id) {
    const { data: origLog } = await ctx.supabase
      .from('odoo_invoice_sync_log')
      .select('odoo_move_id')
      .eq('invoice_id', cn.original_invoice_id)
      .eq('sync_status', 'synced')
      .not('odoo_move_id', 'is', null)
      .order('synced_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const n = Number(origLog?.odoo_move_id)
    if (Number.isFinite(n) && n > 0) {
      // Bestaat de originele boeking nog? (Een verwijderd concept zou de create laten falen.)
      const still = await execKw(ctx.env, ctx.uid, 'account.move', 'search', [[['id', '=', n]]], { limit: 1 }) as number[]
      if (still.length) reversedEntryId = n
    }
    const { data: origInv } = await ctx.supabase.from('invoices').select('invoice_number').eq('id', cn.original_invoice_id).maybeSingle()
    originalNumber = origInv?.invoice_number ?? null
  }
  const moveData: Record<string, unknown> = {
    move_type: 'out_refund',
    partner_id: partnerId,
    invoice_date: cn.issue_date || new Date().toISOString().split('T')[0],
    name: cn.credit_note_number,
    journal_id: ctx.journalId,
    invoice_line_ids: moveLines,
  }
  if (audit) moveData.narration = audit
  if (displayName) moveData.ref = displayName
  if (originalNumber) moveData.ref = `${displayName ? `${displayName} — ` : ''}creditnota voor ${originalNumber}`
  if (reversedEntryId) moveData.reversed_entry_id = reversedEntryId

  const moveId = await bookMove(ctx, {
    name: cn.credit_note_number,
    moveType: 'out_refund',
    moveData,
    expected: { untaxed: Number(cn.subtotal), tax: Number(cn.tax_amount), total: Number(cn.total) },
    documentId: cn.id,
  })

  let peppol: { status: string; note?: string } = { status: 'skipped' }
  if (!ctx.autoPost) {
    if (isB2B && hasVat) {
      peppol = { status: 'manual', note: 'concept-modus: boeken + Peppol-verzending gebeurt in Odoo' }
    }
  } else if (ctx.peppolSendEnabled && isB2B && hasVat) {
    peppol = await tryPeppolSend(ctx, moveId)
  }
  return { moveId, peppol }
}

/** Hoeveel documenten per tenant per run (de cron draait elk uur). */
const MAX_PER_RUN = 100

async function pagedIds(supabase: SupabaseClient, table: 'invoices' | 'credit_notes', tenantId: string, statuses: string[]): Promise<string[]> {
  const out: string[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from(table)
      .select('id')
      .eq('tenant_id', tenantId)
      .in('status', statuses)
      .order('created_at', { ascending: true })
      .range(from, from + 999)
    if (error) throw new Error(`${table} laden: ${errMsg(error)}`)
    out.push(...(data || []).map((r: { id: string }) => r.id))
    if (!data || data.length < 1000) return out
  }
}

/**
 * ODOO-GUARD-1: nooit geprobeerde documenten eerst, daarna die ooit faalden. Anders kunnen 100
 * documenten met een blijvend verschil elke nieuwe factuur tegenhouden.
 */
function neverTriedFirst(ids: string[], failedBefore: Set<string>): string[] {
  return [...ids.filter((id) => !failedBefore.has(id)), ...ids.filter((id) => failedBefore.has(id))]
}

async function failedSet(supabase: SupabaseClient, tenantId: string, documentType: string, column: 'invoice_id' | 'credit_note_id'): Promise<Set<string>> {
  const out = new Set<string>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('odoo_invoice_sync_log')
      .select(column)
      .eq('tenant_id', tenantId)
      .eq('document_type', documentType)
      .eq('sync_status', 'failed')
      .gte('created_at', new Date(Date.now() - 30 * 86400_000).toISOString())
      .order('created_at', { ascending: true })
      .range(from, from + 999)
    if (error) throw new Error(`sync-log laden: ${errMsg(error)}`)
    for (const r of (data || []) as Array<Record<string, string | null>>) if (r[column]) out.add(r[column] as string)
    if (!data || data.length < 1000) return out
  }
}

/** Alle reeds gesyncte documenten (gepagineerd: PostgREST geeft standaard max. 1000 rijen). */
async function syncedSet(supabase: SupabaseClient, tenantId: string, documentType: string, column: 'invoice_id' | 'credit_note_id'): Promise<Set<string>> {
  const out = new Set<string>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('odoo_invoice_sync_log')
      .select(column)
      .eq('tenant_id', tenantId)
      .eq('document_type', documentType)
      .eq('sync_status', 'synced')
      .order('created_at', { ascending: true })
      .range(from, from + 999)
    if (error) throw new Error(`sync-log laden: ${errMsg(error)}`)
    for (const r of (data || []) as Array<Record<string, string | null>>) if (r[column]) out.add(r[column] as string)
    if (!data || data.length < 1000) return out
  }
}

async function syncTenant(supabase: SupabaseClient, env: OdooEnv, uid: number, versionMajor: number, tenantId: string, opts: { invoiceIds?: string[]; creditNoteIds?: string[] } = {}) {
  // Load per-tenant settings
  const { data: settings, error: sErr } = await supabase
    .from('tenant_odoo_settings')
    .select('odoo_sync_enabled, odoo_journal_id, odoo_journal_name, aggregate_b2c_customers, b2c_dummy_partner_name, b2c_dummy_partner_odoo_id, peppol_send_enabled, channel_aliases, channel_partner_ids, odoo_auto_post')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (sErr) throw new Error(`Load settings: ${errMsg(sErr)}`)
  if (!settings?.odoo_sync_enabled) return { skipped: true, reason: 'sync disabled' }
  if (!settings.odoo_journal_id) throw new Error('Odoo-dagboek is niet geconfigureerd voor deze tenant.')

  // Verify journal id + name still match on live Odoo.
  const journalId = Number(settings.odoo_journal_id)
  const journalRows = await execKw(env, uid, 'account.journal', 'read',
    [[journalId], ['id', 'name', 'type']]) as Array<{ id: number; name: string; type: string }>
  if (!journalRows.length) throw new Error(`Geconfigureerd Odoo-dagboek (id ${journalId}) bestaat niet meer.`)
  const jr = journalRows[0]
  if (jr.type !== 'sale') throw new Error(`Odoo-dagboek ${jr.name} is geen verkoopdagboek (type=${jr.type}).`)
  if (settings.odoo_journal_name && jr.name !== settings.odoo_journal_name) {
    throw new Error(`Odoo-dagboek naam is gewijzigd (was '${settings.odoo_journal_name}', is nu '${jr.name}'). Herconfigureer in instellingen.`)
  }

  // Load tenant name for default B2C dummy partner name.
  const { data: tenantRow } = await supabase.from('tenants').select('name').eq('id', tenantId).maybeSingle()
  const tenantName = (tenantRow?.name as string | undefined) || 'SellQo'

  const ctx: SyncCtx = {
    env, uid, versionMajor, journalId,
    taxCache: new Map(),
    dummyPartnerId: settings.b2c_dummy_partner_odoo_id ?? null,
    aggregateB2C: settings.aggregate_b2c_customers === true,
    dummyPartnerName: settings.b2c_dummy_partner_name || `Diverse particulieren — ${tenantName}`,
    tenantId,
    supabase,
    peppolSendEnabled: settings.peppol_send_enabled !== false,
    tenantName,
    channelAliases: (settings.channel_aliases && typeof settings.channel_aliases === 'object') ? settings.channel_aliases as Record<string, string> : {},
    channelPartnerIds: (settings.channel_partner_ids && typeof settings.channel_partner_ids === 'object') ? settings.channel_partner_ids as Record<string, number> : {},
    autoPost: settings.odoo_auto_post !== false,
    partnerTypeMode: createPartnerTypeResolver((fields) =>
      execKw(env, uid, 'res.partner', 'fields_get', [fields], { attributes: ['type', 'readonly'] })),
  }

  const results = { invoices: { synced: 0, failed: 0, peppolManual: 0 }, creditNotes: { synced: 0, failed: 0, peppolManual: 0 }, errors: [] as string[] }

  // Invoices to sync
  let invIds: string[] = opts.invoiceIds ?? []
  if (!invIds.length) {
    const done = await syncedSet(supabase, tenantId, 'invoice', 'invoice_id')
    // ODOO-GUARD-1: alle uitgereikte facturen doorlopen (oudste eerst), niet de eerste 200
    // zonder volgorde: zodra die allemaal gesynct waren, werd niets nieuws meer opgepikt.
    const failedBefore = await failedSet(supabase, tenantId, 'invoice', 'invoice_id')
    invIds = neverTriedFirst((await pagedIds(supabase, 'invoices', tenantId, ISSUED_STATUSES as unknown as string[]))
      .filter((id: string) => !done.has(id)), failedBefore)
      .slice(0, MAX_PER_RUN)
  }

  // Batch-resolve channels for these invoices (single order query).
  const channelByInvoice = await resolveChannelsForInvoices(supabase, tenantId, invIds)

  for (const id of invIds) {
    try {
      const channel = channelByInvoice.get(id) || 'manual'
      const { moveId, peppol } = await syncInvoice(ctx, id, channel)
      await supabase.from('odoo_invoice_sync_log').insert({
        tenant_id: tenantId, invoice_id: id, document_type: 'invoice',
        odoo_move_id: String(moveId), sync_status: 'synced', sync_direction: 'push',
        peppol_status: peppol.status, peppol_note: peppol.note ?? null,
        synced_at: new Date().toISOString(),
      })
      if (peppol.status === 'sent') {
        await supabase.from('invoices')
          .update({ peppol_status: 'sent', peppol_sent_at: new Date().toISOString() })
          .eq('id', id)
      } else if (peppol.status === 'manual') {
        await supabase.from('invoices')
          .update({ peppol_status: 'manual_action' })
          .eq('id', id)
          .neq('peppol_status', 'sent')
      }
      results.invoices.synced++
      if (peppol.status === 'manual') results.invoices.peppolManual++
    } catch (e) {
      const msg = errMsg(e)
      results.invoices.failed++
      results.errors.push(`Invoice ${id}: ${msg}`)
      await supabase.from('odoo_invoice_sync_log').insert({
        tenant_id: tenantId, invoice_id: id, document_type: 'invoice',
        sync_status: 'failed', sync_direction: 'push', error_message: msg,
        synced_at: new Date().toISOString(),
      })
    }
  }

  // Credit notes to sync
  let cnIds: string[] = opts.creditNoteIds ?? []
  if (!cnIds.length) {
    const done = await syncedSet(supabase, tenantId, 'credit_note', 'credit_note_id')
    const failedBefore = await failedSet(supabase, tenantId, 'credit_note', 'credit_note_id')
    cnIds = neverTriedFirst((await pagedIds(supabase, 'credit_notes', tenantId, ISSUED_CN_STATUSES as unknown as string[]))
      .filter((id: string) => !done.has(id)), failedBefore)
      .slice(0, MAX_PER_RUN)
  }

  // Batch-resolve channels for these credit notes via their original invoices.
  const channelByCreditNote = await resolveChannelsForCreditNotes(supabase, tenantId, cnIds)

  for (const id of cnIds) {
    try {
      const channel = channelByCreditNote.get(id) || 'manual'
      const { moveId, peppol } = await syncCreditNote(ctx, id, channel)
      await supabase.from('odoo_invoice_sync_log').insert({
        tenant_id: tenantId, credit_note_id: id, document_type: 'credit_note',
        odoo_move_id: String(moveId), sync_status: 'synced', sync_direction: 'push',
        peppol_status: peppol.status, peppol_note: peppol.note ?? null,
        synced_at: new Date().toISOString(),
      })
      if (peppol.status === 'sent') {
        await supabase.from('credit_notes')
          .update({ peppol_status: 'sent', peppol_sent_at: new Date().toISOString() })
          .eq('id', id)
      } else if (peppol.status === 'manual') {
        await supabase.from('credit_notes')
          .update({ peppol_status: 'manual_action' })
          .eq('id', id)
          .neq('peppol_status', 'sent')
      }
      results.creditNotes.synced++
      if (peppol.status === 'manual') results.creditNotes.peppolManual++
    } catch (e) {
      const msg = errMsg(e)
      results.creditNotes.failed++
      results.errors.push(`CreditNote ${id}: ${msg}`)
      await supabase.from('odoo_invoice_sync_log').insert({
        tenant_id: tenantId, credit_note_id: id, document_type: 'credit_note',
        sync_status: 'failed', sync_direction: 'push', error_message: msg,
        synced_at: new Date().toISOString(),
      })
    }
  }

  return { skipped: false, ...results }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  // Versie-vingerafdruk na een deploy (doet niets, geen auth nodig).
  if (req.method === 'GET') return new Response(JSON.stringify({ ok: true, version: 'ODOO-GUARD-1' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const { tenantId, invoiceIds, creditNoteIds } = body as { tenantId?: string; invoiceIds?: string[]; creditNoteIds?: string[] }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // CRON-AUTH-1: alleen de cron of een andere functie. Zie _shared/marketplaceSyncAuth.ts.
    const denied = await denyUnlessCron(req, supabase, corsHeaders);
    if (denied) return denied;

    // Resolve target tenants: sync-enabled + have credentials.
    let tenantIds: string[]
    if (tenantId) {
      tenantIds = [tenantId]
    } else {
      const { data: enabled, error: eErr } = await supabase
        .from('tenant_odoo_settings')
        .select('tenant_id')
        .eq('odoo_sync_enabled', true)
      if (eErr) throw new Error(`List enabled tenants: ${errMsg(eErr)}`)
      tenantIds = (enabled || []).map((r: { tenant_id: string }) => r.tenant_id as string)
    }

    if (!tenantIds.length) {
      return new Response(JSON.stringify({ success: true, tenants: {}, note: 'Geen tenants met Odoo-sync ingeschakeld.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Load credentials for these tenants (service_role bypasses RLS).
    const { data: credRows, error: cErr } = await supabase
      .from('tenant_odoo_credentials')
      .select('tenant_id, odoo_url, odoo_db, odoo_login, api_key_ciphertext')
      .in('tenant_id', tenantIds)
    if (cErr) throw new Error(`Load credentials: ${errMsg(cErr)}`)

    const credMap = new Map<string, { url: string; db: string; login: string; ciphertext: string }>()
    for (const r of (credRows || []) as Array<{ tenant_id: string; odoo_url: string; odoo_db: string; odoo_login: string; api_key_ciphertext: string }>) {
      credMap.set(r.tenant_id, { url: r.odoo_url, db: r.odoo_db, login: r.odoo_login, ciphertext: r.api_key_ciphertext })
    }

    // Group tenants by (url, db, login) — reuse one authenticated session per group.
    const groups = new Map<string, { env: OdooEnv; tenants: string[] }>()
    const perTenant: Record<string, unknown> = {}

    for (const tId of tenantIds) {
      const cred = credMap.get(tId)
      if (!cred) {
        perTenant[tId] = { skipped: true, reason: 'no credentials configured' }
        console.log(`Tenant ${tId}: skipped (no credentials).`)
        continue
      }
      try {
        // Defense in depth: even for stored credentials, refuse anything that
        // isn't a strict https domain URL before performing any network I/O.
        const safeUrl = assertValidOdooUrl(cred.url)
        const apiKey = await decryptOdooKey(cred.ciphertext)
        const key = `${safeUrl}||${cred.db}||${cred.login}`
        let group = groups.get(key)
        if (!group) {
          group = { env: { url: safeUrl, db: cred.db, login: cred.login, apiKey }, tenants: [] }
          groups.set(key, group)
        }
        group.tenants.push(tId)
      } catch (e) {
        perTenant[tId] = { error: errMsg(e) }
        console.error(`Tenant ${tId} credential load failed:`, errMsg(e))
        await supabase.from('tenant_odoo_credentials').update({
          last_test_at: new Date().toISOString(), last_test_ok: false,
        }).eq('tenant_id', tId)
      }
    }

    let usedVersion: string | undefined
    for (const group of groups.values()) {
      let uid: number
      let versionMajor = 0
      try {
        uid = await odooAuthenticate(group.env)
        const version = await odooVersion(group.env)
        versionMajor = Array.isArray(version.server_version_info) ? Number(version.server_version_info[0]) : 0
        usedVersion = version.server_version ?? usedVersion
        console.log(`Odoo group ${group.env.url}/${group.env.db}: uid=${uid} version=${version.server_version}`)
      } catch (e) {
        const msg = errMsg(e)
        console.error(`Odoo group ${group.env.url}/${group.env.db} auth failed:`, msg)
        for (const tId of group.tenants) {
          perTenant[tId] = { error: `authenticate: ${msg}` }
          await supabase.from('tenant_odoo_credentials').update({
            last_test_at: new Date().toISOString(), last_test_ok: false,
          }).eq('tenant_id', tId)
        }
        continue
      }

      for (const tId of group.tenants) {
        try {
          perTenant[tId] = await syncTenant(supabase, group.env, uid, versionMajor, tId, { invoiceIds, creditNoteIds })
        } catch (e) {
          perTenant[tId] = { error: errMsg(e) }
          console.error(`Tenant ${tId} sync failed:`, errMsg(e))
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      odoo_version: usedVersion,
      tenants: perTenant,
      note: 'ODOO_URL/ODOO_DB/ODOO_LOGIN/ODOO_API_KEY env-secrets zijn niet meer nodig en mogen verwijderd worden.',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    const msg = errMsg(error)
    console.error('sync-odoo-invoices fatal:', msg)
    return new Response(JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
