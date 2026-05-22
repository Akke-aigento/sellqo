/**
 * Peppol BIS Billing 3.0 UBL builder — archive-mode MVP (Fase 4.2).
 *
 * Produces either an <Invoice> (380) or <CreditNote> (381) XML document
 * compliant with the BIS 3.0 customisation.
 *
 * Validation done here:
 * - Structural completeness of mandatory fields
 * - Well-formed XML output (caller may run `assertWellFormedXml`)
 *
 * Full XSD + Schematron validation is intentionally deferred to Fase 4.7.
 */

import { resolveEndpointId, stripVatCountry, vatCountryCode, type PartyIdentity } from './identifiers.ts';
import { taxCategoryFor, type TaxCategoryMapping } from './tax-categories.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export interface UblParty {
  /** Legal/registered name. */
  name: string;
  /** ISO-2 country code. */
  country: string;
  /** VAT number incl. country prefix, e.g. "BE1017500207". */
  vatNumber?: string | null;
  /** Company / KBO / KvK registration number. */
  registrationNumber?: string | null;
  street?: string | null;
  city?: string | null;
  postalCode?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
}

export interface UblLine {
  /** Sequential index (1-based). */
  id: number;
  description: string;
  /** Decimal quantity (BIS allows 4dp). */
  quantity: number;
  /** UN/ECE Rec 20 unit code; default "C62" (piece). */
  unitCode?: string;
  /** Net unit price (excl. VAT). */
  unitPrice: number;
  /** Net line total (excl. VAT). */
  lineTotal: number;
  /** Applied VAT rate as a percentage value, e.g. 21 for 21%. */
  vatRate: number;
}

