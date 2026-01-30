import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { ConversationItem } from './ConversationItem';
import type { Conversation } from '@/hooks/useInbox';

interface SelectableConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  isChecked: boolean;
  showCheckboxes: boolean;
  onClick: () => void;
  onToggleCheck: (e: React.MouseEvent) => void;
}

export function SelectableConversationItem({
  conversation,
  isSelected,
  isChecked,
  showCheckboxes,
  onClick,
  onToggleCheck,
}: SelectableConversationItemProps) {
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
        'relative group flex items-stretch',
        isDragging && 'opacity-50 z-50',
        isChecked && 'bg-primary/10'
      )}
    >
      {/* Checkbox area - visible on hover or when in selection mode */}
      <div
        className={cn(
          'flex items-center justify-center transition-all duration-200 border-b',
          showCheckboxes || isChecked 
            ? 'w-10 opacity-100' 
            : 'w-0 group-hover:w-10 opacity-0 group-hover:opacity-100 overflow-hidden'
        )}
        onClick={onToggleCheck}
      >
        <Checkbox
          checked={isChecked}
          className="data-[state=checked]:bg-primary"
        />
      </div>

      {/* Drag handle */}
      <div
        {...listeners}
        {...attributes}
        className={cn(
          'flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-muted/50',
          showCheckboxes ? 'w-5' : 'w-6'
        )}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Actual conversation item */}
      <div className="flex-1 min-w-0">
        <ConversationItem
          conversation={conversation}
          isSelected={isSelected}
          onClick={onClick}
        />
      </div>
    </div>
  );
}
