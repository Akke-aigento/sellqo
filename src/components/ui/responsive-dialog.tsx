import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type MaxWidth = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";

const MAX_WIDTH_CLASS: Record<MaxWidth, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-xl",
  "2xl": "sm:max-w-2xl",
  "3xl": "sm:max-w-3xl",
  "4xl": "sm:max-w-4xl",
};

export interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: MaxWidth;
  footer?: React.ReactNode;
  className?: string;
}

export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  maxWidth = "lg",
  footer,
  className,
}: ResponsiveDialogProps) {
  const isMobile = useIsMobile();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          isMobile
            ? "h-[100dvh] w-screen max-w-none rounded-none p-0 flex flex-col gap-0"
            : cn("max-h-[90vh] flex flex-col gap-0 p-0", MAX_WIDTH_CLASS[maxWidth]),
          className,
        )}
      >
        <DialogHeader className="p-6 pb-4 border-b shrink-0">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
        {footer && (
          <DialogFooter className="p-4 border-t shrink-0 bg-background">{footer}</DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}