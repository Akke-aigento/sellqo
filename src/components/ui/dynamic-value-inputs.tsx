import * as React from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface DynamicValueInputsHandle {
  commitPending: () => string[];
}

interface DynamicValueInputsProps {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
}

export const DynamicValueInputs = React.forwardRef<DynamicValueInputsHandle, DynamicValueInputsProps>(
  ({ values, onChange, placeholder = "Typ waarde...", className }, ref) => {
    // Always ensure there's at least one empty slot at the end
    const displayValues = React.useMemo(() => {
      if (values.length === 0 || values[values.length - 1] !== "") {
        return [...values, ""];
      }
      return values;
    }, [values]);

    React.useImperativeHandle(ref, () => ({
      commitPending: () => {
        const filtered = values.filter(v => v.trim() !== "");
        onChange(filtered);
        return filtered;
      },
    }), [values, onChange]);

    const handleChange = (index: number, value: string) => {
      const updated = [...displayValues];
      updated[index] = value;

      // If typing in the last (empty) slot, add a new empty slot
      if (index === displayValues.length - 1 && value !== "") {
        updated.push("");
      }

      onChange(updated);
    };

    const handleRemove = (index: number) => {
      const updated = displayValues.filter((_, i) => i !== index);
      onChange(updated.length === 0 ? [""] : updated);
    };

    const handleBlur = (index: number) => {
      // Remove empty fields on blur, except the last one
      if (displayValues[index].trim() === "" && index !== displayValues.length - 1) {
        handleRemove(index);
      }
    };

    return (
      <div className={cn("space-y-1.5", className)}>
        {displayValues.map((value, index) => {
          const isLast = index === displayValues.length - 1;
          const isEmpty = value.trim() === "";

          return (
            <div key={index} className="flex items-center gap-1.5">
              <Input
                value={value}
                onChange={e => handleChange(index, e.target.value)}
                onBlur={() => handleBlur(index)}
                placeholder={isLast ? placeholder : ""}
                className="h-9 text-sm"
              />
              {!isLast && (
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="shrink-0 rounded-full p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              {isLast && <div className="w-[24px] shrink-0" />}
            </div>
          );
        })}
      </div>
    );
  }
);

DynamicValueInputs.displayName = "DynamicValueInputs";
