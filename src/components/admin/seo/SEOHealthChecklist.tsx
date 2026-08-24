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
import { useTranslation } from 'react-i18next';

interface ChecklistItem {
  id: string;
  labelKey: string;
  descriptionKey: string;
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

// Labels staan als i18n-key; `id` blijft de checklist-sleutel.
const defaultChecklist: ChecklistItem[] = [
  {
    id: 'sitemap',
    labelKey: 'admin.seo.seOHealthChecklist.checks.sitemap.label',
    descriptionKey: 'admin.seo.seOHealthChecklist.checks.sitemap.description',
    status: 'incomplete',
  },
  {
    id: 'robots',
    labelKey: 'admin.seo.seOHealthChecklist.checks.robots.label',
    descriptionKey: 'admin.seo.seOHealthChecklist.checks.robots.description',
    status: 'incomplete',
  },
  {
    id: 'meta_titles',
    labelKey: 'admin.seo.seOHealthChecklist.checks.meta_titles.label',
    descriptionKey: 'admin.seo.seOHealthChecklist.checks.meta_titles.description',
    status: 'incomplete',
  },
  {
    id: 'meta_descriptions',
    labelKey: 'admin.seo.seOHealthChecklist.checks.meta_descriptions.label',
    descriptionKey: 'admin.seo.seOHealthChecklist.checks.meta_descriptions.description',
    status: 'incomplete',
  },
  {
    id: 'alt_texts',
    labelKey: 'admin.seo.seOHealthChecklist.checks.alt_texts.label',
    descriptionKey: 'admin.seo.seOHealthChecklist.checks.alt_texts.description',
    status: 'incomplete',
  },
  {
    id: 'structured_data',
    labelKey: 'admin.seo.seOHealthChecklist.checks.structured_data.label',
    descriptionKey: 'admin.seo.seOHealthChecklist.checks.structured_data.description',
    status: 'incomplete',
  },
  {
    id: 'og_tags',
    labelKey: 'admin.seo.seOHealthChecklist.checks.og_tags.label',
    descriptionKey: 'admin.seo.seOHealthChecklist.checks.og_tags.description',
    status: 'incomplete',
  },
  {
    id: 'canonical_urls',
    labelKey: 'admin.seo.seOHealthChecklist.checks.canonical_urls.label',
    descriptionKey: 'admin.seo.seOHealthChecklist.checks.canonical_urls.description',
    status: 'incomplete',
  },
];

export function SEOHealthChecklist({ 
  items = defaultChecklist, 
  isLoading,
  onGenerateSitemap,
  isGeneratingSitemap 
}: SEOHealthChecklistProps) {
  const { t } = useTranslation();
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
              {t('admin.seo.sEOHealthChecklist.technische_seo_checklist')}
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
                      {t(item.labelKey)}
                    </span>
                    {item.count && (
                      <span className="text-xs text-muted-foreground">
                        {item.count.done}/{item.count.total}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {t(item.descriptionKey)}
                  </p>
                </div>
                {item.id === 'sitemap' && onGenerateSitemap && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSitemapDialog(true)}
                  >
                    <FileCode className="h-4 w-4 mr-1" />
                    {t('admin.seo.sEOHealthChecklist.genereer')}
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
            <DialogTitle>{t('admin.seo.sEOHealthChecklist.sitemap_genereren')}</DialogTitle>
            <DialogDescription>
              {t('admin.seo.sEOHealthChecklist.genereer_een_xml_sitemap_voor_zoekmachines')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('admin.seo.sEOHealthChecklist.website_url')}</label>
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
                    <div className="text-xs text-muted-foreground">{t('admin.seo.sEOHealthChecklist.urls')}</div>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <div className="text-lg font-bold">{sitemapResult.stats.products}</div>
                    <div className="text-xs text-muted-foreground">{t('admin.marketing.mediaAssetsLibrary.folders.producten')}</div>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <div className="text-lg font-bold">{sitemapResult.stats.categories}</div>
                    <div className="text-xs text-muted-foreground">{t('admin.marketing.mediaAssetsLibrary.folders.categorie_n')}</div>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <div className="text-lg font-bold">{sitemapResult.stats.productsWithImages}</div>
                    <div className="text-xs text-muted-foreground">{t('admin.seo.sEOHealthChecklist.met_afbeeldingen')}</div>
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
                      {t('admin.seo.sEOHealthChecklist.download')}
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
                        {t('admin.seo.sEOHealthChecklist.download')}
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
                      {t('admin.seo.sEOHealthChecklist.download')}
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
