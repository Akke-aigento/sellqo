import { useContext } from "react";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import { TenantContext } from "@/hooks/useTenant";

/**
 * Fase 2 Foundation — permissie-matrix.
 *
 * Bron-van-waarheid: `docs/sellqo-fase2-masterplan.md` Hoofdstuk 2.
 * Wijzigingen aan deze matrix MOETEN in beide plekken tegelijk gebeuren.
 *
 * Actions: 'read' | 'write'.
 * Een lege array betekent "niemand" (behalve platform_admin, die altijd
 * voldoet via de bypass in `useCan`).
 */
export type PermissionAction = "read" | "write" | "correct";

export type Resource =
  | "orders"
  | "order_status"
  | "returns"
  | "refunds"
  | "invoices"
  | "credit_notes"
  | "payments"
  | "customers"
  | "customer_notes"
  | "inbox"
  | "products"
  | "product_costs"
  | "discount_codes"
  | "ads"
  | "ad_budgets"
  | "marketing"
  | "cms"
  | "seo"
  | "themes"
  | "reports"
  | "vat"
  | "integrations"
  | "webhooks_api"
  | "team"
  | "settings_general"
  | "settings_financial"
  | "platform_billing"
  | "ai_assistant"
  | "ai_coach"
  | "pos"
  | "loyalty"
  | "automations"
  | "volume_discounts"
  | "social_channels"
  | "suppliers"
  | "ops_helpers"
  | "global_lookups"
  | "sellqo_legal";

type Matrix = Record<Resource, Partial<Record<PermissionAction, AppRole[]>>>;

const ALL_ROLES: AppRole[] = [
  "platform_admin",
  "tenant_admin",
  "accountant",
  "staff",
  "warehouse",
  "viewer",
  "marketing",
];

/**
 * Matrix derived from Hoofdstuk 2. Read = wie SELECT mag, Write = wie INSERT/UPDATE/DELETE mag.
 * `platform_admin` is altijd opgenomen voor consistentie, maar wordt sowieso
 * via een bypass in `useCan` afgevangen.
 */
