# INV-DOC-1 + CN-AUTO-1 — Implementation plan

Scope reconciles with what already exists in the codebase after inspection. Before implementing, I want to confirm three concrete decisions with you because they materially change the surface area.

---

## PART A — Subscription invoice documents

### A1. Shared helper approach
`generate-invoice/index.ts` is ~1730 lines and mixes: order lookup, VAT resolver, VAT recalculation, PDF (Factur-X w/ embedded CII XML), UBL, archive insert, upload. A full lift-and-shift of `generateFacturXPDF` + `generateUBL` + all their dependent helpers (`calculateVat`, `calculateTaxBreakdown`, `generateOGM`, `generateCIIXml`, `escapeXml`, `getVatCategoryCode`, VAT_TEXTS, EU_COUNTRIES, formatters — ~1100 lines) into `_shared/invoiceDocuments.ts` and re-import back in `generate-invoice` is the literal reading of the batch, but it's a high-risk mechanical move for zero behavioural gain.

**Proposal**: create `_shared/invoiceDocuments.ts` exporting one function:

```ts
generateAndStoreInvoiceDocuments(supabase, invoice_id): Promise<{ pdf_url, ubl_url }>
```

It reads `invoices` + `invoice_lines` + `tenant` + `customer` + (optional) `orders` for the given invoice and generates PDF (Factur-X with embedded CII XML) + UBL, uploads both to the existing `invoices` bucket, inserts the `invoice_archive` row, and writes `pdf_url`/`ubl_url` back on the row. Same templates, same bucket, same fields.

`generate-invoice` is refactored so its final block (after invoice row + lines are inserted) delegates to this helper instead of inlining upload. Order-specific VAT resolution/recalculation stays in `generate-invoice` — the helper only handles document rendering + storage.

This satisfies the spec's intent ("both paths use identical document logic") while keeping the diff surgical and reviewable.

### A2. Subscription runner
After `subscription_invoices` link + subscription date advance, before the mandate charge block, call `generateAndStoreInvoiceDocuments(supabase, invoice.id)`. Wrapped in try/catch with `errMsg()` — failure logs a warning but does NOT roll back the invoice (matches existing "email failure never invalidates the invoice" pattern).

### A3. send-invoice-email defense
Load the invoice inside `send-invoice-email` (already does); if `pdf_url` is null, omit the "in bijlage vindt u de factuur" sentence from the i18n copy for all four languages. New i18n key `emailBody_noAttachment` per lang, selected when no `pdf_url`.

### A4. Backfill
Runner accepts `{ backfill_documents: true, tenant_id?: string }` on POST. In backfill mode it does not create invoices; it selects `invoices` where `subscription_id IS NOT NULL AND pdf_url IS NULL`, optionally scoped by `tenant_id`, and calls the helper for each. Returns per-invoice success/error summary.

---

## PART B — Automatic credit notes

### B1. Trigger point
Return status enum has 18 values. The point where "received and inspection approved" is final is a status transition to **`approved`** (or `inspected` on partial paths). To avoid guessing, I'll implement the trigger on the **transition INTO `approved`**, driven from the existing UI/RPC that moves a return to that state.

Practically:
1. Add a new edge function `create-credit-note-from-return` (service-role callable) that:
   - loads the return + return_items where `received_quantity > 0` (or falls back to `quantity` when inspection quantities weren't tracked, e.g. bol.com auto-approve),
   - resolves the original invoice via `orders.id -> invoices.order_id`,
   - if no invoice exists → log warning, exit success:false with reason `no_invoice`, do NOT create a credit note,
   - otherwise inserts `credit_notes` (type: full if all items+qty match invoice, else partial) + `credit_note_lines` mapped 1:1 from approved return_items, using `refund_amount` (already computed by returns flow) split into unit_price + vat according to the matched invoice_line's `vat_rate`,
   - calls `generate-credit-note` (which handles PDF + UBL + auto_send via tenant setting),
   - stamps the return with a new column `credit_note_id` for idempotency.
2. Wire the caller: whoever updates `returns.status` to `approved` (find the RPC/UI mutation) also invokes this function. To keep it truly channel-agnostic and to prevent drift, I'll add a **postgres trigger** on `returns` for `AFTER UPDATE OF status WHEN NEW.status = 'approved' AND OLD.status <> 'approved' AND NEW.credit_note_id IS NULL` that calls `pg_net.http_post` to the edge function. This works for bol.com auto-imports, admin UI, POS.

### B2. Secondary trigger (goodwill refunds)
In `process-refund` and `pos-refund-payment`, after a Stripe refund succeeds AND `return_id` is null (goodwill / price correction), invoke `generate-credit-note` for the refunded amount linked to the order's invoice. Idempotency: store the Stripe `refund.id` on the credit note (new column `stripe_refund_id`). If `process-refund` fires for a return that already has `credit_note_id`, it must NOT create a second one — it updates the existing credit note's `stripe_refund_id` and continues.

### B3. Idempotency schema
Migration adds:
- `credit_notes.return_id uuid REFERENCES returns(id)` (nullable), unique partial index
- `credit_notes.stripe_refund_id text` unique partial index
- `returns.credit_note_id uuid REFERENCES credit_notes(id)` (nullable)

### B4. Guardrails
- Skip AI-credit purchase refunds: process-refund is order-scoped so this is naturally excluded, but I'll add an explicit `if (!order_id)` skip in the goodwill branch too.
- Never touch invoice status. `paid`/`processing` invoices remain untouched — credit note affects revenue tracking, not the source invoice.
- All catch blocks use `errMsg()`.
- Column existence verified against `types.ts` before deploy (per project rule).

---

## Confirmations I need before starting

1. **A1 shared-helper scope**: OK to make the helper `invoice_id`-driven (reads from `invoices`/`invoice_lines`) rather than lift-and-shift the entire 1100-line generator module? Both paths still produce identical output because the generator functions themselves aren't duplicated.

2. **B1 trigger status**: Confirm the "received and inspection approved" moment is the transition into `returns.status = 'approved'` (NOT `inspected`, NOT `completed`). If your operational flow is different (e.g. bol.com skips straight to `refunded`), tell me the exact status and I'll target that plus a fallback list.

3. **B1 mechanism**: OK with a pg trigger + pg_net → edge function for channel-agnostic firing, or would you rather I only wire it from the admin UI + bol.com sync code paths (safer but not truly channel-agnostic)?

Once you confirm those three, I'll implement A1–A4 + B1–B4 in one pass, deploy, and verify.
