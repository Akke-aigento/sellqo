import { useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { ChevronRight, ChevronDown, Folder, FolderOpen, Pencil, Trash2, Plus, GripVertical, CornerDownRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { CategoryMoveDropdown } from './CategoryMoveDropdown';
import { HighlightText } from './CategorySearch';
import type { Category } from '@/types/product';

interface CategoryTreeItemProps {
  category: Category;
  level?: number;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  onAddChild: (parentId: string) => void;
  onMove: (categoryId: string, newParentId: string | null) => void;
  activeId?: string | null;
  breadcrumb?: string[];
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  allCategories: Category[];
  searchQuery?: string;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
}

export function CategoryTreeItem({
  category,
  level = 0,
  onEdit,
  onDelete,
  onAddChild,
  onMove,
  activeId,
  breadcrumb = [],
  expandedIds,
  onToggleExpand,
  allCategories,
  searchQuery = '',
  selectedIds,
  onToggleSelect,
}: CategoryTreeItemProps) {
  const isExpanded = expandedIds.has(category.id);
  const hasChildren = category.children && category.children.length > 0;
  const currentBreadcrumb = [...breadcrumb, category.name];
  const isSelected = selectedIds.has(category.id);

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    isDragging,
  } = useSortable({ 
    id: category.id,
    data: {
      type: 'category',
      category,
      level,
    }
  });

  // Droppable for this item (to make dragged items children of this)
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `drop-on-${category.id}`,
    data: {
      type: 'category-target',
      targetId: category.id,
    }
  });

  // Combine sortable and droppable refs
  const setRefs = (element: HTMLDivElement | null) => {
    setSortableRef(element);
    setDroppableRef(element);
  };

  // Show drop indicator when another item is dragged over this one
  const showDropIndicator = isOver && activeId && activeId !== category.id;

  return (
    <div 
      ref={setRefs} 
      className={cn(
        "select-none",
        // Make original item invisible when dragging - only DragOverlay shows
        isDragging && "opacity-0"
      )}
    >
      <div
        className={cn(
          "group flex items-center gap-2 py-2.5 px-3 rounded-lg transition-all",
          "hover:bg-muted/50",
          isSelected && "bg-primary/5 ring-1 ring-primary/20",
          // Drop indicator - highlight when item is dragged over this category
          showDropIndicator && "ring-2 ring-primary bg-primary/10"
        )}
      >
        {/* Checkbox for bulk selection */}
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(category.id)}
          className="shrink-0"
        />

        {/* Indent indicator for nested items */}
        {level > 0 && (
          <div className="flex items-center" style={{ width: level * 24 }}>
            {Array.from({ length: level }).map((_, i) => (
              <div key={i} className="w-6 flex justify-center">
                {i === level - 1 ? (
                  <CornerDownRight className="h-3 w-3 text-muted-foreground/50" />
                ) : (
                  <div className="w-px h-full bg-muted" />
                )}
              </div>
            ))}
          </div>
        )}

        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded touch-none"
          title="Sleep om te verplaatsen"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
        
        {hasChildren ? (
          <button
            onClick={() => onToggleExpand(category.id)}
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
          <FolderOpen className="h-4 w-4 text-primary" />
        ) : (
          <Folder className="h-4 w-4 text-muted-foreground" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">
              <HighlightText text={category.name} search={searchQuery} />
            </span>
          </div>
          {/* Breadcrumb path */}
          {level > 0 && (
            <div className="text-xs text-muted-foreground truncate">
              {breadcrumb.join(' › ')}
            </div>
          )}
        </div>

        <Badge variant={category.is_active ? "default" : "secondary"} className="text-xs shrink-0">
          {category.is_active ? 'Actief' : 'Inactief'}
        </Badge>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <CategoryMoveDropdown
            category={category}
            allCategories={allCategories}
            onMove={onMove}
          />
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
        {/* Drop hint text */}
        {showDropIndicator && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary font-medium bg-primary/10 px-2 py-0.5 rounded">
            Subcategorie maken
          </div>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div className="ml-2">
          {category.children!.map((child) => (
            <CategoryTreeItem
              key={child.id}
              category={child}
              level={level + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
              onMove={onMove}
              activeId={activeId}
              breadcrumb={currentBreadcrumb}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              allCategories={allCategories}
              searchQuery={searchQuery}
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
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
        "py-3 px-4 rounded-lg border-2 border-dashed transition-all mb-3",
        isOver 
          ? "border-primary bg-primary/10 text-primary" 
          : "border-muted-foreground/30 text-muted-foreground"
      )}
    >
      <div className="flex items-center gap-2 text-sm">
        <Folder className="h-4 w-4" />
        <span>{isOver ? "Loslaten om hoofdcategorie te maken" : "Sleep hier voor hoofdcategorie (geen parent)"}</span>
      </div>
    </div>
  );
}
