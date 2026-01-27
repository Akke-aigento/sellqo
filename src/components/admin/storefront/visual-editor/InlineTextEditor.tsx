import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { AICopyButton } from './AICopyButton';

type FieldType = 'title' | 'subtitle' | 'cta' | 'button' | 'description';
type SectionType = 'hero' | 'newsletter' | 'text_image' | 'featured_products' | 'testimonials';

interface InlineTextEditorProps {
  value: string;
  onSave: (newValue: string) => void;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  showAIButton?: boolean;
  fieldType?: FieldType;
  sectionType?: SectionType;
}

export function InlineTextEditor({
  value,
  onSave,
  as: Component = 'p',
  placeholder = 'Klik om te bewerken...',
  className,
  multiline = false,
  showAIButton = false,
  fieldType = 'title',
  sectionType = 'hero',
}: InlineTextEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced auto-save - reads from DOM ref, not state
  useEffect(() => {
    if (isEditing) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        const currentValue = editorRef.current?.textContent || '';
        if (currentValue !== value && currentValue !== placeholder) {
          onSave(currentValue);
        }
      }, 2000);
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [isEditing, onSave, value, placeholder]);

  const handleSave = useCallback(() => {
    const newValue = editorRef.current?.textContent || '';
    // Don't save the placeholder as a value
    if (newValue !== value && newValue !== placeholder) {
      onSave(newValue);
    }
    setIsEditing(false);
  }, [value, onSave, placeholder]);

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
      // Reset content to original value
      if (editorRef.current) {
        editorRef.current.textContent = value || placeholder;
      }
      setIsEditing(false);
    }
  };

  const handleAIGenerate = (newValue: string) => {
    // Update the DOM content
    if (editorRef.current) {
      editorRef.current.textContent = newValue;
    }
    // Save immediately
    onSave(newValue);
  };

  // No handleInput - we don't update state during typing!
  // This is the key fix: let the browser handle the contentEditable natively

  const displayValue = value || placeholder;
  const isEmpty = !value;

  return (
    <div 
      className="relative group inline-block w-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        ref={editorRef}
        role="textbox"
        tabIndex={0}
        contentEditable={isEditing}
        suppressContentEditableWarning
        onClick={handleClick}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        // No onInput handler - this prevents the cursor reset issue
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
      
      {/* AI Button - shows on hover or when editing */}
      {showAIButton && (isHovered || isEditing) && (
        <div className="absolute -right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <AICopyButton
            fieldType={fieldType}
            sectionType={sectionType}
            currentValue={value}
            onGenerate={handleAIGenerate}
          />
        </div>
      )}
    </div>
  );
}
