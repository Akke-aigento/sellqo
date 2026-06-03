import type { ReactNode } from "react";
import { useCan, type PermissionAction, type Resource } from "@/hooks/useCan";

interface PermissionGateProps {
  action: PermissionAction;
  resource: Resource;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Fase 2 Foundation — inline gating wrapper.
 *
 * ```tsx
 * <PermissionGate action="write" resource="orders">
 *   <Button>Bewerken</Button>
 * </PermissionGate>
 * ```
 */
export function PermissionGate({
  action,
  resource,
  children,
  fallback = null,
}: PermissionGateProps) {
  const allowed = useCan(action, resource);
  return <>{allowed ? children : fallback}</>;
}
