import type { SpacerBlockContent } from '@/types/storefront';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface EditableSpacerBlockProps {
  content: SpacerBlockContent;
  onUpdate: (content: Partial<SpacerBlockContent>) => void;
}

const spacerHeights = {
  small: 'h-4',
  medium: 'h-8',
  large: 'h-16',
};

export function EditableSpacerBlock({ content, onUpdate }: EditableSpacerBlockProps) {
  const height = content.height || 'medium';

  return (
    <div className="relative group">
      <div className={cn(
        'w-full border-2 border-dashed border-muted rounded flex items-center justify-center',
        spacerHeights[height]
      )}>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <Select
            value={height}
            onValueChange={(value) => onUpdate({ height: value as 'small' | 'medium' | 'large' })}
          >
            <SelectTrigger className="w-28 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="small">Klein</SelectItem>
              <SelectItem value="medium">Middel</SelectItem>
              <SelectItem value="large">Groot</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
