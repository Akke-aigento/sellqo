import type { DocArticle, DocCategory } from '@/hooks/useDocumentation';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

interface DocArticleViewerProps {
  article: DocArticle;
  category?: DocCategory;
}

export function DocArticleViewer({ article, category }: DocArticleViewerProps) {
  return (
    <article className="max-w-3xl">
      {category && (
        <p className="text-sm text-muted-foreground mb-2">{category.title}</p>
      )}
      <h1 className="text-2xl font-bold mb-2">{article.title}</h1>
      {article.excerpt && (
        <p className="text-muted-foreground mb-4">{article.excerpt}</p>
      )}
      {article.tags && article.tags.length > 0 && (
        <div className="flex gap-1 mb-4 flex-wrap">
          {article.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
          ))}
        </div>
      )}
      <div
        className="prose prose-sm max-w-none dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: article.content }}
      />
      <p className="text-xs text-muted-foreground mt-8 border-t pt-4">
        Laatst bijgewerkt: {format(new Date(article.updated_at), 'd MMMM yyyy', { locale: nl })}
      </p>
    </article>
  );
}
