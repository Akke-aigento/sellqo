import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BLOCK_TEMPLATES, generateBlockId } from '@/types/emailBuilder';
import type { EmailBlock, EmailBlockType } from '@/types/emailBuilder';

interface EmailBlockPaletteProps {
  onAddBlock: (block: EmailBlock) => void;
}

export function EmailBlockPalette({ onAddBlock }: EmailBlockPaletteProps) {
  const handleAddBlock = (type: EmailBlockType) => {
    const template = BLOCK_TEMPLATES[type];
    const newBlock: EmailBlock = {
      id: generateBlockId(),
      type,
      content: { ...template.defaultContent },
      style: { ...template.defaultStyle },
    };
    onAddBlock(newBlock);
  };

  const blockCategories = [
    {
      title: 'Inhoud',
      blocks: ['header', 'text', 'image', 'button'] as EmailBlockType[],
    },
    {
      title: 'Layout',
      blocks: ['divider', 'spacer'] as EmailBlockType[],
    },
    {
      title: 'Commerce',
      blocks: ['product'] as EmailBlockType[],
    },
    {
      title: 'Footer',
      blocks: ['social', 'footer'] as EmailBlockType[],
    },
  ];

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Blokken</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {blockCategories.map((category) => (
          <div key={category.title}>
            <h4 className="text-xs font-medium text-muted-foreground mb-2">
              {category.title}
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {category.blocks.map((type) => {
                const template = BLOCK_TEMPLATES[type];
                return (
                  <Button
                    key={type}
                    variant="outline"
                    size="sm"
                    className="h-auto py-2 px-3 justify-start"
                    onClick={() => handleAddBlock(type)}
                  >
                    <span className="mr-2">{template.icon}</span>
                    <span className="text-xs">{template.name}</span>
                  </Button>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
