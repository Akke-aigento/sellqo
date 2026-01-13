import { useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  useDroppable,
  pointerWithin,
  rectIntersection,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus, FolderTree, Loader2, Folder, ChevronsUpDown, ChevronsDownUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useCategories } from '@/hooks/useCategories';
import { CategoryTreeItem, RootDropZone } from '@/components/admin/CategoryTreeItem';
import { CategoryFormDialog } from '@/components/admin/CategoryFormDialog';
import type { Category, CategoryFormData } from '@/types/product';

// Helper to check if a category is a descendant of another
function isDescendantOf(categories: Category[], childId: string, parentId: string): boolean {
  const findInChildren = (cats: Category[], targetId: string): boolean => {
    for (const cat of cats) {
      if (cat.id === targetId) return true;
      if (cat.children && findInChildren(cat.children, targetId)) return true;
    }
    return false;
  };

  const parent = categories.find(c => c.id === parentId);
  if (!parent || !parent.children) return false;
  return findInChildren(parent.children, childId);
}

export default function CategoriesPage() {
  const { 
    categories, 
    categoryTree, 
    isLoading, 
    createCategory, 
    updateCategory, 
    deleteCategory,
    updateSortOrder,
    reparentCategory,
  } = useCategories();

  const [formOpen, setFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [parentIdForNew, setParentIdForNew] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(categories.map(c => c.id)));

  // Update expandedIds when categories change (e.g., new category added)
  const allCategoryIds = useMemo(() => new Set(categories.map(c => c.id)), [categories]);
  
  const handleExpandAll = () => {
    setExpandedIds(new Set(categories.map(c => c.id)));
  };

  const handleCollapseAll = () => {
    setExpandedIds(new Set());
  };

  const handleToggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Root drop zone for making items top-level
  const { setNodeRef: setRootDropRef, isOver: isOverRoot } = useDroppable({
    id: 'root-drop-zone',
    data: {
      type: 'root-drop-zone',
    }
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Get all category IDs for SortableContext
  const getAllCategoryIds = (cats: Category[]): string[] => {
    return cats.flatMap(cat => [cat.id, ...(cat.children ? getAllCategoryIds(cat.children) : [])]);
  };

  const categoryIds = useMemo(() => getAllCategoryIds(categoryTree), [categoryTree]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const category = categories.find(c => c.id === active.id);
    setActiveCategory(category || null);
    setActiveId(active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCategory(null);
    setActiveId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Handle drop on root zone - make it a top-level category
    if (overId === 'root-drop-zone') {
      const draggedCategory = categories.find(c => c.id === activeId);
      if (draggedCategory && draggedCategory.parent_id !== null) {
        reparentCategory.mutate({ id: activeId, newParentId: null });
      }
      return;
    }

    // Handle drop on child zone (specific area to add as child)
    if (overId.startsWith('child-zone-')) {
      const targetId = overId.replace('child-zone-', '');
      const draggedCategory = categories.find(c => c.id === activeId);
      const targetCategory = categories.find(c => c.id === targetId);

      if (!draggedCategory || !targetCategory) return;
      if (activeId === targetId) return;

      // Prevent dropping a parent onto its own child
      if (isDescendantOf(categoryTree, targetId, activeId)) {
        return;
      }

      // Don't reparent if already a child of target
      if (draggedCategory.parent_id === targetId) return;

      reparentCategory.mutate({ id: activeId, newParentId: targetId });
      return;
    }

    // Handle drop on a category drop zone (reparenting)
    if (overId.startsWith('droppable-')) {
      const targetId = overId.replace('droppable-', '');
      const draggedCategory = categories.find(c => c.id === activeId);
      const targetCategory = categories.find(c => c.id === targetId);

      if (!draggedCategory || !targetCategory) return;
      if (activeId === targetId) return;

      // Prevent dropping a parent onto its own child
      if (isDescendantOf(categoryTree, targetId, activeId)) {
        return;
      }

      // Don't reparent if already a child of target
      if (draggedCategory.parent_id === targetId) return;

      reparentCategory.mutate({ id: activeId, newParentId: targetId });
      return;
    }

    // Handle reordering within same level (original behavior)
    if (activeId === overId) return;

    const activeCat = categories.find(c => c.id === activeId);
    const overCat = categories.find(c => c.id === overId);

    if (!activeCat || !overCat) return;

    // Only allow reordering within the same parent level
    if (activeCat.parent_id !== overCat.parent_id) {
      return;
    }

    // Get siblings at the same level
    const siblings = categories
      .filter(c => c.parent_id === activeCat.parent_id)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    const oldIndex = siblings.findIndex(c => c.id === activeId);
    const newIndex = siblings.findIndex(c => c.id === overId);

    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
      const reordered = [...siblings];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, moved);
      
      const updates = reordered.map((cat, index) => ({
        id: cat.id,
        sort_order: index,
      }));
      updateSortOrder.mutate(updates);
    }
  };

  const handleAddNew = () => {
    setEditingCategory(null);
    setParentIdForNew(null);
    setFormOpen(true);
  };

  const handleAddChild = (parentId: string) => {
    setEditingCategory(null);
    setParentIdForNew(parentId);
    setFormOpen(true);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setParentIdForNew(null);
    setFormOpen(true);
  };

  const handleDelete = (category: Category) => {
    setCategoryToDelete(category);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (categoryToDelete) {
      await deleteCategory.mutateAsync(categoryToDelete.id);
      setDeleteDialogOpen(false);
      setCategoryToDelete(null);
    }
  };

  const handleSubmit = async (data: CategoryFormData) => {
    if (editingCategory) {
      await updateCategory.mutateAsync({ id: editingCategory.id, data });
    } else {
      await createCategory.mutateAsync(data);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Categorieën</h1>
          <p className="text-muted-foreground">
            Beheer je productcategorieën en subcategorieën
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExpandAll}>
            <ChevronsUpDown className="mr-2 h-4 w-4" />
            Alles openklappen
          </Button>
          <Button variant="outline" size="sm" onClick={handleCollapseAll}>
            <ChevronsDownUp className="mr-2 h-4 w-4" />
            Alles inklappen
          </Button>
          <Button onClick={handleAddNew}>
            <Plus className="mr-2 h-4 w-4" />
            Nieuwe categorie
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderTree className="h-5 w-5" />
            Categoriestructuur
          </CardTitle>
          <CardDescription>
            Sleep categorieën met het ⋮⋮ icoon. Sleep naar een categorie om subcategorie te maken, of naar boven voor hoofdcategorie.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {categoryTree.length === 0 ? (
            <div className="text-center py-12">
              <FolderTree className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">Geen categorieën</h3>
              <p className="text-muted-foreground mb-4">
                Begin met het toevoegen van je eerste categorie.
              </p>
              <Button onClick={handleAddNew}>
                <Plus className="mr-2 h-4 w-4" />
                Eerste categorie toevoegen
              </Button>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={pointerWithin}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={categoryIds} strategy={verticalListSortingStrategy}>
                {/* Root drop zone */}
                <div ref={setRootDropRef}>
                  <RootDropZone isOver={isOverRoot} activeId={activeId} />
                </div>
                
                <div className="space-y-0.5">
                  {categoryTree.map((category) => (
                    <CategoryTreeItem
                      key={category.id}
                      category={category}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onAddChild={handleAddChild}
                      activeId={activeId}
                      breadcrumb={[]}
                      expandedIds={expandedIds}
                      onToggleExpand={handleToggleExpand}
                    />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay dropAnimation={null}>
                {activeCategory ? (
                  <div className="flex items-center gap-2 py-2 px-4 rounded-lg bg-background shadow-xl border-2 border-primary">
                    <Folder className="h-4 w-4 text-primary" />
                    <span className="font-medium">{activeCategory.name}</span>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </CardContent>
      </Card>

      <CategoryFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        category={editingCategory}
        parentId={parentIdForNew}
        categories={categoryTree}
        onSubmit={handleSubmit}
        isLoading={createCategory.isPending || updateCategory.isPending}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Categorie verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je "{categoryToDelete?.name}" wilt verwijderen?
              {categoryToDelete?.children && categoryToDelete.children.length > 0 && (
                <span className="block mt-2 text-destructive font-medium">
                  Let op: Deze categorie heeft {categoryToDelete.children.length} subcategorie(ën) 
                  die ook verwijderd worden.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
