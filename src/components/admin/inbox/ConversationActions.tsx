import { Archive, Trash2, FolderInput, RotateCcw, MoreHorizontal, Pin, PinOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useInboxFolders } from '@/hooks/useInboxFolders';
import { SnoozePicker } from './SnoozePicker';

interface ConversationActionsProps {
  conversationStatus: 'active' | 'archived' | 'deleted';
  isPinned?: boolean;
  onArchive: () => void;
  onDelete: () => void;
  onRestore: () => void;
  onMoveToFolder: (folderId: string | null) => void;
  onPin?: (pinned: boolean) => void;
  onSnooze?: (until: Date) => void;
  disabled?: boolean;
}

export function ConversationActions({
  conversationStatus,
  isPinned,
  onArchive,
  onDelete,
  onRestore,
  onMoveToFolder,
  onPin,
  onSnooze,
  disabled,
}: ConversationActionsProps) {
  const { customFolders } = useInboxFolders();

  const isArchived = conversationStatus === 'archived';
  const isDeleted = conversationStatus === 'deleted';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {/* Restore option for archived/deleted */}
        {(isArchived || isDeleted) && (
          <>
            <DropdownMenuItem onClick={onRestore}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Terugzetten naar inbox
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Pin/Unpin */}
        {onPin && !isDeleted && (
          <DropdownMenuItem onClick={() => onPin(!isPinned)}>
            {isPinned ? (
              <>
                <PinOff className="h-4 w-4 mr-2" />
                Losmaken
              </>
            ) : (
              <>
                <Pin className="h-4 w-4 mr-2" />
                Vastzetten
              </>
            )}
          </DropdownMenuItem>
        )}

        {/* Snooze */}
        {onSnooze && !isDeleted && (
          <SnoozePicker onSnooze={onSnooze} />
        )}

        {(onPin || onSnooze) && !isDeleted && <DropdownMenuSeparator />}

        {/* Move to folder submenu */}
        {customFolders.length > 0 && !isDeleted && (
          <>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <FolderInput className="h-4 w-4 mr-2" />
                Verplaatsen naar map
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => onMoveToFolder(null)}>
                  Inbox
                </DropdownMenuItem>
                {customFolders.map((folder) => (
                  <DropdownMenuItem key={folder.id} onClick={() => onMoveToFolder(folder.id)}>
                    {folder.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Archive option (only for active conversations) */}
        {!isArchived && !isDeleted && (
          <DropdownMenuItem onClick={onArchive}>
            <Archive className="h-4 w-4 mr-2" />
            Archiveren
          </DropdownMenuItem>
        )}

        {/* Delete option (only for non-deleted) */}
        {!isDeleted && (
          <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Naar prullenbak
          </DropdownMenuItem>
        )}

        {/* Permanent delete for trash items */}
        {isDeleted && (
          <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Permanent verwijderen
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
