import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, XCircle, Circle, ClipboardCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  status: 'complete' | 'incomplete' | 'partial';
  count?: { done: number; total: number };
}

interface SEOHealthChecklistProps {
  items: ChecklistItem[];
  isLoading?: boolean;
}

const defaultChecklist: ChecklistItem[] = [
  {
    id: 'sitemap',
    label: 'Sitemap.xml',
    description: 'Dynamische sitemap met alle producten',
    status: 'incomplete',
  },
  {
    id: 'robots',
    label: 'Robots.txt',
    description: 'Geconfigureerd voor zoekmachines',
    status: 'incomplete',
  },
  {
    id: 'meta_titles',
    label: 'Meta Titles',
    description: 'Alle producten hebben een meta title',
    status: 'incomplete',
  },
  {
    id: 'meta_descriptions',
    label: 'Meta Descriptions',
    description: 'Alle producten hebben een meta description',
    status: 'incomplete',
  },
  {
    id: 'alt_texts',
    label: 'Alt Teksten',
    description: 'Alle afbeeldingen hebben alt tekst',
    status: 'incomplete',
  },
  {
    id: 'structured_data',
    label: 'Structured Data',
    description: 'JSON-LD Product schema aanwezig',
    status: 'incomplete',
  },
  {
    id: 'og_tags',
    label: 'Open Graph Tags',
    description: 'Social media sharing geoptimaliseerd',
    status: 'incomplete',
  },
  {
    id: 'canonical_urls',
    label: 'Canonical URLs',
    description: 'Duplicate content voorkomen',
    status: 'incomplete',
  },
];

export function SEOHealthChecklist({ items = defaultChecklist, isLoading }: SEOHealthChecklistProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const completedCount = items.filter((item) => item.status === 'complete').length;
  const partialCount = items.filter((item) => item.status === 'partial').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Technische SEO Checklist
          </div>
          <span className="text-sm font-normal text-muted-foreground">
            {completedCount}/{items.length} voltooid
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                item.status === 'complete' && 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900',
                item.status === 'partial' && 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900',
                item.status === 'incomplete' && 'bg-muted/30'
              )}
            >
              {item.status === 'complete' ? (
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
              ) : item.status === 'partial' ? (
                <Circle className="h-5 w-5 text-yellow-500 shrink-0" />
              ) : (
                <XCircle className="h-5 w-5 text-muted-foreground shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={cn(
                    'font-medium text-sm',
                    item.status === 'complete' && 'text-green-700 dark:text-green-400'
                  )}>
                    {item.label}
                  </span>
                  {item.count && (
                    <span className="text-xs text-muted-foreground">
                      {item.count.done}/{item.count.total}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
