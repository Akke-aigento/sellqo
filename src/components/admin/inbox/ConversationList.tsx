import { MessageSquare } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { SelectableConversationItem } from './SelectableConversationItem';
import { SwipeableConversationItem } from './SwipeableConversationItem';
import { BulkActionsToolbar } from './BulkActionsToolbar';
import { useIsCompact } from '@/hooks/use-mobile';
import type { Conversation } from '@/hooks/useInbox';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isLoading: boolean;
  // Bulk selection props
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulkArchive: () => void;
  onBulkDelete: () => void;
  onBulkRestore: () => void;
  onBulkMoveToFolder: (folderId: string | null) => void;
  currentFolder: string | null;
  isBulkLoading?: boolean;
  // Single-item actions for swipe
  onArchiveConversation?: (id: string) => void;
  onDeleteConversation?: (id: string) => void;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  isLoading,
  selectedIds,
  onToggleSelection,
  onSelectAll,
  onClearSelection,
  onBulkArchive,
  onBulkDelete,
  onBulkRestore,
  onBulkMoveToFolder,
  currentFolder,
  isBulkLoading,
  onArchiveConversation,
  onDeleteConversation,
}: ConversationListProps) {
  const isCompact = useIsCompact();
  const showCheckboxes = selectedIds.size > 0;

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <MessageSquare className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="font-medium">Geen gesprekken</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Wanneer klanten contact opnemen, verschijnen hun berichten hier.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Bulk actions toolbar */}
      <BulkActionsToolbar
        selectedCount={selectedIds.size}
        currentFolder={currentFolder}
        onArchive={onBulkArchive}
        onDelete={onBulkDelete}
        onRestore={onBulkRestore}
        onMoveToFolder={onBulkMoveToFolder}
        onClearSelection={onClearSelection}
        onSelectAll={onSelectAll}
        totalCount={conversations.length}
        isLoading={isBulkLoading}
      />

      {/* Conversation list */}
      <ScrollArea className="flex-1">
        {conversations.map((conversation) => (
          isCompact ? (
            <SwipeableConversationItem
              key={conversation.id}
              conversation={conversation}
              isSelected={selectedId === conversation.id}
              isChecked={selectedIds.has(conversation.id)}
              onClick={() => onSelect(conversation.id)}
              onToggleCheck={() => onToggleSelection(conversation.id)}
              onSwipeArchive={() => onArchiveConversation?.(conversation.id)}
              onSwipeDelete={() => onDeleteConversation?.(conversation.id)}
            />
          ) : (
            <SelectableConversationItem
              key={conversation.id}
              conversation={conversation}
              isSelected={selectedId === conversation.id}
              isChecked={selectedIds.has(conversation.id)}
              showCheckboxes={showCheckboxes}
              onClick={() => onSelect(conversation.id)}
              onToggleCheck={(e) => {
                e.stopPropagation();
                onToggleSelection(conversation.id);
              }}
            />
          )
        ))}
      </ScrollArea>
    </div>
  );
}
