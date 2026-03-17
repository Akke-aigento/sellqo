import { Archive, Trash2, FolderOpen, MailOpen, MailX, Inbox, RotateCcw } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { Conversation } from '@/hooks/useInbox';
import type { InboxFolder } from '@/hooks/useInboxFolders';

interface ConversationActionSheetProps {
  conversation: Conversation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onRestore?: (id: string) => void;
  onMarkAsUnread: (id: string) => void;
  onMoveToFolder: (id: string, folderId: string | null) => void;
  folders: InboxFolder[];
  currentFolder?: string | null;
}

export function ConversationActionSheet({
  conversation,
  open,
  onOpenChange,
  onArchive,
  onDelete,
  onRestore,
  onMarkAsUnread,
  onMoveToFolder,
  folders,
  currentFolder,
}: ConversationActionSheetProps) {
  if (!conversation) return null;

  const customerName = conversation.customer?.name || 'Onbekend';
  const subject = conversation.lastMessage?.subject || '(Geen onderwerp)';
  const isUnread = conversation.unreadCount > 0;
  const customFolders = folders.filter(f => !f.is_system);
  const isInTrashOrArchive = currentFolder === 'deleted' || currentFolder === 'archived';

  const handleAction = (action: () => void) => {
    action();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-xl px-0 pb-safe">
        <SheetHeader className="px-4 pb-3">
          <SheetTitle className="text-left text-sm font-semibold truncate">
            {customerName}
          </SheetTitle>
          <p className="text-xs text-muted-foreground truncate text-left">{subject}</p>
        </SheetHeader>

        <Separator />

        <div className="py-1">
          {/* Mark as unread/read */}
          {!isUnread && (
            <button
              onClick={() => handleAction(() => onMarkAsUnread(conversation.id))}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm text-foreground hover:bg-muted active:bg-muted transition-colors"
            >
              <MailX className="h-5 w-5 text-muted-foreground" />
              Markeren als ongelezen
            </button>
          )}

          {/* Move to folder */}
          {customFolders.length > 0 && (
            <>
              <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Verplaatsen naar map
              </div>
              {conversation.folderId && (
                <button
                  onClick={() => handleAction(() => onMoveToFolder(conversation.id, null))}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-foreground hover:bg-muted active:bg-muted transition-colors pl-8"
                >
                  <MailOpen className="h-4 w-4 text-muted-foreground" />
                  Inbox
                </button>
              )}
              {customFolders.map(folder => (
                <button
                  key={folder.id}
                  onClick={() => handleAction(() => onMoveToFolder(conversation.id, folder.id))}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-foreground hover:bg-muted active:bg-muted transition-colors pl-8"
                >
                  <FolderOpen className="h-4 w-4" style={{ color: folder.color }} />
                  {folder.name}
                </button>
              ))}
            </>
          )}

          <Separator className="my-1" />

          {/* Archive */}
          <button
            onClick={() => handleAction(() => onArchive(conversation.id))}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm text-foreground hover:bg-muted active:bg-muted transition-colors"
          >
            <Archive className="h-5 w-5 text-blue-500" />
            Archiveren
          </button>

          {/* Delete */}
          <button
            onClick={() => handleAction(() => onDelete(conversation.id))}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm text-destructive hover:bg-muted active:bg-muted transition-colors"
          >
            <Trash2 className="h-5 w-5" />
            Verwijderen
          </button>
        </div>

        <Separator />

        <div className="px-4 pt-2 pb-2">
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Annuleren
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
