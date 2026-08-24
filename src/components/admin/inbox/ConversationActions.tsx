import { Archive, Trash2, FolderInput, RotateCcw, MoreHorizontal } from 'lucide-react';
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
import { useTranslation } from 'react-i18next';

interface ConversationActionsProps {
  conversationStatus: 'active' | 'archived' | 'deleted';
  onArchive: () => void;
  onDelete: () => void;
  onRestore: () => void;
  onMoveToFolder: (folderId: string | null) => void;
  disabled?: boolean;
}

export function ConversationActions({
  conversationStatus,
  onArchive,
  onDelete,
  onRestore,
  onMoveToFolder,
  disabled,
}: ConversationActionsProps) {
  const { t } = useTranslation();
  const { customFolders, archiveFolder, trashFolder } = useInboxFolders();

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
              {t('admin.inbox.conversationActions.terugzetten_naar_inbox')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Move to folder submenu */}
        {customFolders.length > 0 && !isDeleted && (
          <>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <FolderInput className="h-4 w-4 mr-2" />
                {t('admin.inbox.conversationActions.verplaatsen_naar_map')}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => onMoveToFolder(null)}>
                  {t('admin.inbox.bulkActionsToolbar.inbox')}
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
            {t('admin.inbox.bulkActionsToolbar.archiveren')}
          </DropdownMenuItem>
        )}

        {/* Delete option (only for non-deleted) */}
        {!isDeleted && (
          <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            {t('admin.inbox.conversationActions.naar_prullenbak')}
          </DropdownMenuItem>
        )}

        {/* Permanent delete for trash items */}
        {isDeleted && (
          <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            {t('admin.inbox.conversationActions.permanent_verwijderen')}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
