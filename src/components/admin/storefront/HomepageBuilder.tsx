import { useState } from 'react';
import { 
  Plus, 
  GripVertical, 
  Eye, 
  EyeOff, 
  Pencil, 
  Trash2,
  Image,
  Star,
  Grid3X3,
  LayoutList,
  Mail,
  MessageSquare,
  Play,
  PanelRightOpen,
  PanelRightClose,
  LayoutPanelTop,
  List,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useStorefront } from '@/hooks/useStorefront';
import { SECTION_TYPES, type HomepageSectionType, type HomepageSection } from '@/types/storefront';
import { SectionEditor } from './SectionEditor';
import { PreviewPanel } from './PreviewPanel';
import { VisualEditorCanvas } from './visual-editor';
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
};

interface SortableSectionProps {
  section: HomepageSection;
  onEdit: (section: HomepageSection) => void;
  onToggleVisibility: (id: string, visible: boolean) => void;
  onDelete: (id: string) => void;
}

function SortableSection({ section, onEdit, onToggleVisibility, onDelete }: SortableSectionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const sectionType = SECTION_TYPES.find(t => t.type === section.section_type);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-4 rounded-lg border bg-card ${
        section.is_visible ? '' : 'opacity-60'
      }`}
    >
      <button
        className="cursor-grab hover:text-primary"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </button>

      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
          {sectionIcons[section.section_type]}
        </div>
        <div className="min-w-0">
          <p className="font-medium truncate">
            {section.title || sectionType?.label || section.section_type}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {sectionType?.description}
          </p>
        </div>
      </div>

      <Badge variant={section.is_visible ? 'default' : 'secondary'}>
        {section.is_visible ? 'Zichtbaar' : 'Verborgen'}
      </Badge>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onToggleVisibility(section.id, !section.is_visible)}
        >
          {section.is_visible ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(section)}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(section.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

type ViewMode = 'list' | 'visual';

export function HomepageBuilder() {
  const { sections, sectionsLoading, createSection, updateSection, deleteSection, reorderSections } = useStorefront();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<HomepageSection | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

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

  const handleToggleVisibility = (id: string, visible: boolean) => {
    updateSection.mutate({ id, is_visible: visible });
  };

  const handleDelete = (id: string) => {
    if (confirm('Weet je zeker dat je deze sectie wilt verwijderen?')) {
      deleteSection.mutate(id);
    }
  };

  const handleSaveSection = (section: HomepageSection) => {
    updateSection.mutate({
      id: section.id,
      title: section.title,
      subtitle: section.subtitle,
      content: section.content,
      settings: section.settings,
    });
    setEditingSection(null);
  };

  // Visual Editor mode
  if (viewMode === 'visual') {
    return (
      <div className="space-y-4">
        {/* Mode toggle header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Homepage Secties</h2>
            <p className="text-sm text-muted-foreground">
              Bewerk secties direct in de preview
            </p>
          </div>
          <ToggleGroup 
            type="single" 
            value={viewMode} 
            onValueChange={(v) => v && setViewMode(v as ViewMode)}
            size="sm"
          >
            <ToggleGroupItem value="list" aria-label="Lijst weergave">
              <List className="h-4 w-4 mr-2" />
              Lijst
            </ToggleGroupItem>
            <ToggleGroupItem value="visual" aria-label="Visual Editor">
              <LayoutPanelTop className="h-4 w-4 mr-2" />
              Visual Editor
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Visual Editor Canvas */}
        <div className="border rounded-lg overflow-hidden" style={{ height: 'calc(100vh - 200px)' }}>
          <VisualEditorCanvas />
        </div>
      </div>
    );
  }

  // List mode (original)
  return (
    <div className={`grid gap-6 ${showPreview ? 'lg:grid-cols-2' : ''}`}>
      <div>
        <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Homepage Secties</CardTitle>
              <CardDescription>
                Versleep secties om de volgorde aan te passen. Klik op bewerken om de inhoud te wijzigen.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {/* View mode toggle */}
              <ToggleGroup 
                type="single" 
                value={viewMode} 
                onValueChange={(v) => v && setViewMode(v as ViewMode)}
                size="sm"
              >
                <ToggleGroupItem value="list" aria-label="Lijst weergave">
                  <List className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="visual" aria-label="Visual Editor">
                  <LayoutPanelTop className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
              >
                {showPreview ? (
                  <>
                    <PanelRightClose className="h-4 w-4 mr-2" />
                    Verberg Preview
                  </>
                ) : (
                  <>
                    <PanelRightOpen className="h-4 w-4 mr-2" />
                    Toon Preview
                  </>
                )}
              </Button>
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
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
          </div>
        </CardHeader>
        <CardContent>
          {sectionsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : sections.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Image className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nog geen secties toegevoegd</p>
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
                <div className="space-y-3">
                  {sections.map((section) => (
                    <SortableSection
                      key={section.id}
                      section={section}
                      onEdit={setEditingSection}
                      onToggleVisibility={handleToggleVisibility}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>
      </div>

      {/* Preview Panel */}
      {showPreview && (
        <div className="hidden lg:block">
          <PreviewPanel />
        </div>
      )}

      {/* Section Editor Dialog */}
      <Dialog open={!!editingSection} onOpenChange={(open) => !open && setEditingSection(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sectie Bewerken</DialogTitle>
          </DialogHeader>
          {editingSection && (
            <SectionEditor
              section={editingSection}
              onSave={handleSaveSection}
              onCancel={() => setEditingSection(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
