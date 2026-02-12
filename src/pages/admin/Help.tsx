import { useState, useMemo } from 'react';
import { useDocCategories, useDocArticles, useDocSearch } from '@/hooks/useDocumentation';
import { DocSearchBar } from '@/components/admin/docs/DocSearchBar';
import { DocCategoryList } from '@/components/admin/docs/DocCategoryList';
import { DocArticleViewer } from '@/components/admin/docs/DocArticleViewer';
import { Loader2, BookOpen } from 'lucide-react';

export default function Help() {
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>();
  const [selectedSlug, setSelectedSlug] = useState<string>();

  const { data: categories = [], isLoading: catLoading } = useDocCategories('tenant');
  const { data: articles = [], isLoading: artLoading } = useDocArticles('tenant');
  const { data: searchResults = [] } = useDocSearch('tenant', search);

  const displayArticles = search.length >= 2 ? searchResults : articles;
  const selectedArticle = useMemo(
    () => displayArticles.find((a) => a.slug === selectedSlug),
    [displayArticles, selectedSlug]
  );
  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedArticle?.category_id || c.id === selectedCategoryId),
    [categories, selectedArticle, selectedCategoryId]
  );

  // Auto-select first category
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Helpcenter</h1>
        <p className="text-muted-foreground">Vind antwoorden op je vragen</p>
      </div>

      <DocSearchBar value={search} onChange={setSearch} />

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
        {/* Sidebar */}
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
                  {a.excerpt && <p className="text-xs text-muted-foreground truncate">{a.excerpt}</p>}
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

        {/* Content */}
        <div className="border rounded-lg p-6">
          {selectedArticle ? (
            <DocArticleViewer article={selectedArticle} category={selectedCategory} />
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <BookOpen className="h-12 w-12 mb-4" />
              <p>Selecteer een artikel om te lezen</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
