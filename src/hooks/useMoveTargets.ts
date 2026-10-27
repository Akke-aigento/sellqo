import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";

/** Rollen die een document naar een andere winkel mogen verplaatsen (zelfde regel als de functie). */
const MOVE_ROLES = ["tenant_admin", "staff"];

/** INKOOP-5 — winkels waar deze gebruiker zelf beheerder of medewerker is (niet de huidige). */
export function useMoveTargets() {
  const { roles } = useAuth();
  const { tenants, currentTenant } = useTenant();
  return useMemo(() => {
    const allowed = new Set(roles.filter((r) => MOVE_ROLES.includes(r.role) && r.tenant_id).map((r) => r.tenant_id as string));
    return tenants.filter((t) => allowed.has(t.id) && t.id !== currentTenant?.id);
  }, [roles, tenants, currentTenant?.id]);
}
