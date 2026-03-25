import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Search, RefreshCw, Wand2, TrendingUp, AlertTriangle, Bot, FileCode, Globe,
  Gauge, Users, Calendar, Image as ImageIcon, FolderOpen, Package, Target,
  Zap, CheckCircle, ArrowRight, Sparkles, Settings2, BarChart3,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { SEOScoreCard } from '@/components/admin/seo/SEOScoreCard';
import { SEOQuickWins } from '@/components/admin/seo/SEOQuickWins';
import { SEOHealthChecklist } from '@/components/admin/seo/SEOHealthChecklist';
import { SEOScoreHistoryChart } from '@/components/admin/seo/SEOScoreHistoryChart';
import { SocialMediaPreview } from '@/components/admin/seo/SocialMediaPreview';
import { StructuredDataPreview } from '@/components/admin/seo/StructuredDataPreview';
import { KeywordResearchPanel } from '@/components/admin/seo/KeywordResearchPanel';
import { ImageAltTextPanel } from '@/components/admin/seo/ImageAltTextPanel';
import { RobotsTxtEditor } from '@/components/admin/seo/RobotsTxtEditor';
import { AISearchOptimizer } from '@/components/admin/seo/AISearchOptimizer';
import { SlugManager } from '@/components/admin/seo/SlugManager';
import { CoreWebVitalsPanel } from '@/components/admin/seo/CoreWebVitalsPanel';
import { CompetitorAnalysisPanel } from '@/components/admin/seo/CompetitorAnalysisPanel';
import { SearchConsolePanel } from '@/components/admin/seo/SearchConsolePanel';
import { ScheduledAuditsPanel } from '@/components/admin/seo/ScheduledAuditsPanel';
import { SEOOptimizeTab } from '@/components/admin/seo/SEOOptimizeTab';
import { FeatureGate } from '@/components/FeatureGate';
import { useSEO } from '@/hooks/useSEO';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';
import type { ProductStructuredData, BusinessStructuredData } from '@/lib/structuredData';

