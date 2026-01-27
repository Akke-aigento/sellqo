import { useState, useCallback } from 'react';
import { ArrowLeft, Plus, Monitor, Smartphone, Tablet, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InlineTextEditor } from './InlineTextEditor';
import { PageBlockRenderer } from './blocks/PageBlockRenderer';
import { PageBlockToolbar } from './blocks/PageBlockToolbar';
import type { StorefrontPage, PageBlock, PageBlockType } from '@/types/storefront';
import { cn } from '@/lib/utils';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Type, Image, HelpCircle, Heading, Minus } from 'lucide-react';

type DeviceType = 'desktop' | 'tablet' | 'mobile';

const deviceWidths: Record<DeviceType, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
};

const BLOCK_TYPES: Array<{ type: PageBlockType; label: string; icon: typeof Type; description: string }> = [
  { type: 'heading', label: 'Koptekst', icon: Heading, description: 'H1, H2 of H3 titel' },
  { type: 'richtext', label: 'Tekst', icon: Type, description: 'Rich text content' },
  { type: 'image_text', label: 'Afbeelding + Tekst', icon: Image, description: 'Afbeelding naast tekst' },
  { type: 'faq', label: 'FAQ', icon: HelpCircle, description: 'Veelgestelde vragen' },
  { type: 'spacer', label: 'Witruimte', icon: Minus, description: 'Verticale ruimte' },
];

interface StaticPageEditorProps {
  page: StorefrontPage;
  onClose: () => void;
  onSave: (blocks: PageBlock[]) => void;
  isSaving?: boolean;
}

function SortableBlock({
  block,
  index,
  totalBlocks,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  block: PageBlock;
  index: number;
  totalBlocks: number;
  onUpdate: (updates: Partial<PageBlock>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
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
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative group',
        isDragging && 'z-50 opacity-80'
      )}
      {...attributes}
    >
      <PageBlockToolbar
        dragListeners={listeners}
        onDelete={onDelete}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        canMoveUp={index > 0}
        canMoveDown={index < totalBlocks - 1}
      />
      <div className={cn(
        'border-2 border-transparent transition-colors',
        'group-hover:border-primary/20 rounded-lg'
      )}>
        <PageBlockRenderer
          block={block}
          onUpdate={onUpdate}
        />
      </div>
    </div>
  );
}

