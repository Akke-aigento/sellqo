import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { CheckCircle2, XCircle, Circle, ClipboardCheck, Download, FileCode, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  onGenerateSitemap?: (baseUrl: string) => Promise<{
    sitemap: string;
    imageSitemap: string;
    sitemapIndex: string;
    stats: { totalUrls: number; products: number; categories: number; productsWithImages: number };
  }>;
  isGeneratingSitemap?: boolean;
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

export function SEOHealthChecklist({ 
  items = defaultChecklist, 
  isLoading,
  onGenerateSitemap,
  isGeneratingSitemap 
}: SEOHealthChecklistProps) {
  const [sitemapDialog, setSitemapDialog] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [sitemapResult, setSitemapResult] = useState<{
    sitemap: string;
    imageSitemap: string;
    sitemapIndex: string;
    stats: { totalUrls: number; products: number; categories: number; productsWithImages: number };
  } | null>(null);

  const handleGenerateSitemap = async () => {
    if (!baseUrl || !onGenerateSitemap) return;
    const result = await onGenerateSitemap(baseUrl);
    setSitemapResult(result);
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

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

  return (
    <>
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
                {item.id === 'sitemap' && onGenerateSitemap && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSitemapDialog(true)}
                  >
                    <FileCode className="h-4 w-4 mr-1" />
                    Genereer
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={sitemapDialog} onOpenChange={setSitemapDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sitemap Genereren</DialogTitle>
            <DialogDescription>
              Genereer een XML sitemap voor zoekmachines met al je producten en categorieën.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Website URL</label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://jouw-webshop.nl"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                />
                <Button 
                  onClick={handleGenerateSitemap} 
                  disabled={!baseUrl || isGeneratingSitemap}
                >
                  {isGeneratingSitemap ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Genereer'
                  )}
                </Button>
              </div>
            </div>

            {sitemapResult && (
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2 bg-muted rounded">
                    <div className="text-lg font-bold">{sitemapResult.stats.totalUrls}</div>
                    <div className="text-xs text-muted-foreground">URLs</div>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <div className="text-lg font-bold">{sitemapResult.stats.products}</div>
                    <div className="text-xs text-muted-foreground">Producten</div>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <div className="text-lg font-bold">{sitemapResult.stats.categories}</div>
                    <div className="text-xs text-muted-foreground">Categorieën</div>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <div className="text-lg font-bold">{sitemapResult.stats.productsWithImages}</div>
                    <div className="text-xs text-muted-foreground">Met afbeeldingen</div>
                  </div>
                </div>

                <Tabs defaultValue="sitemap" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="sitemap">sitemap.xml</TabsTrigger>
                    <TabsTrigger value="images">sitemap-images.xml</TabsTrigger>
                    <TabsTrigger value="index">sitemap-index.xml</TabsTrigger>
                  </TabsList>
                  <TabsContent value="sitemap">
                    <ScrollArea className="h-64 border rounded-md">
                      <pre className="p-4 text-xs">{sitemapResult.sitemap}</pre>
                    </ScrollArea>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => downloadFile(sitemapResult.sitemap, 'sitemap.xml')}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                  </TabsContent>
                  <TabsContent value="images">
                    <ScrollArea className="h-64 border rounded-md">
                      <pre className="p-4 text-xs">{sitemapResult.imageSitemap || 'Geen afbeeldingen gevonden'}</pre>
                    </ScrollArea>
                    {sitemapResult.imageSitemap && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => downloadFile(sitemapResult.imageSitemap, 'sitemap-images.xml')}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                    )}
                  </TabsContent>
                  <TabsContent value="index">
                    <ScrollArea className="h-64 border rounded-md">
                      <pre className="p-4 text-xs">{sitemapResult.sitemapIndex}</pre>
                    </ScrollArea>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => downloadFile(sitemapResult.sitemapIndex, 'sitemap-index.xml')}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
