import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { ChevronRight, ChevronDown, Folder, FolderOpen, Pencil, Trash2, Plus, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Category } from '@/types/product';

interface CategoryTreeItemProps {
  category: Category;
  level?: number;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  onAddChild: (parentId: string) => void;
  activeId?: string | null;
}

export function CategoryTreeItem({
  category,
  level = 0,
  onEdit,
  onDelete,
  onAddChild,
  activeId,
}: CategoryTreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = category.children && category.children.length > 0;

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: category.id,
    data: {
      type: 'category',
      category,
      level,
    }
  });

  // Make this item a drop target for reparenting
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `droppable-${category.id}`,
    data: {
      type: 'category-drop-zone',
      category,
      accepts: 'category',
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Don't show drop indicator on itself
  const showDropIndicator = isOver && activeId && activeId !== category.id;

  // Combine refs
  const setRefs = (element: HTMLDivElement | null) => {
    setSortableRef(element);
    setDroppableRef(element);
  };

  return (
    <div ref={setRefs} style={style} className="select-none">
      <div
        className={cn(
          "group flex items-center gap-2 py-2 px-3 rounded-lg transition-all",
          "hover:bg-muted/50",
          level > 0 && "ml-6",
          isDragging && "opacity-50 bg-muted shadow-lg ring-2 ring-primary/20",
          showDropIndicator && "bg-primary/10 ring-2 ring-primary ring-dashed"
        )}
      >
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-muted rounded touch-none"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
        
        {hasChildren ? (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-0.5 hover:bg-muted rounded"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}

        {isExpanded && hasChildren ? (
          <FolderOpen className={cn("h-4 w-4", showDropIndicator ? "text-primary" : "text-primary")} />
        ) : (
          <Folder className={cn("h-4 w-4", showDropIndicator ? "text-primary" : "text-muted-foreground")} />
        )}

        <span className={cn("flex-1 font-medium", showDropIndicator && "text-primary")}>
          {category.name}
          {showDropIndicator && (
            <span className="ml-2 text-xs text-primary font-normal">
              ← hier plaatsen
            </span>
          )}
        </span>

        <Badge variant={category.is_active ? "default" : "secondary"} className="text-xs">
          {category.is_active ? 'Actief' : 'Inactief'}
        </Badge>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onAddChild(category.id)}
            title="Subcategorie toevoegen"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onEdit(category)}
            title="Bewerken"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(category)}
            title="Verwijderen"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className="border-l-2 border-muted ml-5">
          {category.children!.map((child) => (
            <CategoryTreeItem
              key={child.id}
              category={child}
              level={level + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
              activeId={activeId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Root drop zone component for making items top-level
export function RootDropZone({ isOver, activeId }: { isOver: boolean; activeId: string | null }) {
  if (!activeId) return null;
  
  return (
    <div
      className={cn(
        "py-3 px-4 rounded-lg border-2 border-dashed transition-all mb-2",
        isOver 
          ? "border-primary bg-primary/10 text-primary" 
          : "border-muted-foreground/30 text-muted-foreground"
      )}
    >
      <div className="flex items-center gap-2 text-sm">
        <Folder className="h-4 w-4" />
        <span>{isOver ? "Loslaten om hoofdcategorie te maken" : "Sleep hier voor hoofdcategorie"}</span>
      </div>
    </div>
  );
}
