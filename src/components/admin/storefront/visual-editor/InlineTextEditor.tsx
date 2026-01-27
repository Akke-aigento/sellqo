import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';

interface InlineTextEditorProps {
  value: string;
  onSave: (newValue: string) => void;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
  placeholder?: string;
  className?: string;
  multiline?: boolean;
}

export function InlineTextEditor({
  value,
  onSave,
  as: Component = 'p',
  placeholder = 'Klik om te bewerken...',
  className,
  multiline = false,
}: InlineTextEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update editValue when value prop changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  const handleSave = useCallback(() => {
    if (editValue !== value) {
      onSave(editValue);
    }
    setIsEditing(false);
  }, [editValue, value, onSave]);

  // Debounced auto-save
  useEffect(() => {
    if (isEditing && editValue !== value) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        onSave(editValue);
      }, 2000);
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [editValue, isEditing, onSave, value]);

  const handleClick = () => {
    setIsEditing(true);
    setTimeout(() => {
      editorRef.current?.focus();
      // Select all text
      const selection = window.getSelection();
      const range = document.createRange();
      if (editorRef.current && selection) {
        range.selectNodeContents(editorRef.current);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }, 0);
  };

  const handleBlur = () => {
    handleSave();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      setEditValue(value);
      setIsEditing(false);
    }
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    setEditValue(e.currentTarget.textContent || '');
  };

  const displayValue = editValue || placeholder;
  const isEmpty = !editValue;

  return (
    <div
      ref={editorRef}
      role="textbox"
      tabIndex={0}
      contentEditable={isEditing}
      suppressContentEditableWarning
      onClick={handleClick}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onInput={handleInput}
      className={cn(
        'outline-none transition-all cursor-text',
        isEditing && 'ring-2 ring-primary ring-offset-2 rounded px-1',
        !isEditing && 'hover:ring-2 hover:ring-primary/30 hover:ring-offset-2 rounded',
        isEmpty && !isEditing && 'text-muted-foreground italic',
        className
      )}
      style={{
        minHeight: Component === 'h1' ? '3rem' : Component === 'h2' ? '2.5rem' : '1.5rem',
      }}
    >
      {displayValue}
    </div>
  );
}
