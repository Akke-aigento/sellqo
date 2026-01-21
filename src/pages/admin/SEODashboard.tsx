import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Search, 
  RefreshCw, 
  Wand2, 
  TrendingUp, 
  AlertTriangle,
  Bot,
  FileCode,
  Globe,
  FolderOpen,
  Image as ImageIcon,
  Link2,
  Gauge,
  Users,
  Calendar,
} from 'lucide-react';
import { SEOScoreCard } from '@/components/admin/seo/SEOScoreCard';
import { SEOQuickWins } from '@/components/admin/seo/SEOQuickWins';
import { SEOHealthChecklist } from '@/components/admin/seo/SEOHealthChecklist';
import { SEOProductTable } from '@/components/admin/seo/SEOProductTable';
import { SEOCategoryTable } from '@/components/admin/seo/SEOCategoryTable';
import { SEOScoreHistoryChart } from '@/components/admin/seo/SEOScoreHistoryChart';
import { SocialMediaPreview } from '@/components/admin/seo/SocialMediaPreview';
import { StructuredDataPreview } from '@/components/admin/seo/StructuredDataPreview';
import { KeywordResearchPanel } from '@/components/admin/seo/KeywordResearchPanel';
import { ImageAltTextPanel } from '@/components/admin/seo/ImageAltTextPanel';
import { RobotsTxtEditor } from '@/components/admin/seo/RobotsTxtEditor';
import { AISearchOptimizer } from '@/components/admin/seo/AISearchOptimizer';
import { SlugManager } from '@/components/admin/seo/SlugManager';
import { SEOTranslationStatus } from '@/components/admin/seo/SEOTranslationStatus';
import { CoreWebVitalsPanel } from '@/components/admin/seo/CoreWebVitalsPanel';
import { CompetitorAnalysisPanel } from '@/components/admin/seo/CompetitorAnalysisPanel';
import { SearchConsolePanel } from '@/components/admin/seo/SearchConsolePanel';
import { ScheduledAuditsPanel } from '@/components/admin/seo/ScheduledAuditsPanel';
import { FeatureGate } from '@/components/FeatureGate';
import { useSEO } from '@/hooks/useSEO';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';
import type { ProductStructuredData, BusinessStructuredData } from '@/lib/structuredData';