export interface UblInvoiceInput {
  documentType: 'invoice' | 'credit_note';
  documentNumber: string;
  issueDate: string;          // YYYY-MM-DD
  dueDate?: string | null;    // YYYY-MM-DD
  currency: string;           // ISO-4217, e.g. "EUR"
  buyerReference?: string | null;
  paymentReference?: string | null;  // OGM if available
  supplier: UblParty;
  customer: UblParty;
  vatRegime: string;
  lines: UblLine[];
  /** Authoritative document-level subtotal (LineExtensionAmount). */
  subtotal: number;
  /** Authoritative document-level VAT amount. */
  taxAmount: number;
  /** Authoritative document-level grand total. */
  total: number;
  /** Payable rounding adjustment (default 0). */
  payableRounding?: number;
  /** Supplier IBAN for credit transfer (PaymentMeans code 30). */
  iban?: string | null;
  /** Optional BIC. */
  bic?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function xmlEscape(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function fmt2(n: number): string {
  const safe = Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  return safe.toFixed(2);
}

function fmtQty(n: number): string {
  // BIS allows up to 4dp on quantities; trim trailing zeros but keep at least 2.
  const rounded = Math.round((Number(n) + Number.EPSILON) * 10000) / 10000;
  return rounded.toFixed(Math.max(2, (String(rounded).split('.')[1] ?? '').length));
}

function assertNonEmpty(label: string, v: unknown): string {
  const s = String(v ?? '').trim();
  if (!s) throw new Error(`UBL: required field "${label}" is empty`);
  return s;
}

/** Lightweight well-formedness check (tag balance). */
export function assertWellFormedXml(xml: string): void {
  const stripped = xml.replace(/<\?xml[^?]*\?>/, '').trim();
  const opens = stripped.match(/<[^/!?][^>]*[^/]>/g)?.length ?? 0;
  const closes = stripped.match(/<\/[^>]+>/g)?.length ?? 0;
  if (opens !== closes) {
    throw new Error(`UBL XML not well-formed: ${opens} open vs ${closes} close tags`);
  }
}

/** Per-VAT-rate aggregation. */
interface TaxSubtotal {
  rate: number;
  taxable: number;
  tax: number;
  category: TaxCategoryMapping;
}

function aggregateTaxSubtotals(input: UblInvoiceInput): TaxSubtotal[] {
  const category = taxCategoryFor(input.vatRegime);
  const byRate = new Map<number, { taxable: number }>();
  for (const l of input.lines) {
    const r = Number(l.vatRate ?? 0);
    const cur = byRate.get(r) ?? { taxable: 0 };
    cur.taxable += Number(l.lineTotal ?? 0);
    byRate.set(r, cur);
  }
  const out: TaxSubtotal[] = [];
  for (const [rate, { taxable }] of byRate.entries()) {
    const taxableR = Math.round((taxable + Number.EPSILON) * 100) / 100;
    // For zero-rated / exempt / reverse-charge categories we never compute tax.
    const isZeroish = category.id !== 'S';
    const tax = isZeroish ? 0 : Math.round((taxableR * rate / 100 + Number.EPSILON) * 100) / 100;
    out.push({ rate, taxable: taxableR, tax, category });
  }
  return out.sort((a, b) => b.rate - a.rate);
}

// ─────────────────────────────────────────────────────────────────────────────
// Party block
// ─────────────────────────────────────────────────────────────────────────────

function partyXml(role: 'AccountingSupplier' | 'AccountingCustomer', p: UblParty, indent: string): string {
  assertNonEmpty(`${role}.name`, p.name);
  assertNonEmpty(`${role}.country`, p.country);
  assertNonEmpty(`${role}.street`, p.street);
  assertNonEmpty(`${role}.city`, p.city);
  assertNonEmpty(`${role}.postalCode`, p.postalCode);
  if (!p.vatNumber) throw new Error(`UBL: ${role} party must have a VAT number`);

  const identity: PartyIdentity = {
    country: p.country,
    vatNumber: p.vatNumber,
    registrationNumber: p.registrationNumber,
  };
  const endpoint = resolveEndpointId(identity);

  const lines: string[] = [];
  lines.push(`${indent}<cac:${role}Party>`);
  lines.push(`${indent}  <cac:Party>`);
  lines.push(`${indent}    <cbc:EndpointID schemeID="${xmlEscape(endpoint.schemeId)}">${xmlEscape(endpoint.value)}</cbc:EndpointID>`);
  lines.push(`${indent}    <cac:PartyName><cbc:Name>${xmlEscape(p.name)}</cbc:Name></cac:PartyName>`);
  lines.push(`${indent}    <cac:PostalAddress>`);
  lines.push(`${indent}      <cbc:StreetName>${xmlEscape(p.street!)}</cbc:StreetName>`);
  lines.push(`${indent}      <cbc:CityName>${xmlEscape(p.city!)}</cbc:CityName>`);
  lines.push(`${indent}      <cbc:PostalZone>${xmlEscape(p.postalCode!)}</cbc:PostalZone>`);
  lines.push(`${indent}      <cac:Country><cbc:IdentificationCode>${xmlEscape(p.country.toUpperCase())}</cbc:IdentificationCode></cac:Country>`);
  lines.push(`${indent}    </cac:PostalAddress>`);

  // PartyTaxScheme — full VAT number with country prefix
  lines.push(`${indent}    <cac:PartyTaxScheme>`);
  lines.push(`${indent}      <cbc:CompanyID>${xmlEscape(p.vatNumber)}</cbc:CompanyID>`);
  lines.push(`${indent}      <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>`);
  lines.push(`${indent}    </cac:PartyTaxScheme>`);

  // PartyLegalEntity — registered name + registration number (without country prefix).
  // Falls back to VAT digits without prefix when no registration number is set.
  const legalId = (p.registrationNumber && p.registrationNumber.trim())
    ? p.registrationNumber.trim()
    : stripVatCountry(p.vatNumber);
  lines.push(`${indent}    <cac:PartyLegalEntity>`);
  lines.push(`${indent}      <cbc:RegistrationName>${xmlEscape(p.name)}</cbc:RegistrationName>`);
  lines.push(`${indent}      <cbc:CompanyID schemeID="${vatCountryCode(p.vatNumber) === 'BE' ? '0208' : (resolveEndpointId(identity).schemeId)}">${xmlEscape(legalId)}</cbc:CompanyID>`);
  lines.push(`${indent}    </cac:PartyLegalEntity>`);

  if (p.contactEmail || p.contactPhone) {
    lines.push(`${indent}    <cac:Contact>`);
    if (p.contactPhone) lines.push(`${indent}      <cbc:Telephone>${xmlEscape(p.contactPhone)}</cbc:Telephone>`);
    if (p.contactEmail) lines.push(`${indent}      <cbc:ElectronicMail>${xmlEscape(p.contactEmail)}</cbc:ElectronicMail>`);
    lines.push(`${indent}    </cac:Contact>`);
  }

  lines.push(`${indent}  </cac:Party>`);
  lines.push(`${indent}</cac:${role}Party>`);
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Tax + totals + lines
// ─────────────────────────────────────────────────────────────────────────────

function taxTotalXml(input: UblInvoiceInput, indent: string): string {
  const subtotals = aggregateTaxSubtotals(input);
  const totalTax = subtotals.reduce((s, x) => s + x.tax, 0);
  // Use the authoritative document-level tax_amount instead of recomputed sum to
  // guarantee BR-CO-13 consistency vs LegalMonetaryTotal. The recomputed value
  // is exposed only inside each TaxSubtotal.
  const taxAmount = Math.round((Number(input.taxAmount) + Number.EPSILON) * 100) / 100;
  const lines: string[] = [];
  lines.push(`${indent}<cac:TaxTotal>`);
  lines.push(`${indent}  <cbc:TaxAmount currencyID="${input.currency}">${fmt2(taxAmount)}</cbc:TaxAmount>`);
  for (const s of subtotals) {
    lines.push(`${indent}  <cac:TaxSubtotal>`);
    lines.push(`${indent}    <cbc:TaxableAmount currencyID="${input.currency}">${fmt2(s.taxable)}</cbc:TaxableAmount>`);
    lines.push(`${indent}    <cbc:TaxAmount currencyID="${input.currency}">${fmt2(s.tax)}</cbc:TaxAmount>`);
    lines.push(`${indent}    <cac:TaxCategory>`);
    lines.push(`${indent}      <cbc:ID>${s.category.id}</cbc:ID>`);
    lines.push(`${indent}      <cbc:Percent>${fmt2(s.rate)}</cbc:Percent>`);
    if (s.category.exemptionReason) {
      lines.push(`${indent}      <cbc:TaxExemptionReason>${xmlEscape(s.category.exemptionReason)}</cbc:TaxExemptionReason>`);
    }
    lines.push(`${indent}      <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>`);
    lines.push(`${indent}    </cac:TaxCategory>`);
    lines.push(`${indent}  </cac:TaxSubtotal>`);
  }
  // BR-CO-13 sanity: |sum(subtotal tax) − header taxAmount| ≤ €0.01
  if (Math.abs(totalTax - taxAmount) > 0.01) {
    throw new Error(`UBL BR-CO-13 mismatch: sum(TaxSubtotal)=${fmt2(totalTax)} vs header=${fmt2(taxAmount)}`);
  }
  lines.push(`${indent}</cac:TaxTotal>`);
  return lines.join('\n');
}

function monetaryTotalXml(input: UblInvoiceInput, indent: string, tagName: 'LegalMonetaryTotal'): string {
  const lineExt = Math.round((Number(input.subtotal) + Number.EPSILON) * 100) / 100;
  const taxExcl = lineExt;
  const taxIncl = Math.round((Number(input.total) + Number.EPSILON) * 100) / 100;
  const payable = taxIncl;
  const rounding = Math.round((Number(input.payableRounding ?? 0) + Number.EPSILON) * 100) / 100;
  return [
    `${indent}<cac:${tagName}>`,
    `${indent}  <cbc:LineExtensionAmount currencyID="${input.currency}">${fmt2(lineExt)}</cbc:LineExtensionAmount>`,
    `${indent}  <cbc:TaxExclusiveAmount currencyID="${input.currency}">${fmt2(taxExcl)}</cbc:TaxExclusiveAmount>`,
    `${indent}  <cbc:TaxInclusiveAmount currencyID="${input.currency}">${fmt2(taxIncl)}</cbc:TaxInclusiveAmount>`,
    `${indent}  <cbc:PayableRoundingAmount currencyID="${input.currency}">${fmt2(rounding)}</cbc:PayableRoundingAmount>`,
    `${indent}  <cbc:PayableAmount currencyID="${input.currency}">${fmt2(payable)}</cbc:PayableAmount>`,
    `${indent}</cac:${tagName}>`,
  ].join('\n');
}

function linesXml(input: UblInvoiceInput, indent: string): string {
  const isCN = input.documentType === 'credit_note';
  const tag = isCN ? 'CreditNoteLine' : 'InvoiceLine';
  const qtyTag = isCN ? 'CreditedQuantity' : 'InvoicedQuantity';
  const category = taxCategoryFor(input.vatRegime);

  const out: string[] = [];
  for (const l of input.lines) {
    const unit = (l.unitCode || 'C62').toUpperCase();
    out.push(`${indent}<cac:${tag}>`);
    out.push(`${indent}  <cbc:ID>${l.id}</cbc:ID>`);
    out.push(`${indent}  <cbc:${qtyTag} unitCode="${unit}">${fmtQty(l.quantity)}</cbc:${qtyTag}>`);
    out.push(`${indent}  <cbc:LineExtensionAmount currencyID="${input.currency}">${fmt2(l.lineTotal)}</cbc:LineExtensionAmount>`);
    out.push(`${indent}  <cac:Item>`);
    out.push(`${indent}    <cbc:Name>${xmlEscape(l.description || 'Item')}</cbc:Name>`);
    out.push(`${indent}    <cac:ClassifiedTaxCategory>`);
    out.push(`${indent}      <cbc:ID>${category.id}</cbc:ID>`);
    out.push(`${indent}      <cbc:Percent>${fmt2(l.vatRate ?? 0)}</cbc:Percent>`);
    out.push(`${indent}      <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>`);
    out.push(`${indent}    </cac:ClassifiedTaxCategory>`);
    out.push(`${indent}  </cac:Item>`);
    out.push(`${indent}  <cac:Price>`);
    out.push(`${indent}    <cbc:PriceAmount currencyID="${input.currency}">${fmt2(l.unitPrice)}</cbc:PriceAmount>`);
    out.push(`${indent}    <cbc:BaseQuantity unitCode="${unit}">1</cbc:BaseQuantity>`);
    out.push(`${indent}  </cac:Price>`);
    out.push(`${indent}</cac:${tag}>`);
  }
  return out.join('\n');
}

function paymentMeansXml(input: UblInvoiceInput, indent: string): string {
  if (!input.iban) return '';
  const lines: string[] = [];
  lines.push(`${indent}<cac:PaymentMeans>`);
  lines.push(`${indent}  <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>`);
  if (input.paymentReference) {
    lines.push(`${indent}  <cbc:PaymentID>${xmlEscape(input.paymentReference)}</cbc:PaymentID>`);
  }
  lines.push(`${indent}  <cac:PayeeFinancialAccount>`);
  lines.push(`${indent}    <cbc:ID>${xmlEscape(input.iban.replace(/\s+/g, ''))}</cbc:ID>`);
  if (input.bic) {
    lines.push(`${indent}    <cac:FinancialInstitutionBranch><cbc:ID>${xmlEscape(input.bic)}</cbc:ID></cac:FinancialInstitutionBranch>`);
  }
  lines.push(`${indent}  </cac:PayeeFinancialAccount>`);
  lines.push(`${indent}</cac:PaymentMeans>`);
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Top-level builder
// ─────────────────────────────────────────────────────────────────────────────

const CUSTOMIZATION_ID = 'urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0';
const PROFILE_ID = 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0';

export function buildPeppolUbl(input: UblInvoiceInput): string {
  assertNonEmpty('documentNumber', input.documentNumber);
  assertNonEmpty('issueDate', input.issueDate);
  assertNonEmpty('currency', input.currency);
  if (!input.lines.length) throw new Error('UBL: at least one line is required');

  const isCN = input.documentType === 'credit_note';
  const rootTag = isCN ? 'CreditNote' : 'Invoice';
  const typeCode = isCN ? 381 : 380;

  const ns = [
    `xmlns="urn:oasis:names:specification:ubl:schema:xsd:${rootTag}-2"`,
    `xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"`,
    `xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"`,
  ].join('\n  ');

  const parts: string[] = [];
  parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  parts.push(`<${rootTag}\n  ${ns}>`);
  parts.push(`  <cbc:CustomizationID>${CUSTOMIZATION_ID}</cbc:CustomizationID>`);
  parts.push(`  <cbc:ProfileID>${PROFILE_ID}</cbc:ProfileID>`);
  parts.push(`  <cbc:ID>${xmlEscape(input.documentNumber)}</cbc:ID>`);
  parts.push(`  <cbc:IssueDate>${input.issueDate}</cbc:IssueDate>`);
  if (input.dueDate) parts.push(`  <cbc:DueDate>${input.dueDate}</cbc:DueDate>`);
  // CreditNote uses CreditNoteTypeCode, Invoice uses InvoiceTypeCode
  parts.push(`  <cbc:${isCN ? 'CreditNoteTypeCode' : 'InvoiceTypeCode'}>${typeCode}</cbc:${isCN ? 'CreditNoteTypeCode' : 'InvoiceTypeCode'}>`);
  parts.push(`  <cbc:DocumentCurrencyCode>${input.currency}</cbc:DocumentCurrencyCode>`);
  if (input.buyerReference) {
    parts.push(`  <cbc:BuyerReference>${xmlEscape(input.buyerReference)}</cbc:BuyerReference>`);
  } else {
    // BIS 3.0 requires either BuyerReference or OrderReference; fall back to invoice ID
    parts.push(`  <cbc:BuyerReference>${xmlEscape(input.documentNumber)}</cbc:BuyerReference>`);
  }

  parts.push(partyXml('AccountingSupplier', input.supplier, '  '));
  parts.push(partyXml('AccountingCustomer', input.customer, '  '));

  const pm = paymentMeansXml(input, '  ');
  if (pm) parts.push(pm);

  parts.push(taxTotalXml(input, '  '));
  parts.push(monetaryTotalXml(input, '  ', 'LegalMonetaryTotal'));
  parts.push(linesXml(input, '  '));

  parts.push(`</${rootTag}>`);
  const xml = parts.join('\n');
  assertWellFormedXml(xml);
  return xml;
}