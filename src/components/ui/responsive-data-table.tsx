import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useViewMode } from "@/hooks/use-breakpoint";
import { cn } from "@/lib/utils";

export type ColumnPriority = "always" | "md" | "lg" | "xl";

export type ColumnDef<T> = {
  id: string;
  header: string;
  priority?: ColumnPriority;
  align?: "left" | "center" | "right";
  width?: string;
  render: (row: T) => React.ReactNode;
};

export interface ResponsiveDataTableProps<T> {
  columns: ColumnDef<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  mobileCardRender: (row: T) => React.ReactNode;
  emptyState?: React.ReactNode;
  isLoading?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  /**
   * At which breakpoint the table collapses into mobile card view.
   * - 'mobile' (default): cards below md (<768px)
   * - 'compact': cards below lg (<1024px) — use for tables with many columns or row actions
   */
  cardModeBreakpoint?: "mobile" | "compact";
}

const PRIORITY_HIDE_CLASS: Record<ColumnPriority, string> = {
  always: "",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};

const ALIGN_CLASS = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
} as const;

export function ResponsiveDataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  mobileCardRender,
  emptyState,
  isLoading,
  selectedIds,
  onSelectionChange,
  cardModeBreakpoint = "mobile",
}: ResponsiveDataTableProps<T>) {
  const viewMode = useViewMode();
  const useCards =
    cardModeBreakpoint === "compact"
      ? viewMode === "mobile" || viewMode === "compact"
      : viewMode === "mobile";
  const selectable = !!onSelectionChange;
  const selectedSet = React.useMemo(() => new Set(selectedIds ?? []), [selectedIds]);

  const toggleAll = (checked: boolean) => {
    if (!onSelectionChange) return;
    onSelectionChange(checked ? rows.map(getRowKey) : []);
  };

  const toggleOne = (id: string, checked: boolean) => {
    if (!onSelectionChange) return;
    const next = new Set(selectedSet);
    if (checked) next.add(id);
    else next.delete(id);
    onSelectionChange(Array.from(next));
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
        {emptyState ?? "Geen resultaten."}
      </div>
    );
  }

  if (useCards) {
    return (
      <div className="space-y-3">
        {rows.map((row) => {
          const id = getRowKey(row);
          return (
            <div
              key={id}
              className={cn(
                "rounded-lg border bg-card p-3",
                onRowClick && "cursor-pointer active:bg-muted/50",
              )}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {selectable && (
                <div className="mb-2 flex items-center" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedSet.has(id)}
                    onCheckedChange={(c) => toggleOne(id, !!c)}
                  />
                </div>
              )}
              {mobileCardRender(row)}
            </div>
          );
        })}
      </div>
    );
  }

  const allChecked = selectable && rows.length > 0 && rows.every((r) => selectedSet.has(getRowKey(r)));

  return (
    <div className="w-full overflow-x-auto rounded-md border">
      <Table className="min-w-[640px]">
        <TableHeader>
          <TableRow>
            {selectable && (
              <TableHead className="w-10">
                <Checkbox checked={allChecked} onCheckedChange={(c) => toggleAll(!!c)} />
              </TableHead>
            )}
            {columns.map((col) => (
              <TableHead
                key={col.id}
                style={col.width ? { width: col.width } : undefined}
                className={cn(
                  PRIORITY_HIDE_CLASS[col.priority ?? "always"],
                  col.align && ALIGN_CLASS[col.align],
                )}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const id = getRowKey(row);
            return (
              <TableRow
                key={id}
                data-state={selectedSet.has(id) ? "selected" : undefined}
                className={onRowClick ? "cursor-pointer" : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {selectable && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedSet.has(id)}
                      onCheckedChange={(c) => toggleOne(id, !!c)}
                    />
                  </TableCell>
                )}
                {columns.map((col) => (
                  <TableCell
                    key={col.id}
                    className={cn(
                      PRIORITY_HIDE_CLASS[col.priority ?? "always"],
                      col.align && ALIGN_CLASS[col.align],
                    )}
                  >
                    {col.render(row)}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}