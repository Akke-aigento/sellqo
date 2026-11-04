import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * HORECA-STAAT-1 — meldingen (toasts) in het beheer en de kassa-app.
 * - Wegswipen naar boven, links of rechts (vroeger enkel naar boven; op een gsm veegt een duim zijwaarts).
 * - Altijd een sluitkruisje.
 * - Gewone melding 4 s; een fout blijft langer staan (8 s), maar is evengoed weg te vegen of te sluiten.
 * - Bovenaan (onder de statusbalk van de gsm): nooit over de onderbalk.
 */
const TOAST_SWIPE_DIRECTIONS = ["top", "left", "right"] as const;
const TOAST_DURATION_MS = 4000;
const ERROR_TOAST_DURATION_MS = 8000;

// Fouten krijgen standaard 8 s (een eigen `duration` bij de aanroep wint). Eén keer, bij het laden van de module.
type ErrorFn = typeof toast.error & { __sqLonger?: true };
if (!(toast.error as ErrorFn).__sqLonger) {
  const baseError = toast.error;
  const longer = ((message: Parameters<typeof toast.error>[0], data?: Parameters<typeof toast.error>[1]) =>
    baseError(message, { duration: ERROR_TOAST_DURATION_MS, ...data })) as ErrorFn;
  longer.__sqLonger = true;
  toast.error = longer;
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster"
      position="top-center"
      swipeDirections={[...TOAST_SWIPE_DIRECTIONS]}
      closeButton
      richColors
      visibleToasts={3}
      duration={TOAST_DURATION_MS}
      offset={{ top: "16px" }}
      mobileOffset={{
        top: "calc(var(--safe-top) + 12px)",
        left: "8px",
        right: "8px",
      }}
      toastOptions={{
        classNames: {
          // select-none: met de muis vegen selecteerde tekst, en dan negeert sonner het vegen.
          toast: "bg-background text-foreground border border-border shadow-lg select-none",
          title: "text-foreground font-medium",
          description: "text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground",
          cancelButton: "bg-muted text-muted-foreground",
          // Groter raakvlak op gsm (het kruisje van sonner is 20 px).
          closeButton: "bg-background text-foreground border-border !h-7 !w-7",
          success: "border-success/40 [&_[data-icon]]:text-success",
          error: "border-destructive/40 [&_[data-icon]]:text-destructive",
          warning: "border-warning/40 [&_[data-icon]]:text-warning",
          info: "border-primary/40 [&_[data-icon]]:text-primary",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
