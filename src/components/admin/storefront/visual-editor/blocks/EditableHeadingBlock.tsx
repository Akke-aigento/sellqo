import { useState } from 'react';
import type { HeadingBlockContent } from '@/types/storefront';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface EditableHeadingBlockProps {
  content: HeadingBlockContent;
  onUpdate: (content: Partial<HeadingBlockContent>) => void;
}

export function EditableHeadingBlock({ content, onUpdate }: EditableHeadingBlockProps) {
  const [isEditing, setIsEditing] = useState(false);

  const headingSizes = {
    h1: 'text-4xl font-bold',
    h2: 'text-3xl font-bold',
    h3: 'text-2xl font-semibold',
  };

  const handleTextChange = (e: React.FocusEvent<HTMLDivElement>) => {
    const newText = e.currentTarget.textContent || '';
    if (newText !== content.text) {
      onUpdate({ text: newText });
    }
  };

  return (
    <div className="group relative">
      <div className="flex items-start gap-2">
        <div
          contentEditable
          suppressContentEditableWarning
          onBlur={handleTextChange}
          onFocus={() => setIsEditing(true)}
          className={cn(
            headingSizes[content.level || 'h2'],
            'flex-1 outline-none cursor-text',
            'hover:ring-2 hover:ring-primary/30 hover:ring-offset-2 rounded',
            isEditing && 'ring-2 ring-primary ring-offset-2 rounded px-1'
          )}
        >
          {content.text || 'Koptekst...'}
        </div>
        
        <Select
          value={content.level || 'h2'}
          onValueChange={(value) => onUpdate({ level: value as 'h1' | 'h2' | 'h3' })}
        >
          <SelectTrigger className="w-20 h-8 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="h1">H1</SelectItem>
            <SelectItem value="h2">H2</SelectItem>
            <SelectItem value="h3">H3</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
