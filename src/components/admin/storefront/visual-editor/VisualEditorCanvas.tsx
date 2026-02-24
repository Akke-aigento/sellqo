import { useState, useCallback } from 'react';
import { Plus, Monitor, Smartphone, Tablet, Undo2, Redo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useStorefront } from '@/hooks/useStorefront';
import { useTenant } from '@/hooks/useTenant';
import { SECTION_TYPES, type HomepageSectionType, type HomepageSection } from '@/types/storefront';
import { VisualEditorProvider, useVisualEditor } from './VisualEditorContext';
import { useUndoRedo } from './hooks/useUndoRedo';
import { EditableSection } from './EditableSection';
import { QuickEditPanel } from './QuickEditPanel';
import {
  EditableHeroSection,
  EditableTextImageSection,
  EditableFeaturedProductsSection,
  EditableNewsletterSection,
  EditableGenericSection,
} from './sections';
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
} from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import { 
  Image, Star, Grid3X3, LayoutList, Mail, MessageSquare, Play 
} from 'lucide-react';

type DeviceType = 'desktop' | 'tablet' | 'mobile';

const deviceWidths: Record<DeviceType, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
};

const sectionIcons: Record<HomepageSectionType, React.ReactNode> = {
  hero: <Image className="h-4 w-4" />,
  featured_products: <Star className="h-4 w-4" />,
  collection: <Grid3X3 className="h-4 w-4" />,
  text_image: <LayoutList className="h-4 w-4" />,
  newsletter: <Mail className="h-4 w-4" />,
  testimonials: <MessageSquare className="h-4 w-4" />,
  video: <Play className="h-4 w-4" />,
  announcement: <MessageSquare className="h-4 w-4" />,
  external_reviews: <Star className="h-4 w-4" />,
  categories_grid: <Grid3X3 className="h-4 w-4" />,
  usp_bar: <Star className="h-4 w-4" />,
  cta_banner: <MessageSquare className="h-4 w-4" />,
};

function VisualEditorCanvasInner() {
  const { sections, sectionsLoading, createSection, updateSection, deleteSection, reorderSections } = useStorefront();
  const { currentTenant } = useTenant();
  const { setSelectedSectionId, pushHistory } = useVisualEditor();
  const { canUndo, canRedo, undo, redo, undoCount, redoCount } = useUndoRedo();
  
  const [device, setDevice] = useState<DeviceType>('desktop');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<HomepageSection | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = sections.findIndex((s) => s.id === active.id);
      const newIndex = sections.findIndex((s) => s.id === over.id);
      const newOrder = arrayMove(sections, oldIndex, newIndex);
      reorderSections.mutate(newOrder.map(s => s.id));
    }
  };

  const handleAddSection = (type: HomepageSectionType) => {
    const sectionType = SECTION_TYPES.find(t => t.type === type);
    createSection.mutate({
      section_type: type,
      title: sectionType?.label || type,
      subtitle: null,
      content: {},
      settings: {},
      sort_order: sections.length,
      is_visible: true,
    });
    setAddDialogOpen(false);
  };

  const handleUpdateSection = useCallback((section: HomepageSection, updates: Partial<HomepageSection>) => {
    // Push to history for undo/redo
    const previousState: Partial<HomepageSection> = {};
    for (const key of Object.keys(updates) as (keyof HomepageSection)[]) {
      previousState[key] = section[key] as never;
    }
    pushHistory({
      sectionId: section.id,
      previousState,
      newState: updates,
    });
    
    updateSection.mutate({
      id: section.id,
      ...updates,
    });
  }, [updateSection, pushHistory]);

  const handleToggleVisibility = (section: HomepageSection) => {
    updateSection.mutate({ id: section.id, is_visible: !section.is_visible });
  };

  const handleDelete = (id: string) => {
    if (confirm('Weet je zeker dat je deze sectie wilt verwijderen?')) {
      deleteSection.mutate(id);
      setSelectedSectionId(null);
    }
  };

  const handleMoveSection = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sections.length) return;
    const newOrder = arrayMove(sections, index, newIndex);
    reorderSections.mutate(newOrder.map(s => s.id));
  };

  const renderSection = (section: HomepageSection) => {
    const props = {
      section,
      onUpdate: (updates: Partial<HomepageSection>) => handleUpdateSection(section, updates),
    };

    switch (section.section_type) {
      case 'hero':
        return <EditableHeroSection {...props} />;
      case 'text_image':
        return <EditableTextImageSection {...props} />;
      case 'featured_products':
        return <EditableFeaturedProductsSection {...props} />;
      case 'newsletter':
        return <EditableNewsletterSection {...props} />;
      default:
        return <EditableGenericSection {...props} />;
    }
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full">
        {/* Toolbar */}
        <div className="flex items-center justify-between p-3 border-b bg-background sticky top-0 z-30">
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

            {/* Undo/Redo Buttons */}
            <div className="flex items-center gap-1 ml-2 border-l pl-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={undo}
                    disabled={!canUndo}
                  >
                    <Undo2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Ongedaan maken (Ctrl+Z){undoCount > 0 && ` · ${undoCount}`}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={redo}
                    disabled={!canRedo}
                  >
                    <Redo2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Opnieuw (Ctrl+Shift+Z){redoCount > 0 && ` · ${redoCount}`}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Sectie Toevoegen
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Sectie Toevoegen</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 mt-4">
                {SECTION_TYPES.map((type) => (
                  <button
                    key={type.type}
                    onClick={() => handleAddSection(type.type)}
                    className="flex flex-col items-center gap-2 p-4 rounded-lg border hover:border-primary hover:bg-accent transition-colors"
                  >
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      {sectionIcons[type.type]}
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

        {/* Canvas */}
        <div className="flex-1 bg-muted/30 overflow-auto p-4">
          <div 
            className={cn(
              'bg-background rounded-lg shadow-lg overflow-hidden mx-auto transition-all duration-300',
              device === 'mobile' && 'border-4 border-foreground/10 rounded-3xl'
            )}
            style={{ 
              width: deviceWidths[device],
              maxWidth: '100%',
            }}
          >
            {sectionsLoading ? (
              <div className="p-8 space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-40 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : sections.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <Image className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">Geen secties</p>
                <p className="text-sm">Klik op "Sectie Toevoegen" om te beginnen</p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={sections.map(s => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div>
                    {sections.map((section, index) => (
                      <EditableSection
                        key={section.id}
                        section={section}
                        index={index}
                        totalSections={sections.length}
                        onToggleVisibility={() => handleToggleVisibility(section)}
                        onOpenSettings={() => setSettingsSection(section)}
                        onDelete={() => handleDelete(section.id)}
                        onMoveUp={() => handleMoveSection(index, 'up')}
                        onMoveDown={() => handleMoveSection(index, 'down')}
                      >
                        {renderSection(section)}
                      </EditableSection>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>

        {/* Quick Edit Panel */}
        {settingsSection && (
          <QuickEditPanel
            section={settingsSection}
            isOpen={!!settingsSection}
            onClose={() => setSettingsSection(null)}
            onUpdate={(updates) => handleUpdateSection(settingsSection, updates)}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

export function VisualEditorCanvas() {
  return (
    <VisualEditorProvider>
      <VisualEditorCanvasInner />
    </VisualEditorProvider>
  );
}
