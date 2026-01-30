import { Archive, Trash2, FolderInput, RotateCcw, X, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useInboxFolders } from '@/hooks/useInboxFolders';

interface BulkActionsToolbarProps {
  selectedCount: number;
  currentFolder: string | null; // null = inbox, 'archived', 'deleted', or folder ID
  onArchive: () => void;
  onDelete: () => void;
  onRestore: () => void;
  onMoveToFolder: (folderId: string | null) => void;
  onClearSelection: () => void;
  onSelectAll: () => void;
  totalCount: number;
  isLoading?: boolean;
}

export function BulkActionsToolbar({
  selectedCount,
  currentFolder,
  onArchive,
  onDelete,
  onRestore,
  onMoveToFolder,
  onClearSelection,
  onSelectAll,
  totalCount,
  isLoading,
}: BulkActionsToolbarProps) {
  const { customFolders } = useInboxFolders();

  const isArchiveView = currentFolder === 'archived';
  const isTrashView = currentFolder === 'deleted';
  const allSelected = selectedCount === totalCount && totalCount > 0;

  if (selectedCount === 0) return null;

  return (
    <div className="p-2 bg-primary/5 border-b space-y-2">
      {/* Row 1: Selection info */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={onClearSelection}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
        <span className="text-sm font-medium whitespace-nowrap">
          {selectedCount} geselecteerd
        </span>
        <div className="flex-1" />
        {!allSelected && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-primary"
            onClick={onSelectAll}
          >
            <CheckSquare className="h-3.5 w-3.5 mr-1" />
            Alles ({totalCount})
          </Button>
        )}
      </div>

      {/* Row 2: Bulk actions */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Restore button for archived/deleted items */}
        {(isArchiveView || isTrashView) && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={onRestore}
            disabled={isLoading}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Herstellen
          </Button>
        )}

        {/* Move to folder */}
        {!isTrashView && customFolders.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={isLoading}
              >
                <FolderInput className="h-3.5 w-3.5 mr-1" />
                Verplaatsen
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onMoveToFolder(null)}>
                Inbox
              </DropdownMenuItem>
              {customFolders.map((folder) => (
                <DropdownMenuItem
                  key={folder.id}
                  onClick={() => onMoveToFolder(folder.id)}
                >
                  {folder.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Archive button (only for active items) */}
        {!isArchiveView && !isTrashView && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={onArchive}
            disabled={isLoading}
          >
            <Archive className="h-3.5 w-3.5 mr-1" />
            Archiveren
          </Button>
        )}

        {/* Delete button */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs text-destructive hover:text-destructive"
          onClick={onDelete}
          disabled={isLoading}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          {isTrashView ? 'Permanent' : 'Verwijderen'}
        </Button>
      </div>
    </div>
  );
}
