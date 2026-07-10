// Single source of truth for the set of invoice/credit-note statuses that
// count as "issued" for reporting purposes.
//
// VAT and revenue are due upon ISSUANCE of an invoice, regardless of whether
// it has been paid yet. Filtering reports on ('sent','paid') alone silently
// dropped invoices in the newer billing states 'processing' (charge in flight
// via SEPA/card mandate) and 'unpaid' (failed charge / dunning).
//
// Keep this list in sync with `src/lib/invoiceStatuses.ts` (frontend copy —
// Deno edge functions cannot import from src/). Any new invoice status added
// to `src/types/invoice.ts` must be classified here first.

export const ISSUED_INVOICE_STATUSES = [
  "unpaid",
  "sent",
  "processing",
  "paid",
] as const;

export const ISSUED_INVOICE_STATUSES_WITH_DRAFT = [
  "draft",
  ...ISSUED_INVOICE_STATUSES,
] as const;

// "Open" = issued but not yet settled. Used for aging / open-invoice counters.
export const OPEN_INVOICE_STATUSES = [
  "unpaid",
  "sent",
  "processing",
] as const;

// Credit-note statuses that count as issued. Drafts are excluded unless the
// caller explicitly opts in via include_drafts.
export const ISSUED_CREDIT_NOTE_STATUSES = ["sent", "processed"] as const;

export const ISSUED_CREDIT_NOTE_STATUSES_WITH_DRAFT = [
  "draft",
  ...ISSUED_CREDIT_NOTE_STATUSES,
] as const;

export function issuedInvoiceStatuses(includeDrafts = false): readonly string[] {
  return includeDrafts
    ? ISSUED_INVOICE_STATUSES_WITH_DRAFT
    : ISSUED_INVOICE_STATUSES;
}

export function issuedCreditNoteStatuses(includeDrafts = false): readonly string[] {
  return includeDrafts
    ? ISSUED_CREDIT_NOTE_STATUSES_WITH_DRAFT
    : ISSUED_CREDIT_NOTE_STATUSES;
}