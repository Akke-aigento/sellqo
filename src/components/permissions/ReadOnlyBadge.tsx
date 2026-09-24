import { Badge } from "@/components/ui/badge";
import { Lock } from "lucide-react";
import { useCanWithReason, type PermissionAction, type Resource } from "@/hooks/useCan";

interface ReadOnlyBadgeProps {
  action?: PermissionAction;
  resource: Resource;
  label?: string;
  className?: string;
}

/**
 * H4b (beslispunt H4-2) — kleine "Alleen-lezen" badge die alleen rendert
 * wanneer de huidige rol GEEN write-toegang heeft op de gegeven resource.
 * Render naast de page-title.
 */
export function ReadOnlyBadge({
  action = "write",
  resource,
  label,
  className,
}: ReadOnlyBadgeProps) {
  const { allowed, reason } = useCanWithReason(action, resource);
  if (allowed) return null;
  // BILLING-ENFORCE-1: leesmodus door een openstaande betaling leest anders dan
  // "je rol mag dit niet" — en is wél op te lossen door de winkel zelf.
  const text = label ?? (reason === "billing" ? "Leesmodus — betaling openstaand" : "Alleen-lezen");
  return (
    <Badge variant="secondary" className={className}>
      <Lock className="mr-1 h-3 w-3" aria-hidden="true" />
      {text}
    </Badge>
  );
}