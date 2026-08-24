import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BLOCK_TEMPLATES, generateBlockId } from '@/types/emailBuilder';
import type { EmailBlock, EmailBlockType } from '@/types/emailBuilder';
import { useTranslation } from 'react-i18next';

interface EmailBlockPaletteProps {
  onAddBlock: (block: EmailBlock) => void;
}

export function EmailBlockPalette({ onAddBlock }: EmailBlockPaletteProps) {
  const { t } = useTranslation();
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
      title: t('admin.marketing.emailBlockPalette.inhoud'),
      blocks: ['header', 'text', 'image', 'button'] as EmailBlockType[],
    },
    {
      title: t('admin.marketing.emailBlockPalette.layout'),
      blocks: ['divider', 'spacer'] as EmailBlockType[],
    },
    {
      title: t('admin.marketing.emailBlockPalette.commerce'),
      blocks: ['product'] as EmailBlockType[],
    },
    {
      title: t('admin.marketing.emailBlockPalette.footer'),
      blocks: ['social', 'footer'] as EmailBlockType[],
    },
  ];

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{t('admin.marketing.emailBlockPalette.blokken')}</CardTitle>
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
