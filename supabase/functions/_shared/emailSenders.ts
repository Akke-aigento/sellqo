/**
 * Centralized email sender configuration.
 *
 * Stream A — Platform → Tenant-users (NL communicatie, SellQo-branded)
 * Stream B — Tenant → Customers (sender name = tenant name, address on sellqo.app)
 *
 * sellqo.app is geverifieerd in Resend; geen extra DNS-werk.
 * Per-tenant verified domains zijn backlog (zie docs/email-architecture.md).
 */

const DEFAULT_REPLY_TO = "support@sellqo.app";

const sanitizeName = (raw: string | null | undefined, fallback = "SellQo"): string => {
  const v = (raw || "").trim();
  if (!v) return fallback;
  // strip control chars + double-quotes that would break the From header
  return v.replace(/["<>\r\n]/g, "").slice(0, 80) || fallback;
};

const resolveReplyTo = (tenantReplyTo?: string | null): string => {
  const v = (tenantReplyTo || "").trim();
  return v || DEFAULT_REPLY_TO;
};

export interface SenderConfig {
  from: string;
  replyTo?: string;
}

export const EMAIL_SENDERS = {
  // ── Stream A — Platform → Tenant-users ────────────────────────────
  invite: {
    from: "SellQo <invite@sellqo.app>",
    replyTo: "support@sellqo.app",
  } as SenderConfig,
  billing: {
    from: "SellQo <billing@sellqo.app>",
    replyTo: "support@sellqo.app",
  } as SenderConfig,
  notifications: {
    from: "SellQo <notifications@sellqo.app>",
    replyTo: "support@sellqo.app",
  } as SenderConfig,
  security: {
    from: "SellQo Security <security@sellqo.app>",
    replyTo: "support@sellqo.app",
  } as SenderConfig,
  noReply: {
    from: "SellQo <no-reply@sellqo.app>",
    replyTo: undefined,
  } as SenderConfig,

  // ── Stream B — Tenant → Customers ─────────────────────────────────
  orders: (tenantName: string, tenantReplyTo?: string | null): SenderConfig => ({
    from: `${sanitizeName(tenantName)} <orders@sellqo.app>`,
    replyTo: resolveReplyTo(tenantReplyTo),
  }),
  invoices: (tenantName: string, tenantReplyTo?: string | null): SenderConfig => ({
    from: `${sanitizeName(tenantName)} <invoices@sellqo.app>`,
    replyTo: resolveReplyTo(tenantReplyTo),
  }),
  quotes: (tenantName: string, tenantReplyTo?: string | null): SenderConfig => ({
    from: `${sanitizeName(tenantName)} <quotes@sellqo.app>`,
    replyTo: resolveReplyTo(tenantReplyTo),
  }),
  returns: (tenantName: string, tenantReplyTo?: string | null): SenderConfig => ({
    from: `${sanitizeName(tenantName)} <returns@sellqo.app>`,
    replyTo: resolveReplyTo(tenantReplyTo),
  }),
  giftCards: (tenantName: string, tenantReplyTo?: string | null): SenderConfig => ({
    from: `${sanitizeName(tenantName)} <gift-cards@sellqo.app>`,
    replyTo: resolveReplyTo(tenantReplyTo),
  }),
  marketing: (tenantName: string, tenantReplyTo?: string | null): SenderConfig => ({
    from: `${sanitizeName(tenantName)} <marketing@sellqo.app>`,
    replyTo: resolveReplyTo(tenantReplyTo),
  }),
  customerService: (tenantName: string, tenantReplyTo?: string | null): SenderConfig => ({
    from: `${sanitizeName(tenantName)} <customer-service@sellqo.app>`,
    replyTo: resolveReplyTo(tenantReplyTo),
  }),
} as const;

export type SenderKey =
  | "invite"
  | "billing"
  | "notifications"
  | "security"
  | "noReply"
  | "orders"
  | "invoices"
  | "quotes"
  | "returns"
  | "giftCards"
  | "marketing"
  | "customerService";