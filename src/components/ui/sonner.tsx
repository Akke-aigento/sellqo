import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster"
      position="top-center"
      swipeDirections={["top"]}
      closeButton
      richColors
      visibleToasts={3}
      offset={{ top: "16px" }}
      mobileOffset={{
        top: "calc(var(--safe-top) + 12px)",
        left: "8px",
        right: "8px",
      }}
      toastOptions={{
        classNames: {
          toast: "bg-background text-foreground border border-border shadow-lg",
          title: "text-foreground font-medium",
          description: "text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground",
          cancelButton: "bg-muted text-muted-foreground",
          closeButton: "bg-background text-foreground border-border",
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
