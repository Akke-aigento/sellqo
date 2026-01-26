import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { X, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface GridTagsCellProps {
  value: string[];
  isEditing: boolean;
  isSelected: boolean;
  hasChange: boolean;
  onStartEdit: () => void;
  onChange: (value: string[]) => void;
  onStopEdit: () => void;
}

export function GridTagsCell({
  value,
  isEditing,
  isSelected,
  hasChange,
  onStartEdit,
  onChange,
  onStopEdit,
}: GridTagsCellProps) {
  const [open, setOpen] = useState(false);
  const [newTag, setNewTag] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      setOpen(true);
    }
  }, [isEditing]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const tags = value || [];

  const handleAddTag = () => {
    const trimmed = newTag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onChange(tags.filter(t => t !== tagToRemove));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      onStopEdit();
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      onStopEdit();
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <div
          className={cn(
            'h-8 px-2 flex items-center gap-1 cursor-pointer rounded-sm overflow-hidden',
            isSelected && 'ring-2 ring-primary ring-offset-1',
            hasChange && 'bg-amber-100 dark:bg-amber-900/30'
          )}
          onClick={() => {
            onStartEdit();
            setOpen(true);
          }}
        >
          {tags.length === 0 ? (
            <span className="text-muted-foreground text-sm">-</span>
          ) : (
            <>
              {tags.slice(0, 2).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs truncate max-w-[60px]">
                  {tag}
                </Badge>
              ))}
              {tags.length > 2 && (
                <Badge variant="outline" className="text-xs">
                  +{tags.length - 2}
                </Badge>
              )}
            </>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 z-50 bg-popover" align="start">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs gap-1">
                {tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {tags.length === 0 && (
              <span className="text-sm text-muted-foreground">Geen tags</span>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              placeholder="Nieuwe tag..."
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-8 text-sm flex-1"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={handleAddTag}
              disabled={!newTag.trim()}
              className="h-8 px-2"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
