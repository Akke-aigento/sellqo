import { cn } from '@/lib/utils';
import type { DocCategory, DocArticle } from '@/hooks/useDocumentation';
import { 
  Package, ShoppingCart, Banknote, Truck, Percent, Globe, MessageSquare, HelpCircle,
  Code, BookOpen, Server, Bug, LucideIcon, FolderOpen
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  Package, ShoppingCart, Banknote, Truck, Percent, Globe, MessageSquare, HelpCircle,
  Code, BookOpen, Server, Bug, FolderOpen,
};

interface DocCategoryListProps {
  categories: DocCategory[];
  articles: DocArticle[];
  selectedCategoryId?: string;
  selectedArticleSlug?: string;
  onSelectCategory: (id: string) => void;
  onSelectArticle: (slug: string) => void;
}

export function DocCategoryList({
  categories, articles, selectedCategoryId, selectedArticleSlug,
  onSelectCategory, onSelectArticle,
}: DocCategoryListProps) {
  return (
    <nav className="space-y-1">
      {categories.map((cat) => {
        const Icon = iconMap[cat.icon || ''] || FolderOpen;
        const catArticles = articles.filter((a) => a.category_id === cat.id);
        const isOpen = selectedCategoryId === cat.id;

        return (
          <div key={cat.id}>
            <button
              onClick={() => onSelectCategory(cat.id)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors text-left',
                isOpen ? 'bg-accent text-accent-foreground font-medium' : 'hover:bg-muted'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{cat.title}</span>
              <span className="ml-auto text-xs text-muted-foreground">{catArticles.length}</span>
            </button>
            {isOpen && catArticles.length > 0 && (
              <div className="ml-6 mt-1 space-y-0.5">
                {catArticles.map((article) => (
                  <button
                    key={article.id}
                    onClick={() => onSelectArticle(article.slug)}
                    className={cn(
                      'w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors',
                      selectedArticleSlug === article.slug
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    )}
                  >
                    {article.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
