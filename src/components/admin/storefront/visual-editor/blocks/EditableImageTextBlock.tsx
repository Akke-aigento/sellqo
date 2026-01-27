import type { ImageTextBlockContent } from '@/types/storefront';
import { InlineTextEditor } from '../InlineTextEditor';
import { VisualMediaPicker } from '../VisualMediaPicker';
import { Button } from '@/components/ui/button';
import { ArrowLeftRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EditableImageTextBlockProps {
  content: ImageTextBlockContent;
  onUpdate: (content: Partial<ImageTextBlockContent>) => void;
}

export function EditableImageTextBlock({ content, onUpdate }: EditableImageTextBlockProps) {
  const imagePosition = content.image_position || 'right';

  const togglePosition = () => {
    onUpdate({ image_position: imagePosition === 'right' ? 'left' : 'right' });
  };

  return (
    <div className="relative group">
      {/* Position toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
        onClick={togglePosition}
        title="Wissel positie"
      >
        <ArrowLeftRight className="h-4 w-4" />
      </Button>

      <div className={cn(
        'grid md:grid-cols-2 gap-6 items-center',
        imagePosition === 'left' && 'md:flex-row-reverse'
      )}>
        {/* Text Content */}
        <div className={imagePosition === 'left' ? 'md:order-2' : ''}>
          <InlineTextEditor
            value={content.title || ''}
            onSave={(title) => onUpdate({ title })}
            as="h3"
            placeholder="Titel toevoegen..."
            className="text-2xl font-bold mb-3"
            showAIButton
            fieldType="title"
            sectionType="text_image"
          />
          <InlineTextEditor
            value={content.text || ''}
            onSave={(text) => onUpdate({ text })}
            as="p"
            placeholder="Voeg hier je tekst toe..."
            className="text-muted-foreground"
            multiline
          />
          {(content.button_text || content.button_link) && (
            <div className="mt-4">
              <InlineTextEditor
                value={content.button_text || ''}
                onSave={(button_text) => onUpdate({ button_text })}
                as="span"
                placeholder="Knop tekst..."
                className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-lg"
              />
            </div>
          )}
        </div>

        {/* Image */}
        <div className={imagePosition === 'left' ? 'md:order-1' : ''}>
          <VisualMediaPicker
            value={content.image_url}
            onSelect={(image_url) => onUpdate({ image_url })}
            aspectRatio="video"
            placeholder="Klik om afbeelding te kiezen"
          />
        </div>
      </div>
    </div>
  );
}
