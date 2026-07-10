// Frontend mirror of supabase/functions/_shared/invoiceStatuses.ts.
// Keep both files in sync — Deno edge functions cannot import from src/,
// so we intentionally duplicate the constants rather than diverge.
//
// See the shared file for the full rationale (VAT is due on issuance).

import type { InvoiceStatus } from "@/types/invoice";

export const ISSUED_INVOICE_STATUSES: InvoiceStatus[] = [
  "unpaid",
  "sent",
  "processing",
  "paid",
];

export const ISSUED_INVOICE_STATUSES_WITH_DRAFT: InvoiceStatus[] = [
  "draft",
  ...ISSUED_INVOICE_STATUSES,
];

// "Open" = issued but not yet settled. Used for aging / open-invoice counters.
export const OPEN_INVOICE_STATUSES: InvoiceStatus[] = [
  "unpaid",
  "sent",
  "processing",
];

export const ISSUED_CREDIT_NOTE_STATUSES = ["sent", "processed"] as const;

export const ISSUED_CREDIT_NOTE_STATUSES_WITH_DRAFT = [
  "draft",
  ...ISSUED_CREDIT_NOTE_STATUSES,
] as const;

export function issuedInvoiceStatuses(includeDrafts = false): InvoiceStatus[] {
  return includeDrafts
    ? ISSUED_INVOICE_STATUSES_WITH_DRAFT
    : ISSUED_INVOICE_STATUSES;
}