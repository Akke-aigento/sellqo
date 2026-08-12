/**
 * DEPRECATED legacy adapter. Nieuwe code: `import { toast } from "sonner"`.
 * Houdt de oude shadcn-API (title/description/variant) in leven bovenop Sonner,
 * zodat bestaande call-sites niet hoeven te wijzigen.
 */
import type * as React from "react";
import { toast as sonnerToast } from "sonner";

type LegacyToastProps = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: "default" | "destructive" | null;
  duration?: number;
  action?: React.ReactNode;
};

function toast({ title, description, variant, duration, action }: LegacyToastProps) {
  const message = title ?? description ?? "";
  const options = {
    description: title ? description : undefined,
    duration,
    action,
  } as Parameters<typeof sonnerToast>[1];

  const id =
    variant === "destructive"
      ? sonnerToast.error(message as string, options)
      : sonnerToast(message as string, options);

  return {
    id: String(id),
    dismiss: () => sonnerToast.dismiss(id),
    update: () => {}, // niet in gebruik in dit project
  };
}

function useToast() {
  return {
    toast,
    dismiss: (toastId?: string | number) => sonnerToast.dismiss(toastId),
    toasts: [] as never[], // compat-stub, geen consumers
  };
}

export { useToast, toast };
