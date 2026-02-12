import { useState, useMemo } from 'react';
import { useDocCategories, useDocArticles, useDocSearch, useDeleteArticle, type DocLevel } from '@/hooks/useDocumentation';
import { DocSearchBar } from '@/components/admin/docs/DocSearchBar';
import { DocCategoryList } from '@/components/admin/docs/DocCategoryList';
import { DocArticleViewer } from '@/components/admin/docs/DocArticleViewer';
import { DocArticleEditor } from '@/components/admin/docs/DocArticleEditor';
import { Loader2, BookOpen, Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

function DocsPanel({ level }: { level: DocLevel }) {
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>();
  const [selectedSlug, setSelectedSlug] = useState<string>();
  const [editing, setEditing] = useState(false);

  const { data: categories = [], isLoading: catLoading } = useDocCategories(level);
  const { data: articles = [], isLoading: artLoading } = useDocArticles(level);
  const { data: searchResults = [] } = useDocSearch(level, search);
  const deleteArticle = useDeleteArticle();

  const displayArticles = search.length >= 2 ? searchResults : articles;
  const selectedArticle = useMemo(
    () => displayArticles.find((a) => a.slug === selectedSlug),
    [displayArticles, selectedSlug]
  );
  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedArticle?.category_id || c.id === selectedCategoryId),
    [categories, selectedArticle, selectedCategoryId]
  );

  if (categories.length > 0 && !selectedCategoryId && !search) {
    setSelectedCategoryId(categories[0].id);
  }

  if (catLoading || artLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (editing) {
    return (
      <DocArticleEditor
        article={selectedSlug ? selectedArticle : null}
        categories={categories}
        docLevel={level}
        onSaved={() => {
          setEditing(false);
          // Keep selection if editing existing
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="flex-1">
          <DocSearchBar value={search} onChange={setSearch} />
        </div>
        <Button onClick={() => { setSelectedSlug(undefined); setEditing(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nieuw artikel
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
        <div className="border rounded-lg p-4">
          {search.length >= 2 ? (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground mb-2">{searchResults.length} resultaten</p>
              {searchResults.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelectedSlug(a.slug)}
                  className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-muted"
                >
                  <p className="font-medium">{a.title}</p>
                </button>
              ))}
            </div>
          ) : (
            <DocCategoryList
              categories={categories}
              articles={articles}
              selectedCategoryId={selectedCategoryId}
              selectedArticleSlug={selectedSlug}
              onSelectCategory={(id) => {
                setSelectedCategoryId(id);
                setSelectedSlug(undefined);
              }}
              onSelectArticle={setSelectedSlug}
            />
          )}
        </div>

        <div className="border rounded-lg p-6">
          {selectedArticle ? (
            <div>
              <div className="flex gap-2 mb-4 justify-end">
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="h-3 w-3 mr-1" /> Bewerken
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="h-3 w-3 mr-1" /> Verwijderen
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Artikel verwijderen?</AlertDialogTitle>
                      <AlertDialogDescription>Dit kan niet ongedaan worden gemaakt.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuleren</AlertDialogCancel>
                      <AlertDialogAction onClick={() => {
                        deleteArticle.mutate(selectedArticle.id, {
                          onSuccess: () => {
                            toast.success('Artikel verwijderd');
                            setSelectedSlug(undefined);
                          },
                        });
                      }}>Verwijderen</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <DocArticleViewer article={selectedArticle} category={selectedCategory} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <BookOpen className="h-12 w-12 mb-4" />
              <p>Selecteer een artikel of maak een nieuw artikel aan</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PlatformDocs() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Documentatie</h1>
        <p className="text-muted-foreground">Beheer tenant- en platformdocumentatie</p>
      </div>

      <Tabs defaultValue="platform">
        <TabsList>
          <TabsTrigger value="platform">Platform Docs</TabsTrigger>
          <TabsTrigger value="tenant">Tenant Docs beheren</TabsTrigger>
        </TabsList>
        <TabsContent value="platform" className="mt-4">
          <DocsPanel level="platform" />
        </TabsContent>
        <TabsContent value="tenant" className="mt-4">
          <DocsPanel level="tenant" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
