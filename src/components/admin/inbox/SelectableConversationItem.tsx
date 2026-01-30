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
      {/* Combined checkbox + drag handle column */}
      <div className="w-7 flex flex-col items-center justify-center gap-1 shrink-0 border-b">
        {/* Checkbox */}
        <div onClick={onToggleCheck}>
          <Checkbox
            checked={isChecked}
            className={cn(
              'transition-opacity duration-150 data-[state=checked]:bg-primary',
              showCheckboxes || isChecked 
                ? 'opacity-100' 
                : 'opacity-0 group-hover:opacity-100'
            )}
          />
        </div>

        {/* Drag handle */}
        <div
          {...listeners}
          {...attributes}
          className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
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
