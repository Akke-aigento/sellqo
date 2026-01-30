import { MessageSquare } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { DraggableConversationItem } from './DraggableConversationItem';
import type { Conversation } from '@/hooks/useInbox';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isLoading: boolean;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  isLoading,
}: ConversationListProps) {
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
    <ScrollArea className="h-full">
      {conversations.map((conversation) => (
        <DraggableConversationItem
          key={conversation.id}
          conversation={conversation}
          isSelected={selectedId === conversation.id}
          onClick={() => onSelect(conversation.id)}
        />
      ))}
    </ScrollArea>
  );
}
