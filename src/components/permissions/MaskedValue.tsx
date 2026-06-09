import type { ReactNode } from "react";
import { useCan, type Resource } from "@/hooks/useCan";

interface MaskedValueProps {
  resource: Resource;
  children: ReactNode;
  mask?: string;
  className?: string;
}

/**
 * H4b (beslispunt H4-7) — field-level masking. Toont `mask` (••• default)
 * als de huidige rol geen `read` recht heeft op `resource`, anders de
 * normale waarde.
 */
export function MaskedValue({
  resource,
  children,
  mask = "•••",
  className,
}: MaskedValueProps) {
  const allowed = useCan("read", resource);
  if (!allowed) {
    return (
      <span
        className={className}
        aria-label="Verborgen voor jouw rol"
        title="Geen toegang"
      >
        {mask}
      </span>
    );
  }
  return <>{children}</>;
}