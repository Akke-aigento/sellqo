import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConversationItem } from './ConversationItem';
import type { Conversation } from '@/hooks/useInbox';

interface DraggableConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
}

export function DraggableConversationItem({ 
  conversation, 
  isSelected, 
  onClick 
}: DraggableConversationItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: conversation.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative group',
        isDragging && 'opacity-50 z-50'
      )}
    >
      {/* Drag handle */}
      <div
        {...listeners}
        {...attributes}
        className="absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-muted/50"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      
      {/* Actual conversation item with padding for drag handle */}
      <div className="pl-1">
        <ConversationItem
          conversation={conversation}
          isSelected={isSelected}
          onClick={onClick}
        />
      </div>
    </div>
  );
}
