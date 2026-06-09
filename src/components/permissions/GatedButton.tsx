import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCan, type PermissionAction, type Resource } from "@/hooks/useCan";
import {
  TOOLTIP_NO_ACCESS_LONG,
  TOOLTIP_NO_ACCESS_SHORT,
} from "@/lib/permissions/constants";

type ButtonProps = ComponentProps<typeof Button>;

interface GatedButtonProps extends Omit<ButtonProps, "children"> {
  action: PermissionAction;
  resource: Resource;
  children: ReactNode;
  /**
   * H4 beslispunt H4-1: standaard disable+tooltip; gebruik 'hide' alleen
   * voor edge-cases waar het feature volledig irrelevant is voor de rol
   * (in dat geval is sidebar/route-guard normaal al genoeg).
   */
  fallback?: "disable" | "hide";
  tooltip?: string;
}

/**
 * H4b — knop met automatische permissie-check.
 * - Allowed → render gewone <Button>.
 * - Denied + fallback "disable" (default) → disabled button met tooltip.
 * - Denied + fallback "hide" → render niets.
 */
export const GatedButton = forwardRef<HTMLButtonElement, GatedButtonProps>(
  function GatedButton(
    {
      action,
      resource,
      children,
      fallback = "disable",
      tooltip,
      disabled,
      onClick,
      ...rest
    },
    ref,
  ) {
    const allowed = useCan(action, resource);

    if (allowed) {
      return (
        <Button
          ref={ref}
          disabled={disabled}
          onClick={onClick}
          {...rest}
        >
          {children}
        </Button>
      );
    }

    if (fallback === "hide") return null;

    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            {/* span wrapper zodat tooltip blijft werken op disabled button */}
            <span className="inline-flex">
              <Button
                ref={ref}
                disabled
                aria-disabled
                aria-label={TOOLTIP_NO_ACCESS_SHORT}
                onClick={(e) => e.preventDefault()}
                {...rest}
              >
                {children}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{tooltip ?? TOOLTIP_NO_ACCESS_LONG}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  },
);