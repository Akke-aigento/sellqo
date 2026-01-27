import { type ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { SectionToolbar } from './SectionToolbar';
import { useVisualEditor } from './VisualEditorContext';
import type { HomepageSection } from '@/types/storefront';

interface EditableSectionProps {
  section: HomepageSection;
  index: number;
  totalSections: number;
  onToggleVisibility: () => void;
  onOpenSettings: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  children: ReactNode;
}

export function EditableSection({
  section,
  index,
  totalSections,
  onToggleVisibility,
  onOpenSettings,
  onDelete,
  onMoveUp,
  onMoveDown,
  children,
}: EditableSectionProps) {
  const { selectedSectionId, setSelectedSectionId } = useVisualEditor();
  const isSelected = selectedSectionId === section.id;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const handleClick = (e: React.MouseEvent) => {
    // Don't select if clicking on toolbar buttons
    if ((e.target as HTMLElement).closest('.section-toolbar')) {
      return;
    }
    setSelectedSectionId(section.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleClick}
      className={cn(
        'relative group',
        isDragging && 'opacity-50 z-50',
        !section.is_visible && 'opacity-40',
        isSelected && 'ring-2 ring-primary ring-offset-2',
      )}
    >
      {/* Toolbar overlay */}
      <SectionToolbar
        sectionType={section.section_type}
        isVisible={section.is_visible}
        isFirst={index === 0}
        isLast={index === totalSections - 1}
        onToggleVisibility={onToggleVisibility}
        onOpenSettings={onOpenSettings}
        onDelete={onDelete}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        dragHandleProps={{ ...attributes, ...listeners }}
        className="section-toolbar"
      />

      {/* Hidden overlay indicator */}
      {!section.is_visible && (
        <div className="absolute inset-0 bg-muted/30 flex items-center justify-center z-10 pointer-events-none">
          <span className="bg-background/90 px-3 py-1 rounded text-sm font-medium">
            Verborgen sectie
          </span>
        </div>
      )}

      {/* Section content */}
      {children}
    </div>
  );
}
