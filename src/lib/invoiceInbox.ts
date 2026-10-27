// INKOOP-4 — het facturenadres van een winkel. Zelfde regel als
// supabase/functions/_shared/inboundAddress.ts (invoiceInboxAddress).
export const INBOUND_DOMAIN = "mail.sellqo.app";
export const INVOICE_INBOX_TAG = "facturen";

export function invoiceInboxAddress(prefix: string): string {
  return `${prefix}+${INVOICE_INBOX_TAG}@${INBOUND_DOMAIN}`;
}
