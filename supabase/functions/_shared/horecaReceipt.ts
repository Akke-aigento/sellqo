// PRINT-2 — van horeca_receipt_data (SQL) naar het ReceiptModel van horecaPrint.ts. Puur, getest.
import type { ReceiptModel } from "./horecaPrint.ts";

export interface ReceiptData {
  tenant_id: string;
  store_name: string | null;
  address: (string | null)[] | null;
  vat_number: string | null;
  tenant_lang: string | null;
  origin: "kassa" | "online";
  online_kind: "full" | "share" | "items" | null;
  table: string | null;
  when: string;
  receipt_no: string | null;
  lines: { quantity: number; name: string; total_cents: number; addons?: string[] | null }[] | null;
  paid_cents: number;
  prepaid_cents?: number | null;
  tip_cents: number;
  rounding_cents: number;
  tenders: { method?: string; amount_cents?: number }[] | null;
  rest_open: boolean;
  fiscal: boolean;
  status: string;
  stripe_session_id: string | null;
}

/**
 * Zelfde product met dezelfde extra's samen op één regel. Een annulering na versturen is een
 * negatieve lijn: samen met het origineel valt die weg (aantal 0 en bedrag 0).
 */
export function mergeLines(raw: NonNullable<ReceiptData["lines"]>): ReceiptModel["lines"] {
  const out = new Map<string, ReceiptModel["lines"][number]>();
  for (const l of raw) {
    const addons = (l.addons ?? []).filter(Boolean).map(String);
    const name = String(l.name ?? "");
    const key = `${name}\u0000${addons.join("\u0000")}`;
    const prev = out.get(key);
    const q = Number(l.quantity) || 0;
    const c = Number(l.total_cents) || 0;
    if (prev) { prev.quantity += q; prev.totalCents += c; } else out.set(key, { quantity: q, name, totalCents: c, addons });
  }
  return [...out.values()].filter((l) => l.quantity !== 0 || l.totalCents !== 0);
}

export function receiptModelFromData(d: ReceiptData): ReceiptModel {
  return {
    storeName: d.store_name ?? "",
    address: (d.address ?? []).map((a) => String(a ?? "").trim()).filter(Boolean),
    vatNumber: d.vat_number?.trim() || null,
    origin: d.origin,
    onlineKind: d.origin === "online" ? d.online_kind ?? null : null,
    table: d.table ?? null,
    when: d.when,
    receiptNo: d.receipt_no ?? null,
    lines: mergeLines(d.lines ?? []),
    paidCents: Number(d.paid_cents) || 0,
    prepaidCents: Number(d.prepaid_cents) || 0,
    tipCents: Number(d.tip_cents) || 0,
    roundingCents: Number(d.rounding_cents) || 0,
    tenders: (d.tenders ?? [])
      .filter((t) => Number(t.amount_cents) > 0)
      .map((t) => ({ method: String(t.method ?? "other"), amountCents: Number(t.amount_cents) })),
    restOpen: !!d.rest_open,
  };
}

/** Eenvoudige, strikte controle (één adres, geen komma's of spaties). */
export function isMailAddress(raw: unknown): raw is string {
  const s = typeof raw === "string" ? raw.trim() : "";
  return s.length >= 6 && s.length <= 254 && /^[^\s@,;<>]+@[^\s@,;<>]+\.[a-z]{2,}$/i.test(s);
}

export async function sha256Hex(s: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  return Array.from(h, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Plafonds voor de knop "Mail bon" aan de kassa. */
export const MAILS_PER_PAYMENT = 3;
export const MAILS_PER_DAY = 300;
