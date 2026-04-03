import { CheckSquare, Square, Trash2, ToggleLeft, ToggleRight, X, Eye, EyeOff, Store, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface CategoryBulkActionsProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
  onShowOnStorefront: () => void;
  onHideFromStorefront: () => void;
  onDelete: () => void;
  isDeleting?: boolean;
  isUpdating?: boolean;
}

export function CategoryBulkActions({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onActivate,
  onDeactivate,
  onShowOnStorefront,
  onHideFromStorefront,
  onDelete,
  isDeleting,
  isUpdating,
}: CategoryBulkActionsProps) {
  const allSelected = selectedCount === totalCount && totalCount > 0;
  const someSelected = selectedCount > 0;

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={allSelected ? onDeselectAll : onSelectAll}
          className="gap-2"
        >
          {allSelected ? (
            <>
              <Square className="h-4 w-4" />
              Deselecteer alles
            </>
          ) : (
            <>
              <CheckSquare className="h-4 w-4" />
              Selecteer alles
            </>
          )}
        </Button>
      </div>

      {someSelected && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background shadow-lg animate-in slide-in-from-bottom-2 lg:left-[var(--sidebar-width,280px)]">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 p-3 max-w-screen-xl mx-auto">
            <Badge variant="secondary" className="gap-1">
              {selectedCount} geselecteerd
            </Badge>

            <div className="h-4 w-px bg-border" />

            <Button
              variant="outline"
              size="sm"
              onClick={onActivate}
              disabled={isUpdating}
              className="gap-2"
            >
              <ToggleRight className="h-4 w-4" />
              Activeren
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onDeactivate}
              disabled={isUpdating}
              className="gap-2"
            >
              <ToggleLeft className="h-4 w-4" />
              Deactiveren
            </Button>

            <div className="h-4 w-px bg-border" />

            <Button
              variant="outline"
              size="sm"
              onClick={onShowOnStorefront}
              disabled={isUpdating}
              className="gap-2"
            >
              <Globe className="h-4 w-4" />
              Online tonen
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onHideFromStorefront}
              disabled={isUpdating}
              className="gap-2"
            >
              <Store className="h-4 w-4" />
              Alleen winkel
            </Button>

            <div className="h-4 w-px bg-border" />

            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              disabled={isDeleting}
              className="gap-2 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Verwijderen
            </Button>

            <Button variant="ghost" size="sm" onClick={onDeselectAll} className="ml-auto gap-2">
              <X className="h-4 w-4" />
              Deselecteer
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
