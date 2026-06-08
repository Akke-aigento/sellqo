import * as React from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface ActionItem {
  label?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "destructive";
  /** Render a separator ABOVE this item. */
  separator?: boolean;
  disabled?: boolean;
  /** Render a custom node directly inside the menu (skips the default DropdownMenuItem wrapper). */
  render?: () => React.ReactNode;
}

export interface ActionsMenuProps {
  items: ActionItem[];
  align?: "start" | "end" | "center";
  ariaLabel?: string;
}

export function ActionsMenu({ items, align = "end", ariaLabel = "Acties" }: ActionsMenuProps) {
  if (!items.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={ariaLabel}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        {items.map((item, i) => (
          <React.Fragment key={i}>
            {item.separator && i > 0 && <DropdownMenuSeparator />}
            {item.render ? (
              item.render()
            ) : (
              <DropdownMenuItem
                disabled={item.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  item.onClick?.();
                }}
                className={item.variant === "destructive" ? "text-destructive focus:text-destructive" : ""}
              >
                {item.icon}
                <span className={item.icon ? "ml-2" : ""}>{item.label}</span>
              </DropdownMenuItem>
            )}
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}