export const PERMISSION_MATRIX: Matrix = {
  orders: {
    read: ALL_ROLES,
    write: ["platform_admin", "tenant_admin", "staff", "warehouse"],
  },
  order_status: {
    // 'correct' = bypass van de fulfillment status-transition-matrix.
    // Alleen tenant_admin (en platform_admin via bypass) mag corrigeren.
    correct: ["platform_admin", "tenant_admin"],
  },
  returns: {
    read: ALL_ROLES.filter((r) => r !== "marketing"),
    write: ["platform_admin", "tenant_admin", "staff", "warehouse"],
  },
  refunds: {
    read: ["platform_admin", "tenant_admin", "accountant", "viewer"],
    write: ["platform_admin", "tenant_admin"],
  },
  invoices: {
    read: ALL_ROLES.filter((r) => r !== "warehouse" && r !== "marketing"),
    write: ["platform_admin", "tenant_admin", "staff"],
  },
  credit_notes: {
    // Iedereen behalve warehouse mag inkijken (zichtbaarheid voor accountant/viewer);
    // schrijven en e-mailen is voorbehouden aan admin/staff/accountant — matrix Hoofdstuk 2.
    read: ALL_ROLES.filter((r) => r !== "warehouse" && r !== "marketing"),
    write: ["platform_admin", "tenant_admin", "staff", "accountant"],
  },
  payments: {
    read: ["platform_admin", "tenant_admin", "staff", "accountant", "viewer"],
    write: ["platform_admin", "tenant_admin"],
  },
  customers: {
    read: ALL_ROLES,
    write: ["platform_admin", "tenant_admin", "staff"],
  },
  customer_notes: {
    read: ["platform_admin", "tenant_admin", "staff", "viewer"],
    write: ["platform_admin", "tenant_admin", "staff"],
  },
  inbox: {
    read: ["platform_admin", "tenant_admin", "staff", "viewer", "marketing"],
    write: ["platform_admin", "tenant_admin", "staff", "marketing"],
  },
  products: {
    read: ALL_ROLES,
    write: ["platform_admin", "tenant_admin", "staff"],
  },
  product_costs: {
    read: ["platform_admin", "tenant_admin", "accountant", "warehouse"],
    write: ["platform_admin", "tenant_admin"],
  },
  discount_codes: {
    read: ALL_ROLES.filter((r) => r !== "warehouse"),
    write: ["platform_admin", "tenant_admin", "marketing"],
  },
  ads: {
    read: ["platform_admin", "tenant_admin", "staff", "viewer", "marketing"],
    write: ["platform_admin", "tenant_admin", "marketing"],
  },
  ad_budgets: {
    // Budget-vrijgave blijft expliciet bij tenant_admin (en platform_admin via bypass).
    read: ["platform_admin", "tenant_admin", "accountant"],
    write: ["platform_admin", "tenant_admin"],
  },
  marketing: {
    read: ["platform_admin", "tenant_admin", "staff", "viewer", "marketing"],
    write: ["platform_admin", "tenant_admin", "staff", "marketing"],
  },
  cms: {
    read: ["platform_admin", "tenant_admin", "staff", "viewer", "marketing"],
    write: ["platform_admin", "tenant_admin", "staff", "marketing"],
  },
  seo: {
    read: ["platform_admin", "tenant_admin", "staff", "viewer", "marketing"],
    write: ["platform_admin", "tenant_admin", "staff", "marketing"],
  },
  themes: {
    read: ["platform_admin", "tenant_admin", "staff", "viewer"],
    write: ["platform_admin", "tenant_admin", "staff"],
  },
  reports: {
    read: ALL_ROLES.filter((r) => r !== "warehouse"),
    write: [],
  },
  vat: {
    read: ["platform_admin", "tenant_admin", "accountant", "viewer"],
    write: ["platform_admin", "tenant_admin", "accountant"],
  },
  integrations: {
    read: ["platform_admin", "tenant_admin", "viewer"],
    write: ["platform_admin", "tenant_admin"],
  },
  webhooks_api: {
    read: ["platform_admin", "tenant_admin"],
    write: ["platform_admin", "tenant_admin"],
  },
  team: {
    read: ["platform_admin", "tenant_admin"],
    write: ["platform_admin", "tenant_admin"],
  },
  settings_general: {
    read: ["platform_admin", "tenant_admin", "viewer"],
    write: ["platform_admin", "tenant_admin"],
  },
  settings_financial: {
    read: ["platform_admin", "tenant_admin", "accountant"],
    write: ["platform_admin", "tenant_admin"],
  },
  platform_billing: {
    read: ["platform_admin", "tenant_admin", "accountant"],
    write: ["platform_admin"],
  },
  ai_assistant: {
    read: ["platform_admin", "tenant_admin", "staff", "viewer"],
    write: ["platform_admin", "tenant_admin", "staff"],
  },
  ai_coach: {
    read: ["platform_admin", "tenant_admin", "staff", "viewer"],
    write: ["platform_admin", "tenant_admin", "staff"],
  },
  pos: {
    read: ALL_ROLES,
    write: ["platform_admin", "tenant_admin", "staff", "warehouse"],
  },
  loyalty: {
    read: ALL_ROLES.filter((r) => r !== "warehouse"),
    write: ["platform_admin", "tenant_admin", "staff"],
  },
  automations: {
    read: ["platform_admin", "tenant_admin", "staff", "viewer"],
    write: ["platform_admin", "tenant_admin"],
  },
  volume_discounts: {
    read: ["platform_admin", "tenant_admin", "staff", "viewer", "marketing"],
    write: ["platform_admin", "tenant_admin", "marketing"],
  },
  social_channels: {
    read: ["platform_admin", "tenant_admin", "staff", "viewer", "marketing"],
    write: ["platform_admin", "tenant_admin", "staff", "marketing"],
  },
  suppliers: {
    read: ["platform_admin", "tenant_admin", "accountant", "warehouse"],
    write: ["platform_admin", "tenant_admin"],
  },
  ops_helpers: {
    read: ["platform_admin", "tenant_admin", "staff", "accountant"],
    write: ["platform_admin"],
  },
  global_lookups: {
    read: ALL_ROLES,
    write: ["platform_admin"],
  },
  sellqo_legal: {
    read: ALL_ROLES,
    write: ["platform_admin"],
  },
};

/**
 * Pure check — exposed for unit tests so we don't need to mock useAuth.
 * Platform admins always pass.
 */
export function canWithRoles(
  roles: AppRole[],
  action: PermissionAction,
  resource: Resource
): boolean {
  if (roles.includes("platform_admin")) return true;
  const allowed = PERMISSION_MATRIX[resource]?.[action] ?? [];
  return roles.some((r) => allowed.includes(r));
}

/**
 * `useCan('write', 'orders')` → boolean.
 * Geeft `false` zolang auth nog laadt of er geen user is.
 */
export function useCan(action: PermissionAction, resource: Resource): boolean {
  const { roles, loading, user } = useAuth();
  const tenantCtx = useContext(TenantContext);
  const currentTenantId = tenantCtx?.currentTenant?.id ?? null;
  if (loading || !user) return false;
  // H4-5: filter per-tenant zodat cross-tenant rollen niet lekken.
  // platform_admin blijft globaal (bypass in canWithRoles).
  const scoped = (roles ?? []).filter((r) => {
    if (r.role === "platform_admin") return true;
    if (r.tenant_id == null) return true;
    if (currentTenantId == null) return false;
    return r.tenant_id === currentTenantId;
  });
  const flat = scoped.map((r) => r.role as AppRole);
  return canWithRoles(flat, action, resource);
}