export default function SEODashboard() {
  const { 
    tenantScore, productScores, keywords, history, quickWins, productsNeedingAttention,
    isLoading, analyzeSEO, isAnalyzing, generateContent, isGenerating,
    generateSitemap, isGeneratingSitemap, addKeyword, deleteKeyword,
  } = useSEO();
  const { products, isLoading: isLoadingProducts } = useProducts();
  const { categories, isLoading: isLoadingCategories } = useCategories();
  const { currentTenant } = useTenant();

  const [activeTab, setActiveTab] = useState('overview');

  // Health metrics
  const totalProducts = products?.length || 0;
  const productsWithMeta = products?.filter(p => p.meta_title).length || 0;
  const productsWithDesc = products?.filter(p => p.meta_description).length || 0;
  const productsWithImages = products?.filter(p => p.images && p.images.length > 0).length || 0;

  // Client-side quick wins (no analysis needed)
  const clientSideIssues = (() => {
    const issues: Array<{ type: string; severity: 'error' | 'warning' | 'info'; message: string; field?: string; entity_id?: string; entity_name?: string }> = [];
    
    for (const p of products || []) {
      if (!p.meta_title) issues.push({ type: 'meta_title_missing', severity: 'warning', message: `Meta title ontbreekt`, entity_id: p.id, entity_name: p.name });
      if (!p.meta_description) issues.push({ type: 'meta_description_missing', severity: 'warning', message: `Meta description ontbreekt`, entity_id: p.id, entity_name: p.name });
      if (!p.description) issues.push({ type: 'description_missing', severity: 'error', message: `Beschrijving ontbreekt`, entity_id: p.id, entity_name: p.name });
    }
    
    return issues;
  })();

  const clientSideSuggestions = (() => {
    const suggestions: Array<{ type: string; priority: 'high' | 'medium' | 'low'; title: string; description: string; action?: string; estimated_impact?: number }> = [];
    const missingTitles = (products || []).filter(p => !p.meta_title).length;
    const missingDescs = (products || []).filter(p => !p.meta_description).length;
    const missingContent = (products || []).filter(p => !p.description).length;

    if (missingTitles > 0) suggestions.push({ type: 'fix_meta_titles', priority: 'high', title: `${missingTitles} producten zonder meta title`, description: 'Ga naar Optimaliseer en genereer meta titles met AI.', action: 'navigate_optimize' });
    if (missingDescs > 0) suggestions.push({ type: 'fix_meta_descriptions', priority: 'high', title: `${missingDescs} producten zonder meta description`, description: 'Meta descriptions verhogen je click-through rate in zoekresultaten.', action: 'navigate_optimize' });
    if (missingContent > 0) suggestions.push({ type: 'fix_descriptions', priority: 'medium', title: `${missingContent} producten zonder beschrijving`, description: 'Content is de basis van SEO. Voeg beschrijvingen toe of laat AI ze genereren.', action: 'navigate_optimize' });

    return suggestions;
  })();

  const activeIssues = tenantScore?.issues?.length ? tenantScore.issues : clientSideIssues;
  const activeSuggestions = tenantScore?.suggestions?.length ? tenantScore.suggestions : clientSideSuggestions;

  const getStatus = (done: number, total: number): 'complete' | 'partial' | 'incomplete' => {
    if (total === 0) return 'incomplete';
    if (done === total) return 'complete';
    if (done > 0) return 'partial';
    return 'incomplete';
  };

  const healthItems = [
    { id: 'meta_titles', label: 'Meta Titles', description: 'Alle producten hebben een meta title', status: getStatus(productsWithMeta, totalProducts), count: { done: productsWithMeta, total: totalProducts } },
    { id: 'meta_descriptions', label: 'Meta Descriptions', description: 'Alle producten hebben een meta description', status: getStatus(productsWithDesc, totalProducts), count: { done: productsWithDesc, total: totalProducts } },
    { id: 'product_images', label: 'Product Afbeeldingen', description: 'Alle producten hebben afbeeldingen', status: getStatus(productsWithImages, totalProducts), count: { done: productsWithImages, total: totalProducts } },
    { id: 'structured_data', label: 'Structured Data', description: 'JSON-LD Product schema aanwezig', status: 'incomplete' as const },
    { id: 'sitemap', label: 'Sitemap.xml', description: 'Dynamische sitemap met alle producten', status: 'incomplete' as const },
    { id: 'robots', label: 'Robots.txt', description: 'Geconfigureerd voor zoekmachines', status: 'incomplete' as const },
  ];

  const structuredProducts: ProductStructuredData[] = products?.map(product => ({
    id: product.id, name: product.name, description: product.description,
    price: product.price, compareAtPrice: product.compare_at_price,
    sku: product.sku, images: product.images || [], category: null,
    inStock: (product.stock ?? 0) > 0, brand: null, rating: null, reviewCount: null,
  })) || [];

  const businessData: BusinessStructuredData | undefined = currentTenant ? {
    name: currentTenant.name, description: null, url: window.location.origin,
    logo: null, address: currentTenant.address ? {
      street: currentTenant.address, city: currentTenant.city || undefined,
      postalCode: currentTenant.postal_code || undefined, country: currentTenant.country || undefined,
    } : undefined, phone: currentTenant.phone, email: null,
    vatNumber: currentTenant.btw_number || null,
  } : undefined;

  const overallScore = tenantScore?.overall_score ?? 0;
  const scoreColor = overallScore >= 80 ? 'text-green-500' : overallScore >= 50 ? 'text-yellow-500' : 'text-red-500';

  return (
    <FeatureGate feature="ai_marketing">
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 flex-shrink-0">
                <svg className="w-20 h-20 -rotate-90">
                  <circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="8" fill="none" className="text-muted/30" />
                  <circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="8" fill="none"
                    strokeDasharray={`${overallScore * 2.136} 213.6`}
                    className={scoreColor}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-2xl font-bold ${scoreColor}`}>{overallScore || '--'}</span>
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">SEO Dashboard</h1>
                <p className="text-muted-foreground">
                  {overallScore >= 80 ? 'Uitstekend! Je SEO is goed op orde.' : overallScore >= 50 ? 'Er zijn verbeterpunten voor je SEO.' : 'Start met de quick wins hieronder.'}
                </p>
                {productsNeedingAttention > 0 && (
                  <div className="flex items-center gap-2 mt-1">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm text-yellow-600">{productsNeedingAttention} producten hebben aandacht nodig</span>
                  </div>
                )}
              </div>
            </div>
            <Button onClick={() => analyzeSEO()} disabled={isAnalyzing} size="lg" className="gap-2">
              {isAnalyzing ? (<><RefreshCw className="h-4 w-4 animate-spin" />Analyseren...</>) : (<><Sparkles className="h-4 w-4" />AI Analyse starten</>)}
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="p-3 rounded-lg bg-background/60 backdrop-blur">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><TrendingUp className="h-4 w-4" />Meta Score</div>
              <p className="text-xl font-bold">{tenantScore?.meta_score ?? '--'}</p>
            </div>
            <div className="p-3 rounded-lg bg-background/60 backdrop-blur">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><FileCode className="h-4 w-4" />Technisch</div>
              <p className="text-xl font-bold">{tenantScore?.technical_score ?? '--'}</p>
            </div>
            <div className="p-3 rounded-lg bg-background/60 backdrop-blur">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><Bot className="h-4 w-4" />AI Search</div>
              <p className="text-xl font-bold">{tenantScore?.ai_search_score ?? '--'}</p>
            </div>
            <div className="p-3 rounded-lg bg-background/60 backdrop-blur">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><Package className="h-4 w-4" />Producten</div>
              <p className="text-xl font-bold">{totalProducts}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start">
            <TabsTrigger value="overview" className="gap-2"><Zap className="h-4 w-4" />Overzicht</TabsTrigger>
            <TabsTrigger value="optimize" className="gap-2"><Wand2 className="h-4 w-4" />Optimaliseer</TabsTrigger>
            <TabsTrigger value="technical" className="gap-2"><FileCode className="h-4 w-4" />Technisch</TabsTrigger>
            <TabsTrigger value="keywords" className="gap-2"><Target className="h-4 w-4" />Keywords</TabsTrigger>
          </TabsList>

          {/* Tab 1: Overzicht */}
          <TabsContent value="overview" className="space-y-6">
            {/* Quick Wins */}
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  <CardTitle>Quick Wins</CardTitle>
                </div>
                <CardDescription>De belangrijkste verbeterpunten</CardDescription>
              </CardHeader>
              <CardContent>
                <SEOQuickWins
                  issues={activeIssues}
                  suggestions={activeSuggestions}
                  onAction={(action) => {
                    if (action === 'navigate_optimize' || action === 'generate_meta_titles' || action === 'generate_meta_descriptions') {
                      setActiveTab('optimize');
                    } else {
                      toast.info(`Actie: ${action}`);
                    }
                  }}
                  isLoading={isLoading && isLoadingProducts}
                />
              </CardContent>
            </Card>

            {/* Health Checklist */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><CheckCircle className="h-5 w-5" />SEO Checklist</CardTitle>
              </CardHeader>
              <CardContent>
                <SEOHealthChecklist
                  items={healthItems}
                  isLoading={isLoading}
                  onGenerateSitemap={generateSitemap}
                  isGeneratingSitemap={isGeneratingSitemap}
                />
              </CardContent>
            </Card>

            {/* Score History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />Score Geschiedenis</CardTitle>
              </CardHeader>
              <CardContent>
                <SEOScoreHistoryChart history={history || []} isLoading={isLoading} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: Optimaliseer */}
          <TabsContent value="optimize">
            <SEOOptimizeTab />
          </TabsContent>

          {/* Tab 3: Technisch */}
          <TabsContent value="technical" className="space-y-6">
            <CoreWebVitalsPanel />
            <div className="grid gap-6 lg:grid-cols-2">
              <RobotsTxtEditor baseUrl={window.location.origin} />
              <StructuredDataPreview products={structuredProducts} business={businessData} baseUrl={window.location.origin} />
            </div>
            <SlugManager products={products || []} categories={categories || []} isLoading={isLoadingProducts || isLoadingCategories} />
          </TabsContent>

          {/* Tab 4: Keywords */}
          <TabsContent value="keywords" className="space-y-6">
            <KeywordResearchPanel keywords={keywords || []} onAddKeyword={addKeyword} onDeleteKeyword={deleteKeyword} isLoading={isLoading} />
            <CompetitorAnalysisPanel />
            <AISearchOptimizer
              aiSearchScore={tenantScore?.ai_search_score ?? null}
              products={products || []}
              isLoading={isLoading}
              onGenerateFAQ={() => toast.info('FAQ generatie wordt binnenkort toegevoegd')}
              onGenerateLongForm={(productIds) => generateContent({ type: 'product_description', productIds })}
              isGenerating={isGenerating}
            />
            <SearchConsolePanel />
            <ScheduledAuditsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </FeatureGate>
  );
}