export function StaticPageEditor({ page, onClose, onSave, isSaving }: StaticPageEditorProps) {
  const [device, setDevice] = useState<DeviceType>('desktop');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  
  // Parse existing content as blocks or start fresh
  const parseBlocks = (): PageBlock[] => {
    if (!page.content) return [];
    try {
      const parsed = JSON.parse(page.content);
      if (Array.isArray(parsed)) return parsed;
      // Legacy HTML content - convert to single richtext block
      return [{
        id: crypto.randomUUID(),
        type: 'richtext',
        content: { html: page.content },
        settings: {},
        sort_order: 0,
      }];
    } catch {
      // Legacy HTML content
      if (page.content.trim()) {
        return [{
          id: crypto.randomUUID(),
          type: 'richtext',
          content: { html: page.content },
          settings: {},
          sort_order: 0,
        }];
      }
      return [];
    }
  };

  const [blocks, setBlocks] = useState<PageBlock[]>(parseBlocks);
  const [pageTitle, setPageTitle] = useState(page.title);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = blocks.findIndex((b) => b.id === active.id);
      const newIndex = blocks.findIndex((b) => b.id === over.id);
      setBlocks(arrayMove(blocks, oldIndex, newIndex).map((b, i) => ({ ...b, sort_order: i })));
    }
  };

  const handleAddBlock = (type: PageBlockType) => {
    const newBlock: PageBlock = {
      id: crypto.randomUUID(),
      type,
      content: getDefaultContent(type),
      settings: {},
      sort_order: blocks.length,
    };
    setBlocks([...blocks, newBlock]);
    setAddDialogOpen(false);
  };

  const getDefaultContent = (type: PageBlockType): PageBlock['content'] => {
    switch (type) {
      case 'richtext':
        return { html: '<p>Voeg hier je tekst toe...</p>' };
      case 'heading':
        return { text: 'Nieuwe koptekst', level: 'h2' };
      case 'image_text':
        return { title: '', text: '', image_position: 'right' };
      case 'faq':
        return { items: [{ id: crypto.randomUUID(), question: 'Vraag?', answer: 'Antwoord...' }] };
      case 'spacer':
        return { height: 'medium' };
      default:
        return {};
    }
  };

  const handleUpdateBlock = useCallback((blockId: string, updates: Partial<PageBlock>) => {
    setBlocks(prev => prev.map(b => 
      b.id === blockId ? { ...b, ...updates } : b
    ));
  }, []);

  const handleDeleteBlock = (blockId: string) => {
    if (confirm('Weet je zeker dat je dit blok wilt verwijderen?')) {
      setBlocks(prev => prev.filter(b => b.id !== blockId));
    }
  };

  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= blocks.length) return;
    setBlocks(arrayMove(blocks, index, newIndex).map((b, i) => ({ ...b, sort_order: i })));
  };

  const handleSave = () => {
    onSave(blocks);
  };

  return (
    <TooltipProvider>
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onClose}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <InlineTextEditor
                value={pageTitle}
                onSave={setPageTitle}
                as="h2"
                className="text-xl font-semibold"
                placeholder="Pagina titel..."
              />
              <p className="text-sm text-muted-foreground">/{page.slug}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <ToggleGroup 
              type="single" 
              value={device} 
              onValueChange={(value) => value && setDevice(value as DeviceType)}
              size="sm"
            >
              <ToggleGroupItem value="desktop" aria-label="Desktop view">
                <Monitor className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="tablet" aria-label="Tablet view">
                <Tablet className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="mobile" aria-label="Mobile view">
                <Smartphone className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
            
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Opslaan
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 bg-muted/30 overflow-auto p-4">
          <div 
            className={cn(
              'bg-background rounded-lg shadow-lg overflow-hidden mx-auto transition-all duration-300 min-h-[60vh]',
              device === 'mobile' && 'border-4 border-foreground/10 rounded-3xl'
            )}
            style={{ 
              width: deviceWidths[device],
              maxWidth: '100%',
            }}
          >
            <div className="p-8">
              {blocks.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Type className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">Geen blokken</p>
                  <p className="text-sm mb-4">Voeg blokken toe om je pagina op te bouwen</p>
                  <Button onClick={() => setAddDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Blok Toevoegen
                  </Button>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={blocks.map(b => b.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-4">
                      {blocks.map((block, index) => (
                        <SortableBlock
                          key={block.id}
                          block={block}
                          index={index}
                          totalBlocks={blocks.length}
                          onUpdate={(updates) => handleUpdateBlock(block.id, updates)}
                          onDelete={() => handleDeleteBlock(block.id)}
                          onMoveUp={() => handleMoveBlock(index, 'up')}
                          onMoveDown={() => handleMoveBlock(index, 'down')}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
              
              {/* Add Block Button */}
              {blocks.length > 0 && (
                <div className="mt-6 text-center">
                  <Button variant="outline" onClick={() => setAddDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Blok Toevoegen
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Add Block Dialog */}
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Blok Toevoegen</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 mt-4">
              {BLOCK_TYPES.map((type) => (
                <button
                  key={type.type}
                  onClick={() => handleAddBlock(type.type)}
                  className="flex flex-col items-center gap-2 p-4 rounded-lg border hover:border-primary hover:bg-accent transition-colors"
                >
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <type.icon className="h-5 w-5" />
                  </div>
                  <span className="font-medium text-sm">{type.label}</span>
                  <span className="text-xs text-muted-foreground text-center">
                    {type.description}
                  </span>
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
