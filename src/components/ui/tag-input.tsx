import * as React from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface TagInputHandle {
  commitPending: () => void;
}

interface TagInputProps {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
}

export const TagInput = React.forwardRef<TagInputHandle, TagInputProps>(
  ({ values, onChange, placeholder = "Typ waarde + Enter", className }, ref) => {
    const [inputValue, setInputValue] = React.useState("");
    const inputRef = React.useRef<HTMLInputElement>(null);

    const addTags = React.useCallback((raw: string) => {
      const newTags = raw.split(",").map(v => v.trim()).filter(Boolean);
      if (newTags.length === 0) return;
      const unique = newTags.filter(t => !values.includes(t));
      if (unique.length > 0) {
        onChange([...values, ...unique]);
      }
      setInputValue("");
    }, [values, onChange]);

    React.useImperativeHandle(ref, () => ({
      commitPending: () => {
        if (inputValue.trim()) {
          addTags(inputValue);
        }
      },
    }), [inputValue, addTags]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        addTags(inputValue);
      } else if (e.key === "Backspace" && inputValue === "" && values.length > 0) {
        onChange(values.slice(0, -1));
      }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      addTags(e.clipboardData.getData("text"));
    };

    const removeTag = (index: number) => {
      onChange(values.filter((_, i) => i !== index));
    };

    return (
      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 cursor-text min-h-[40px]",
          className
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {values.map((value, index) => (
          <Badge key={`${value}-${index}`} variant="secondary" className="gap-1 pr-1">
            {value}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeTag(index); }}
              className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={() => { if (inputValue.trim()) addTags(inputValue); }}
          placeholder={values.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[80px] bg-transparent outline-none placeholder:text-muted-foreground"
        />
      </div>
    );
  }
);

TagInput.displayName = "TagInput";
