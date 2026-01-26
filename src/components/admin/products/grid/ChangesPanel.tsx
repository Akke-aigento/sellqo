import { Package, X, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { PendingChange } from './gridTypes';

interface ChangesPanelProps {
  changes: PendingChange[];
  onClearChange: (productId: string, field: string) => void;
  onClearAll: () => void;
  onSaveAll: () => void;
  isSaving: boolean;
}

export function ChangesPanel({
  changes,
  onClearChange,
  onClearAll,
  onSaveAll,
  isSaving,
}: ChangesPanelProps) {
  if (changes.length === 0) return null;

  // Group changes by product
  const groupedChanges = changes.reduce((acc, change) => {
    if (!acc[change.productId]) {
      acc[change.productId] = {
        productName: change.productName,
        changes: [],
      };
    }
    acc[change.productId].changes.push(change);
    return acc;
  }, {} as Record<string, { productName: string; changes: PendingChange[] }>);

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? 'Ja' : 'Nee';
    if (Array.isArray(value)) return value.join(', ') || '-';
    if (typeof value === 'number') {
      return new Intl.NumberFormat('nl-NL', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(value);
    }
    return String(value);
  };

  return (
    <div className="border-t bg-muted/30 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-sm">
          Wijzigingen ({changes.length})
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="text-muted-foreground hover:text-foreground"
        >
          <Undo2 className="h-4 w-4 mr-1" />
          Alles wissen
        </Button>
      </div>

      <ScrollArea className="max-h-[200px]">
        <div className="space-y-3">
          {Object.entries(groupedChanges).map(([productId, group]) => (
            <div key={productId} className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Package className="h-4 w-4 text-muted-foreground" />
                {group.productName}
              </div>
              <div className="ml-6 space-y-1">
                {group.changes.map((change) => (
                  <div
                    key={`${change.productId}-${change.field}`}
                    className="flex items-center justify-between text-xs text-muted-foreground group"
                  >
                    <span>
                      <span className="font-medium">{change.fieldLabel}:</span>{' '}
                      <span className="line-through">{formatValue(change.oldValue)}</span>
                      {' → '}
                      <span className="text-foreground font-medium">
                        {formatValue(change.newValue)}
                      </span>
                    </span>
                    <button
                      onClick={() => onClearChange(change.productId, change.field)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="flex justify-end gap-2 mt-4 pt-3 border-t">
        <Button variant="outline" onClick={onClearAll} disabled={isSaving}>
          Annuleren
        </Button>
        <Button onClick={onSaveAll} disabled={isSaving}>
          {isSaving ? 'Opslaan...' : `Alle wijzigingen opslaan (${changes.length})`}
        </Button>
      </div>
    </div>
  );
}
