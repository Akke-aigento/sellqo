import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { EmailBlock, EmailBlockType } from '@/types/emailBuilder';
import { BLOCK_TEMPLATES } from '@/types/emailBuilder';

interface EmailBlockItemProps {
  block: EmailBlock;
  onEdit: (block: EmailBlock) => void;
  onDelete: (id: string) => void;
}

export function EmailBlockItem({ block, onEdit, onDelete }: EmailBlockItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const template = BLOCK_TEMPLATES[block.type];

  const renderPreview = () => {
    switch (block.type) {
      case 'header':
        return (
          <div className="text-center">
            {block.content.logoUrl && (
              <img src={block.content.logoUrl} alt="Logo" className="h-8 mx-auto mb-2" />
            )}
            <h3 className="text-lg font-bold">{block.content.headerText || 'Header'}</h3>
          </div>
        );
      case 'text':
        return (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {block.content.text || 'Tekst blok...'}
          </p>
        );
      case 'image':
        return block.content.imageUrl ? (
          <img src={block.content.imageUrl} alt={block.content.altText} className="h-16 object-cover mx-auto" />
        ) : (
          <div className="h-16 bg-muted rounded flex items-center justify-center text-muted-foreground">
            🖼️ Afbeelding
          </div>
        );
      case 'button':
        return (
          <div 
            className="text-center py-2 px-4 rounded text-white text-sm font-medium"
            style={{ backgroundColor: block.style.backgroundColor || '#7c3aed' }}
          >
            {block.content.buttonText || 'Klik hier'}
          </div>
        );
      case 'divider':
        return <hr className="border-t" style={{ borderStyle: block.content.dividerStyle || 'solid' }} />;
      case 'spacer':
        return (
          <div className="flex items-center justify-center text-muted-foreground text-xs">
            ↕️ {block.content.height || 32}px ruimte
          </div>
        );
      case 'product':
        return (
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">📦</div>
            <div>
              <p className="font-medium text-sm">{block.content.productName || 'Product'}</p>
              <p className="text-sm text-primary font-bold">{block.content.productPrice || '€0,00'}</p>
            </div>
          </div>
        );
      case 'social':
        return (
          <div className="flex items-center justify-center gap-3 text-muted-foreground">
            {block.content.facebook && <span>📘</span>}
            {block.content.instagram && <span>📸</span>}
            {block.content.twitter && <span>🐦</span>}
            {block.content.linkedin && <span>💼</span>}
            {!block.content.facebook && !block.content.instagram && !block.content.twitter && !block.content.linkedin && (
              <span className="text-xs">Social media links</span>
            )}
          </div>
        );
      case 'footer':
        return (
          <div className="text-center text-xs text-muted-foreground">
            <p>{block.content.companyName}</p>
            <p className="text-primary underline">{block.content.unsubscribeText || 'Uitschrijven'}</p>
          </div>
        );
      default:
        return <span className="text-muted-foreground">{template.name}</span>;
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-stretch border rounded-lg bg-background hover:border-primary/50 transition-colors"
    >
      <div
        {...attributes}
        {...listeners}
        className="flex items-center px-2 border-r bg-muted/30 cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      
      <div className="flex-1 p-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">{template.icon}</span>
          <span className="text-sm font-medium">{template.name}</span>
        </div>
        <div className="min-h-[40px]">
          {renderPreview()}
        </div>
      </div>
      
      <div className="flex flex-col border-l opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 rounded-none"
          onClick={() => onEdit(block)}
        >
          <Settings className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 rounded-none text-destructive hover:text-destructive"
          onClick={() => onDelete(block.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
