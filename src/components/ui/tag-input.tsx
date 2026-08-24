import * as React from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface TagInputHandle {
  /** Commits any uncommitted text and returns the full updated values array */
  commitPending: () => string[];
}

interface TagInputProps {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Scheidingstekens waarop losse waarden gesplitst worden.
 *
 * Naast de komma ook regeleindes, puntkomma's en de opsommings-bullet: wie een
 * lijstje uit een document of e-mail plakt, plakt precies die tekens mee. Voor
 * de fix hierop splitste alleen de komma, waardoor een geplakt blok van vijf
 * regels één onbruikbare tag werd.
 */
const SEPARATORS = /[\n\r,;·|]+/;

/**
 * Splitst ruwe invoer in nette losse waarden. Trimt, gooit lege weg, en haalt
 * losse leestekens eruit zodat een opsomming met streepjes of bullets geen
 * spooktags oplevert.
 */
function splitRawTags(raw: string): string[] {
  return raw
    .split(SEPARATORS)
    .map((value) => value.trim().replace(/^[-•*–—\s]+/, "").trim())
    .filter((value) => value.length > 0);
}

export const TagInput = React.forwardRef<TagInputHandle, TagInputProps>(
  ({ values, onChange, placeholder, className }, ref) => {
    const { t } = useTranslation();
    const [inputValue, setInputValue] = React.useState("");
    const inputRef = React.useRef<HTMLInputElement>(null);

    const resolvedPlaceholder = placeholder ?? t("common.tag_input.placeholder");

    /** Voegt toe en geeft de bijgewerkte lijst terug, of null als er niets bijkwam. */
    const appendTags = React.useCallback(
      (raw: string): string[] | null => {
        const parsed = splitRawTags(raw);
        if (parsed.length === 0) return null;

        // Dedupliceren tegen wat er al staat én binnen de geplakte reeks zelf.
        const unique: string[] = [];
        for (const tag of parsed) {
          if (!values.includes(tag) && !unique.includes(tag)) unique.push(tag);
        }
        if (unique.length === 0) return null;

        const updated = [...values, ...unique];
        onChange(updated);
        return updated;
      },
      [values, onChange],
    );

    const addTags = React.useCallback(
      (raw: string) => {
        appendTags(raw);
        setInputValue("");
      },
      [appendTags],
    );

    React.useImperativeHandle(
      ref,
      () => ({
        commitPending: () => {
          if (!inputValue.trim()) return values;
          const updated = appendTags(inputValue);
          setInputValue("");
          return updated ?? values;
        },
      }),
      [inputValue, values, appendTags],
    );

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" || e.key === "," || e.key === ";") {
        e.preventDefault();
        addTags(inputValue);
      } else if (e.key === "Backspace" && inputValue === "" && values.length > 0) {
        onChange(values.slice(0, -1));
      }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      const pasted = e.clipboardData.getData("text");
      // Bevat het geplakte blok geen scheidingsteken, dan is het één waarde en
      // laten we het normale plakgedrag staan — anders kun je een tag niet meer
      // in stukjes samenstellen.
      if (!SEPARATORS.test(pasted)) return;
      e.preventDefault();
      addTags(inputValue ? `${inputValue}\n${pasted}` : pasted);
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
              aria-label={t("common.tag_input.remove", { value })}
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
          placeholder={values.length === 0 ? resolvedPlaceholder : ""}
          className="flex-1 min-w-[80px] bg-transparent outline-none placeholder:text-muted-foreground"
        />
      </div>
    );
  }
);

TagInput.displayName = "TagInput";
