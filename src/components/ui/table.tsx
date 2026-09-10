import * as React from "react";

import { cn } from "@/lib/utils";
import { ScrollHintArrows } from "@/components/ui/scroll-hint";
import { useScrollHint } from "@/hooks/use-scroll-hint";

// De wrapper staat op overflow-x-auto en niet op overflow-hidden: een tabel die
// breder is dan het scherm moet horizontaal te vegen zijn. Met overflow-hidden
// clipt deze wrapper de tabel voordat een buitenliggende overflow-x-auto er iets
// mee kan, en zijn de rechterkolommen op mobiel onbereikbaar — een script kan
// dan nog wel scrollLeft zetten, een gebruiker niet.
interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  /**
   * Toon een vervaging met een pijltje aan de kant waar de tabel nog doorloopt.
   *
   * Opt-in, want het is niet overal gewenst en elke tabel zonder deze prop
   * rendert precies zoals hiervoor. Waarom een prop en niet een <ScrollHint>
   * eromheen: de wrapper hieronder scrolt zelf, dus een ScrollHint erbuiten
   * blijft even breed als zijn inhoud en toont nooit iets. Gemeten: buitenste
   * scroller 293/293 terwijl deze 293 -> 640 liep, nul pijltjes.
   */
  scrollHint?: boolean;
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, scrollHint, ...props }, ref) => {
    const wrapperRef = React.useRef<HTMLDivElement | null>(null);
    const { canScrollLeft, canScrollRight, maskImage } = useScrollHint(wrapperRef, !!scrollHint);

    const tabel = (
      <div
        ref={wrapperRef}
        className="relative w-full overflow-x-auto"
        style={scrollHint ? { maskImage, WebkitMaskImage: maskImage } : undefined}
      >
        <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
      </div>
    );

    if (!scrollHint) return tabel;

    // De pijltjes horen buiten de scroller: binnenin zou de mask ze mee laten
    // vervagen, en zouden ze bovendien meescrollen.
    return (
      <div className="relative">
        {tabel}
        <ScrollHintArrows canScrollLeft={canScrollLeft} canScrollRight={canScrollRight} />
      </div>
    );
  },
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />,
);
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
  ),
);
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot ref={ref} className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)} {...props} />
  ),
);
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn("border-b transition-colors data-[state=selected]:bg-muted hover:bg-muted/50", className)}
      {...props}
    />
  ),
);
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  ),
);
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td ref={ref} className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)} {...props} />
  ),
);
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
  ),
);
TableCaption.displayName = "TableCaption";

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