export default function SEODashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const { 
    tenantScore, 
    productScores,
    keywords,
    history,
    quickWins,
    productsNeedingAttention,
    isLoading,
    analyzeSEO,
    isAnalyzing,
    generateContent,
    isGenerating,
    generateSitemap,
    isGeneratingSitemap,
    addKeyword,
    deleteKeyword,
  } = useSEO();
  const { products, isLoading: isLoadingProducts } = useProducts();
  const { categories, isLoading: isLoadingCategories } = useCategories();
  const { currentTenant } = useTenant();

  // Merge category data with SEO scores
  const categoriesWithSEO = categories?.map((category) => ({
    ...category,
    seo_score: productScores?.find((s) => s.entity_type === 'category' && s.entity_id === category.id) || null,
  })) || [];

  // Merge product data with SEO scores
  const productsWithSEO = products?.map((product) => ({
    ...product,
    images: product.images || [],
    seo_score: productScores?.find((s) => s.entity_id === product.id) || null,
  })) || [];

  // Convert products to structured data format
  const structuredProducts: ProductStructuredData[] = products?.map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    compareAtPrice: product.compare_at_price,
    sku: product.sku,
    images: product.images || [],
    category: null,
    inStock: (product.stock ?? 0) > 0,
    brand: null,
    rating: null,
    reviewCount: null,
  })) || [];

  // Business data for structured data
  const businessData: BusinessStructuredData | undefined = currentTenant ? {
    name: currentTenant.name,
    description: null,
    url: window.location.origin,
    logo: null,
    address: currentTenant.address ? {
      street: currentTenant.address,
      city: currentTenant.city || undefined,
      postalCode: currentTenant.postal_code || undefined,
      country: currentTenant.country || undefined,
    } : undefined,
    phone: currentTenant.phone,
    email: null,
    vatNumber: currentTenant.btw_number || null,
  } : undefined;

  // Calculate health checklist items based on products
  const totalProducts = products?.length || 0;
  const productsWithMeta = products?.filter((p) => p.meta_title).length || 0;
  const productsWithDesc = products?.filter((p) => p.meta_description).length || 0;
  const productsWithImages = products?.filter((p) => p.images && p.images.length > 0).length || 0;

  const getStatus = (done: number, total: number): 'complete' | 'partial' | 'incomplete' => {
    if (total === 0) return 'incomplete';
    if (done === total) return 'complete';
    if (done > 0) return 'partial';
    return 'incomplete';
  };

  const healthItems = [
    {
      id: 'meta_titles',
      label: 'Meta Titles',
      description: 'Alle producten hebben een meta title',
      status: getStatus(productsWithMeta, totalProducts),
      count: { done: productsWithMeta, total: totalProducts },
    },
    {
      id: 'meta_descriptions',
      label: 'Meta Descriptions',
      description: 'Alle producten hebben een meta description',
      status: getStatus(productsWithDesc, totalProducts),
      count: { done: productsWithDesc, total: totalProducts },
    },
    {
      id: 'product_images',
      label: 'Product Afbeeldingen',
      description: 'Alle producten hebben afbeeldingen',
      status: getStatus(productsWithImages, totalProducts),
      count: { done: productsWithImages, total: totalProducts },
    },
    {
      id: 'structured_data',
      label: 'Structured Data',
      description: 'JSON-LD Product schema aanwezig',
      status: 'incomplete' as const,
    },
    {
      id: 'sitemap',
      label: 'Sitemap.xml',
      description: 'Dynamische sitemap met alle producten',
      status: 'incomplete' as const,
    },
    {
      id: 'robots',
      label: 'Robots.txt',
      description: 'Geconfigureerd voor zoekmachines',
      status: 'incomplete' as const,
    },
  ];

  const handleAction = (action: string, entityId?: string) => {
    if (action === 'generate_meta') {
      generateContent({ type: 'meta_title', productIds: entityId ? [entityId] : [] });
    }
    toast.info(`Actie: ${action}`);
  };

  const handleGenerateContent = (type: string, productIds: string[]) => {
    generateContent({ 
      type: type as any, 
      productIds 
    });
  };

  const handleGenerateCategoryContent = (type: string, categoryIds: string[]) => {
    generateContent({ 
      type: type as any, 
      productIds: [],
      categoryIds,
      entityType: 'category'
    } as any);
  };

  const handleGenerateAltText = (productIds: string[]) => {
    generateContent({
      type: 'alt_text',
      productIds,
    });
  };

  // Get previous score from history
  const previousScore = history && history.length > 1 ? history[1]?.overall_score : null;

  return (
    <FeatureGate feature="ai_marketing">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600">
                <Search className="h-5 w-5 text-white" />
              </div>
              SEO Optimalisatie
            </h1>
            <p className="text-muted-foreground">
              Verbeter je vindbaarheid in Google en AI-zoekmachines
            </p>
          </div>
          <Button 
            onClick={() => analyzeSEO()} 
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Analyseren...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4 mr-2" />
                Nieuwe Analyse
              </>
            )}
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {tenantScore?.overall_score ?? '-'}
                  </p>
                  <p className="text-sm text-muted-foreground">SEO Score</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-yellow-500/10">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{productsNeedingAttention}</p>
                  <p className="text-sm text-muted-foreground">Aandacht nodig</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-blue-500/10">
                  <Bot className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {tenantScore?.ai_search_score ?? '-'}
                  </p>
                  <p className="text-sm text-muted-foreground">AI Search Score</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-green-500/10">
                  <FileCode className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {tenantScore?.technical_score ?? '-'}
                  </p>
                  <p className="text-sm text-muted-foreground">Technisch</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="overview">Overzicht</TabsTrigger>
            <TabsTrigger value="keywords">Keywords</TabsTrigger>
            <TabsTrigger value="products">Producten</TabsTrigger>
            <TabsTrigger value="categories">Categorieën</TabsTrigger>
            <TabsTrigger value="images">Afbeeldingen</TabsTrigger>
            <TabsTrigger value="social">Social</TabsTrigger>
            <TabsTrigger value="technical">Technisch</TabsTrigger>
            <TabsTrigger value="ai-search">AI Zoeken</TabsTrigger>
            <TabsTrigger value="vitals" className="gap-1">
              <Gauge className="h-3 w-3" />
              Web Vitals
            </TabsTrigger>
            <TabsTrigger value="competitors" className="gap-1">
              <Users className="h-3 w-3" />
              Concurrenten
            </TabsTrigger>
            <TabsTrigger value="search-console" className="gap-1">
              <Globe className="h-3 w-3" />
              Search Console
            </TabsTrigger>
            <TabsTrigger value="audits" className="gap-1">
              <Calendar className="h-3 w-3" />
              Audits
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <SEOScoreCard
                overallScore={tenantScore?.overall_score ?? null}
                metaScore={tenantScore?.meta_score ?? null}
                contentScore={tenantScore?.content_score ?? null}
                technicalScore={tenantScore?.technical_score ?? null}
                aiSearchScore={tenantScore?.ai_search_score ?? null}
                previousScore={previousScore}
                isLoading={isLoading}
              />
              <SEOScoreHistoryChart
                history={history || []}
                isLoading={isLoading}
              />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <SEOQuickWins
                issues={tenantScore?.issues || []}
                suggestions={tenantScore?.suggestions || []}
                onAction={handleAction}
                isLoading={isLoading}
              />
              <SEOHealthChecklist 
                items={healthItems} 
                isLoading={isLoading}
                onGenerateSitemap={generateSitemap}
                isGeneratingSitemap={isGeneratingSitemap}
              />
            </div>
          </TabsContent>

          <TabsContent value="keywords" className="mt-6">
            <KeywordResearchPanel
              keywords={keywords || []}
              onAddKeyword={addKeyword}
              onDeleteKeyword={deleteKeyword}
              isLoading={isLoading}
            />
          </TabsContent>

          <TabsContent value="products" className="mt-6">
            <SEOProductTable
              products={productsWithSEO}
              isLoading={isLoadingProducts}
              onGenerateContent={handleGenerateContent}
              isGenerating={isGenerating}
            />
          </TabsContent>

          <TabsContent value="categories" className="mt-6">
            <SEOCategoryTable
              categories={categoriesWithSEO}
              isLoading={isLoadingCategories}
              onGenerateContent={handleGenerateCategoryContent}
              isGenerating={isGenerating}
            />
          </TabsContent>

          <TabsContent value="images" className="mt-6">
            <ImageAltTextPanel
              products={products || []}
              isLoading={isLoadingProducts}
              onGenerateAltText={handleGenerateAltText}
              isGenerating={isGenerating}
            />
          </TabsContent>

          <TabsContent value="social" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <SocialMediaPreview
                title={currentTenant?.name || 'Jouw Webshop'}
                description={'Ontdek onze producten en aanbiedingen'}
                url={window.location.origin}
                isLoading={isLoading}
              />
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FolderOpen className="h-5 w-5" />
                    Social Media Tips
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Optimaliseer je content voor betere social media shares.
                  </p>
                  <div className="space-y-2">
                    <div className="p-3 rounded-lg border">
                      <h4 className="font-medium text-sm">Open Graph Tags</h4>
                      <p className="text-xs text-muted-foreground">
                        Essentieel voor Facebook, LinkedIn en andere platforms.
                      </p>
                    </div>
                    <div className="p-3 rounded-lg border">
                      <h4 className="font-medium text-sm">Twitter Cards</h4>
                      <p className="text-xs text-muted-foreground">
                        Speciale meta tags voor betere Twitter previews.
                      </p>
                    </div>
                    <div className="p-3 rounded-lg border">
                      <h4 className="font-medium text-sm">Afbeelding Optimalisatie</h4>
                      <p className="text-xs text-muted-foreground">
                        Gebruik 1200x630px voor optimale weergave.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="technical" className="mt-6 space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <RobotsTxtEditor baseUrl={window.location.origin} />
              <StructuredDataPreview
                products={structuredProducts}
                business={businessData}
                baseUrl={window.location.origin}
              />
            </div>
            <SlugManager
              products={products || []}
              categories={categories || []}
              isLoading={isLoadingProducts || isLoadingCategories}
            />
          </TabsContent>

          <TabsContent value="ai-search" className="mt-6">
            <AISearchOptimizer
              aiSearchScore={tenantScore?.ai_search_score ?? null}
              products={products || []}
              isLoading={isLoading}
              onGenerateFAQ={(productIds) => {
                toast.info('FAQ generatie wordt binnenkort toegevoegd');
              }}
              onGenerateLongForm={(productIds) => {
                generateContent({
                  type: 'product_description',
                  productIds,
                });
              }}
              isGenerating={isGenerating}
            />
          </TabsContent>

          <TabsContent value="vitals" className="mt-6">
            <CoreWebVitalsPanel />
          </TabsContent>

          <TabsContent value="competitors" className="mt-6">
            <CompetitorAnalysisPanel />
          </TabsContent>

          <TabsContent value="search-console" className="mt-6">
            <SearchConsolePanel />
          </TabsContent>

          <TabsContent value="audits" className="mt-6">
            <ScheduledAuditsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </FeatureGate>
  );
}
