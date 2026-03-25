import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Search, RefreshCw, Wand2, TrendingUp, AlertTriangle, Bot, FileCode, Globe,
  Gauge, Users, Calendar, Image as ImageIcon, FolderOpen, Package, Target,
  Zap, CheckCircle, ArrowRight, Sparkles, Settings2, BarChart3, Rocket,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
import { AnimatedCounter } from '@/components/admin/marketing/AnimatedCounter';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
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
  const [scoreAnimated, setScoreAnimated] = useState(false);

  const totalProducts = products?.length || 0;
  const totalCategories = categories?.length || 0;
  const productsWithMeta = products?.filter(p => p.meta_title).length || 0;
  const productsWithDesc = products?.filter(p => p.meta_description).length || 0;
  const productsWithImages = products?.filter(p => p.images && p.images.length > 0).length || 0;
  const missingMetaTitles = (products || []).filter(p => !p.meta_title).length;
  const missingMetaDescs = (products || []).filter(p => !p.meta_description).length;
  const missingDescriptions = (products || []).filter(p => !p.description).length;
  const totalMissing = missingMetaTitles + missingMetaDescs + missingDescriptions;

  useEffect(() => {
    const timer = setTimeout(() => setScoreAnimated(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Client-side quick wins
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
    if (missingMetaTitles > 0) suggestions.push({ type: 'fix_meta_titles', priority: 'high', title: `${missingMetaTitles} producten zonder meta title`, description: 'Genereer meta titles met AI voor betere zoekresultaten.', action: 'navigate_optimize', estimated_impact: 15 });
    if (missingMetaDescs > 0) suggestions.push({ type: 'fix_meta_descriptions', priority: 'high', title: `${missingMetaDescs} producten zonder meta description`, description: 'Meta descriptions verhogen je click-through rate.', action: 'navigate_optimize', estimated_impact: 12 });
    if (missingDescriptions > 0) suggestions.push({ type: 'fix_descriptions', priority: 'medium', title: `${missingDescriptions} producten zonder beschrijving`, description: 'Content is de basis van SEO. Laat AI beschrijvingen genereren.', action: 'navigate_optimize', estimated_impact: 20 });
    return suggestions;
  })();

  const activeIssues = tenantScore?.issues?.length ? tenantScore.issues : clientSideIssues;
  const activeSuggestions = tenantScore?.suggestions?.length ? tenantScore.suggestions : clientSideSuggestions;

  const overallScore = tenantScore?.overall_score ?? 0;
  const scoreGradient = overallScore >= 80
    ? 'from-green-500/20 via-emerald-500/10 to-transparent'
    : overallScore >= 50
      ? 'from-yellow-500/20 via-amber-500/10 to-transparent'
      : 'from-red-500/20 via-orange-500/10 to-transparent';

  const scoreStrokeColor = overallScore >= 80 ? 'text-green-500' : overallScore >= 50 ? 'text-yellow-500' : 'text-red-500';
  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference - (circumference * (scoreAnimated ? overallScore : 0)) / 100;

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

  const metaCompletionPct = totalProducts > 0 ? Math.round((productsWithMeta / totalProducts) * 100) : 0;
  const descCompletionPct = totalProducts > 0 ? Math.round((productsWithDesc / totalProducts) * 100) : 0;

  return (
    <FeatureGate feature="ai_marketing">
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* ── Hero Header ── */}
        <div className={cn(
          "relative overflow-hidden rounded-2xl border bg-gradient-to-br p-8",
          scoreGradient
        )}>
          {/* Decorative blobs */}
          <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-accent/5 blur-3xl" />

          <div className="relative flex flex-col lg:flex-row items-start lg:items-center gap-8">
            {/* Animated Score Ring */}
            <div className="relative w-32 h-32 flex-shrink-0">
              <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="54" stroke="hsl(var(--muted))" strokeWidth="10" fill="none" opacity="0.3" />
                <circle
                  cx="60" cy="60" r="54"
                  stroke="currentColor"
                  strokeWidth="10"
                  fill="none"
                  strokeLinecap="round"
                  className={cn(scoreStrokeColor, "transition-all duration-1000 ease-out")}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn("text-4xl font-black tabular-nums", scoreStrokeColor)}>
                  {overallScore || '—'}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Score</span>
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 space-y-3">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">SEO Dashboard</h1>
                <p className="text-muted-foreground mt-1">
                  {overallScore >= 80 ? '🎉 Uitstekend! Je SEO is goed op orde.' : overallScore >= 50 ? '⚡ Er zijn verbeterpunten — gebruik de optimizer.' : totalMissing > 0 ? `🔧 ${totalMissing} items missen SEO data — klik "Alles optimaliseren" om te starten.` : 'Start een AI analyse om je score te berekenen.'}
                </p>
              </div>

              {/* Mini sub-scores */}
              <div className="flex flex-wrap gap-4">
                {[
                  { label: 'Meta', score: tenantScore?.meta_score, icon: FileCode },
                  { label: 'Content', score: tenantScore?.content_score, icon: Search },
                  { label: 'Technisch', score: tenantScore?.technical_score, icon: Gauge },
                  { label: 'AI Search', score: tenantScore?.ai_search_score, icon: Bot },
                ].map(({ label, score, icon: Icon }) => (
                  <div key={label} className="flex items-center gap-2 text-sm">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">{label}</span>
                    <span className={cn("font-bold", score != null && score >= 70 ? 'text-green-600' : score != null && score >= 40 ? 'text-yellow-600' : 'text-muted-foreground')}>
                      {score ?? '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA buttons */}
            <div className="flex flex-col gap-2 shrink-0">
              <Button
                onClick={() => { setActiveTab('optimize'); }}
                size="lg"
                className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg shadow-accent/25"
                disabled={totalMissing === 0}
              >
                <Rocket className="h-4 w-4" />
                Alles optimaliseren
                {totalMissing > 0 && (
                  <Badge variant="secondary" className="ml-1 bg-white/20 text-accent-foreground text-xs">
                    {totalMissing}
                  </Badge>
                )}
              </Button>
              <Button
                onClick={() => analyzeSEO()}
                disabled={isAnalyzing}
                size="lg"
                variant="outline"
                className="gap-2 bg-background/60 backdrop-blur"
              >
                {isAnalyzing ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" />Analyseren...</>
                ) : (
                  <><Sparkles className="h-4 w-4" />AI Analyse starten</>
                )}
              </Button>
            </div>
          </div>

          {/* Stats bar */}
          <div className="relative grid grid-cols-2 md:grid-cols-4 gap-3 mt-8">
            {[
              { label: 'Producten', value: totalProducts, icon: Package },
              { label: 'Categorieën', value: totalCategories, icon: FolderOpen },
              { label: 'Zonder meta title', value: missingMetaTitles, icon: AlertTriangle, alert: missingMetaTitles > 0 },
              { label: 'Zonder beschrijving', value: missingDescriptions, icon: AlertTriangle, alert: missingDescriptions > 0 },
            ].map(({ label, value, icon: Icon, alert }) => (
              <div key={label} className={cn(
                "flex items-center gap-3 p-3 rounded-xl border bg-background/70 backdrop-blur-sm transition-colors",
                alert && "border-yellow-500/30 bg-yellow-500/5"
              )}>
                <Icon className={cn("h-4 w-4 shrink-0", alert ? "text-yellow-500" : "text-muted-foreground")} />
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-lg font-bold">
                    <AnimatedCounter value={value} duration={800} />
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tabs ── */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start">
            <TabsTrigger value="overview" className="gap-2"><Zap className="h-4 w-4" />Overzicht</TabsTrigger>
            <TabsTrigger value="optimize" className="gap-2"><Wand2 className="h-4 w-4" />Optimaliseer</TabsTrigger>
            <TabsTrigger value="technical" className="gap-2"><FileCode className="h-4 w-4" />Technisch</TabsTrigger>
            <TabsTrigger value="keywords" className="gap-2"><Target className="h-4 w-4" />Keywords</TabsTrigger>
          </TabsList>

          {/* Tab 1: Overzicht */}
          <TabsContent value="overview" className="space-y-6">
            {/* Completion progress */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Meta Titles</span>
                    <span className="text-sm text-muted-foreground">{productsWithMeta}/{totalProducts}</span>
                  </div>
                  <Progress value={metaCompletionPct} className="h-3" />
                  <p className="text-xs text-muted-foreground mt-1">{metaCompletionPct}% compleet</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Meta Descriptions</span>
                    <span className="text-sm text-muted-foreground">{productsWithDesc}/{totalProducts}</span>
                  </div>
                  <Progress value={descCompletionPct} className="h-3" />
                  <p className="text-xs text-muted-foreground mt-1">{descCompletionPct}% compleet</p>
                </CardContent>
              </Card>
            </div>

            {/* Quick Wins */}
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
