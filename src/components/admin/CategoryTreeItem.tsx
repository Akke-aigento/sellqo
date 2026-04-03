import { useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { ChevronRight, ChevronDown, Folder, FolderOpen, Pencil, Trash2, Plus, GripVertical, CornerDownRight, Store } from 'lucide-react';
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
  onToggleStatus?: (id: string, updates: { is_active: boolean; hide_from_storefront: boolean }) => void;
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
  onToggleStatus,
}: CategoryTreeItemProps) {
  const isExpanded = expandedIds.has(category.id);
  const hasChildren = category.children && category.children.length > 0;
  const currentBreadcrumb = [...breadcrumb, category.name];
  const isSelected = selectedIds.has(category.id);

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
    isOver: isSortableOver,
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

  // Apply transform/transition for smooth drag animations — only translate Y, no scale
  const style = {
    transform: transform ? `translate3d(0, ${transform.y}px, 0)` : undefined,
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  // Show drop indicator when another item is dragged over this one (for reparenting)
  const showDropIndicator = isOver && activeId && activeId !== category.id;
  // Show insertion line when sortable detects this as the drop target (for reordering)
  const showInsertionLine = isSortableOver && activeId && activeId !== category.id && !isOver;

  return (
    <div
      ref={setRefs}
      style={style}
      className={cn(
        "select-none relative",
        isDragging && "opacity-40 z-50"
      )}
    >
      {/* Insertion line indicator — shows WHERE the item will be inserted */}
      {showInsertionLine && (
        <div className="absolute -top-[1px] left-2 right-2 z-40 flex items-center pointer-events-none">
          <div className="w-2.5 h-2.5 rounded-full bg-primary border-2 border-primary shrink-0 -ml-1" />
          <div className="flex-1 h-[2px] bg-primary" />
          <div className="w-2.5 h-2.5 rounded-full bg-primary border-2 border-primary shrink-0 -mr-1" />
        </div>
      )}

      <div
        className={cn(
          "group relative flex items-center gap-2 py-2.5 px-3 rounded-lg transition-colors duration-150",
          "hover:bg-muted/50",
          isSelected && "bg-primary/5 ring-1 ring-primary/20",
          // Drop indicator - highlight when item is dragged over this category (reparenting)
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
            <button
              type="button"
              onClick={() => onEdit(category)}
              className="font-medium truncate cursor-pointer hover:underline text-left"
            >
              <HighlightText text={category.name} search={searchQuery} />
            </button>
          </div>
          {/* Breadcrumb path */}
          {level > 0 && (
            <div className="text-xs text-muted-foreground truncate">
              {breadcrumb.join(' › ')}
            </div>
          )}
        </div>

        {/* Visibility/Status badge — clickable to cycle status */}
        {!category.is_active ? (
          <Badge
            variant="secondary"
            className="text-xs shrink-0 cursor-pointer select-none"
            onClick={(e) => {
              e.stopPropagation();
              onToggleStatus?.(category.id, { is_active: true, hide_from_storefront: false });
            }}
            title="Klik om te activeren (Online)"
          >
            Inactief
          </Badge>
        ) : (category as any).hide_from_storefront ? (
          <Badge
            className="bg-amber-500 hover:bg-amber-600 text-xs shrink-0 gap-1 cursor-pointer select-none"
            onClick={(e) => {
              e.stopPropagation();
              onToggleStatus?.(category.id, { is_active: false, hide_from_storefront: false });
            }}
            title="Klik om inactief te maken"
          >
            <Store className="h-3 w-3" />
            Alleen winkel
          </Badge>
        ) : (
          <Badge
            variant="default"
            className="text-xs shrink-0 cursor-pointer select-none"
            onClick={(e) => {
              e.stopPropagation();
              onToggleStatus?.(category.id, { is_active: true, hide_from_storefront: true });
            }}
            title="Klik om alleen in winkel te tonen"
          >
            Online
          </Badge>
        )}

        <div className="flex items-center gap-1 shrink-0">
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
        {/* Drop hint text for reparenting */}
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
              onToggleStatus={onToggleStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Root drop zone component for making items top-level
// Always rendered with consistent height to prevent layout shifts
export function RootDropZone({ isOver, activeId }: { isOver: boolean; activeId: string | null }) {
  return (
    <div
      className={cn(
        "overflow-hidden transition-all duration-200 ease-in-out",
        activeId
          ? "max-h-16 opacity-100 mb-3"
          : "max-h-0 opacity-0 mb-0"
      )}
    >
      <div
        className={cn(
          "py-3 px-4 rounded-lg border-2 border-dashed transition-colors duration-150",
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
    </div>
  );
}
