import { useState } from 'react';
import { Plus, FolderTree, Loader2 } from 'lucide-react';
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
import { CategoryTreeItem } from '@/components/admin/CategoryTreeItem';
import { CategoryFormDialog } from '@/components/admin/CategoryFormDialog';
import type { Category, CategoryFormData } from '@/types/product';

export default function CategoriesPage() {
  const { 
    categories, 
    categoryTree, 
    isLoading, 
    createCategory, 
    updateCategory, 
    deleteCategory 
  } = useCategories();

  const [formOpen, setFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [parentIdForNew, setParentIdForNew] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

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
        <Button onClick={handleAddNew}>
          <Plus className="mr-2 h-4 w-4" />
          Nieuwe categorie
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderTree className="h-5 w-5" />
            Categoriestructuur
          </CardTitle>
          <CardDescription>
            Sleep categorieën om de volgorde te wijzigen. Klik op een pijl om subcategorieën te tonen.
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
            <div className="space-y-1">
              {categoryTree.map((category) => (
                <CategoryTreeItem
                  key={category.id}
                  category={category}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onAddChild={handleAddChild}
                />
              ))}
            </div>
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
