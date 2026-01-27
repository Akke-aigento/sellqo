import type { PageBlock, RichTextBlockContent, HeadingBlockContent, ImageTextBlockContent, FaqBlockContent, SpacerBlockContent } from '@/types/storefront';
import { EditableRichTextBlock } from './EditableRichTextBlock';
import { EditableHeadingBlock } from './EditableHeadingBlock';
import { EditableImageTextBlock } from './EditableImageTextBlock';
import { EditableFaqBlock } from './EditableFaqBlock';
import { EditableSpacerBlock } from './EditableSpacerBlock';

interface PageBlockRendererProps {
  block: PageBlock;
  onUpdate: (updates: Partial<PageBlock>) => void;
}

export function PageBlockRenderer({ block, onUpdate }: PageBlockRendererProps) {
  const updateContent = (content: Partial<PageBlock['content']>) => {
    onUpdate({ content: { ...block.content, ...content } });
  };

  switch (block.type) {
    case 'richtext':
      return (
        <EditableRichTextBlock
          content={block.content as RichTextBlockContent}
          onUpdate={updateContent}
        />
      );
    case 'heading':
      return (
        <EditableHeadingBlock
          content={block.content as HeadingBlockContent}
          onUpdate={updateContent}
        />
      );
    case 'image_text':
      return (
        <EditableImageTextBlock
          content={block.content as ImageTextBlockContent}
          onUpdate={updateContent}
        />
      );
    case 'faq':
      return (
        <EditableFaqBlock
          content={block.content as FaqBlockContent}
          onUpdate={updateContent}
        />
      );
    case 'spacer':
      return (
        <EditableSpacerBlock
          content={block.content as SpacerBlockContent}
          onUpdate={updateContent}
        />
      );
    default:
      return (
        <div className="p-4 bg-muted rounded text-muted-foreground text-sm">
          Onbekend bloktype: {block.type}
        </div>
      );
  }
}
