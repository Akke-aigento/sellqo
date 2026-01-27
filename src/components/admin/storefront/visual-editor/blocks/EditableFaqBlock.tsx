import { useState } from 'react';
import type { FaqBlockContent } from '@/types/storefront';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EditableFaqBlockProps {
  content: FaqBlockContent;
  onUpdate: (content: Partial<FaqBlockContent>) => void;
}

export function EditableFaqBlock({ content, onUpdate }: EditableFaqBlockProps) {
  const [openItems, setOpenItems] = useState<string[]>([]);

  const items = content.items || [];

  const handleAddItem = () => {
    const newItem = {
      id: crypto.randomUUID(),
      question: 'Nieuwe vraag?',
      answer: 'Voeg hier het antwoord toe...',
    };
    onUpdate({ items: [...items, newItem] });
    setOpenItems([...openItems, newItem.id]);
  };

  const handleUpdateItem = (itemId: string, updates: Partial<typeof items[0]>) => {
    onUpdate({
      items: items.map(item => 
        item.id === itemId ? { ...item, ...updates } : item
      ),
    });
  };

  const handleDeleteItem = (itemId: string) => {
    onUpdate({ items: items.filter(item => item.id !== itemId) });
  };

  const handleQuestionChange = (itemId: string, e: React.FocusEvent<HTMLDivElement>) => {
    const newQuestion = e.currentTarget.textContent || '';
    handleUpdateItem(itemId, { question: newQuestion });
  };

  const handleAnswerChange = (itemId: string, e: React.FocusEvent<HTMLDivElement>) => {
    const newAnswer = e.currentTarget.textContent || '';
    handleUpdateItem(itemId, { answer: newAnswer });
  };

  return (
    <div className="space-y-4">
      <Accordion type="multiple" value={openItems} onValueChange={setOpenItems}>
        {items.map((item, index) => (
          <AccordionItem key={item.id} value={item.id} className="group">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab" />
              <AccordionTrigger className="flex-1 hover:no-underline">
                <div
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleQuestionChange(item.id, e)}
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    'text-left font-medium outline-none cursor-text',
                    'hover:ring-2 hover:ring-primary/30 rounded px-1'
                  )}
                >
                  {item.question}
                </div>
              </AccordionTrigger>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                onClick={() => handleDeleteItem(item.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <AccordionContent>
              <div
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => handleAnswerChange(item.id, e)}
                className={cn(
                  'outline-none cursor-text text-muted-foreground py-2 px-1',
                  'hover:ring-2 hover:ring-primary/30 rounded'
                )}
              >
                {item.answer}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <Button variant="outline" size="sm" onClick={handleAddItem}>
        <Plus className="h-4 w-4 mr-2" />
        Vraag Toevoegen
      </Button>
    </div>
  );
}
