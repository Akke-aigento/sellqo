import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Search, 
  RefreshCw, 
  Wand2, 
  TrendingUp, 
  AlertTriangle,
  Bot,
  FileCode,
  Globe,
  ChevronDown,
  ChevronRight,
  Gauge,
  Users,
  Calendar,
  Image as ImageIcon,
  FolderOpen,
  Package,
  Target,
  Zap,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Settings2,
  BarChart3,
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

interface SectionCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

function SectionCard({ title, description, icon: Icon, children, defaultOpen = false, badge, badgeVariant = 'secondary' }: SectionCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{title}</CardTitle>
                    {badge && (
                      <Badge variant={badgeVariant} className="text-xs">
                        {badge}
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-sm">{description}</CardDescription>
                </div>
              </div>
              {isOpen ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-6">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export default function SEODashboard() {
  const { 
    tenantScore, 
    productScores,
    categoryScores,
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

  // Merge data with SEO scores
  const categoriesWithSEO = categories?.map((category) => ({
    ...category,
    seo_score: categoryScores?.find((s) => s.entity_id === category.id) || null,
  })) || [];

  const productsWithSEO = products?.map((product) => ({
    ...product,
    images: product.images || [],
    seo_score: productScores?.find((s) => s.entity_id === product.id) || null,
  })) || [];

  // Structured data
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

  // Health metrics
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
    { id: 'meta_titles', label: 'Meta Titles', description: 'Alle producten hebben een meta title', status: getStatus(productsWithMeta, totalProducts), count: { done: productsWithMeta, total: totalProducts } },
    { id: 'meta_descriptions', label: 'Meta Descriptions', description: 'Alle producten hebben een meta description', status: getStatus(productsWithDesc, totalProducts), count: { done: productsWithDesc, total: totalProducts } },
    { id: 'product_images', label: 'Product Afbeeldingen', description: 'Alle producten hebben afbeeldingen', status: getStatus(productsWithImages, totalProducts), count: { done: productsWithImages, total: totalProducts } },
    { id: 'structured_data', label: 'Structured Data', description: 'JSON-LD Product schema aanwezig', status: 'incomplete' as const },
    { id: 'sitemap', label: 'Sitemap.xml', description: 'Dynamische sitemap met alle producten', status: 'incomplete' as const },
    { id: 'robots', label: 'Robots.txt', description: 'Geconfigureerd voor zoekmachines', status: 'incomplete' as const },
  ];

  const handleGenerateContent = (type: string, productIds: string[]) => {
    generateContent({ type: type as any, productIds });
  };

  const handleGenerateCategoryContent = (type: string, categoryIds: string[]) => {
    generateContent({ type: type as any, productIds: [], categoryIds, entityType: 'category' } as any);
  };

  const previousScore = history && history.length > 1 ? history[1]?.overall_score : null;
  const overallScore = tenantScore?.overall_score ?? 0;
  const scoreColor = overallScore >= 80 ? 'text-green-500' : overallScore >= 50 ? 'text-yellow-500' : 'text-red-500';

  return (
    <FeatureGate feature="ai_marketing">
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Score Circle */}
              <div className="relative w-20 h-20 flex-shrink-0">
                <svg className="w-20 h-20 -rotate-90">
                  <circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="8" fill="none" className="text-muted/30" />
                  <circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="8" fill="none"
                    strokeDasharray={`${overallScore * 2.136} 213.6`}
                    className={scoreColor}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <span className={`text-2xl font-bold ${scoreColor}`}>{overallScore || '--'}</span>
                </div>
              </div>
              
              <div>
                <h1 className="text-2xl font-bold tracking-tight">SEO Dashboard</h1>
                <p className="text-muted-foreground">
                  {overallScore >= 80 
                    ? 'Uitstekend! Je SEO is goed op orde.' 
                    : overallScore >= 50 
                    ? 'Er zijn verbeterpunten voor je SEO.'
                    : 'Start met de quick wins hieronder.'}
                </p>
                {productsNeedingAttention > 0 && (
                  <div className="flex items-center gap-2 mt-1">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm text-yellow-600">{productsNeedingAttention} producten hebben aandacht nodig</span>
                  </div>
                )}
              </div>
            </div>
            
            <Button 
              onClick={() => analyzeSEO()} 
              disabled={isAnalyzing}
              size="lg"
              className="gap-2"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Analyseren...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  AI Analyse starten
                </>
              )}
            </Button>
          </div>

          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            {[
              { label: 'Meta Score', icon: TrendingUp, value: tenantScore?.meta_score },
              { label: 'Technisch', icon: FileCode, value: tenantScore?.technical_score },
              { label: 'AI Search', icon: Bot, value: tenantScore?.ai_search_score },
              { label: 'Content', icon: Package, value: tenantScore?.content_score },
            ].map(({ label, icon: StatIcon, value }) => {
              const color = value == null ? '' : value >= 70 ? 'text-green-600' : value >= 50 ? 'text-orange-500' : 'text-destructive';
              return (
                <div key={label} className="p-3 rounded-lg bg-background/60 backdrop-blur">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <StatIcon className="h-4 w-4" />
                    {label}
                  </div>
                  <p className={`text-xl font-bold ${color}`}>{value ?? '--'}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Priority Section: Quick Wins */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <CardTitle>Start hier: Quick Wins</CardTitle>
            </div>
            <CardDescription>
              De belangrijkste verbeterpunten om je SEO score snel te verhogen
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SEOQuickWins
              issues={tenantScore?.issues || []}
              suggestions={tenantScore?.suggestions || []}
              onAction={(action, entityId) => {
                const productIds = entityId ? [entityId] : [];
                switch (action) {
                  case 'generate_meta_title':
                  case 'generate_meta':
                    generateContent({ type: 'meta_title', productIds });
                    break;
                  case 'generate_meta_description':
                    generateContent({ type: 'meta_description', productIds });
                    break;
                  case 'generate_description':
                  case 'improve_content':
                    generateContent({ type: 'product_description', productIds });
                    break;
                  case 'optimize_categories':
                    toast.info('Ga naar Categorie SEO hieronder om te optimaliseren');
                    break;
                  case 'generate_faq':
                    toast.info('FAQ generatie wordt binnenkort beschikbaar');
                    break;
                  case 'view_product':
                    if (entityId) {
                      window.open(`/admin/products/${entityId}`, '_blank');
                    }
                    break;
                  default:
                    toast.info(`Actie: ${action}`);
                }
              }}
              isLoading={isLoading}
            />
          </CardContent>
        </Card>

        {/* Main Content Sections */}
        <div className="space-y-4">
          {/* Content Optimalisatie */}
          <SectionCard
            title="Content Optimalisatie"
            description="Optimaliseer meta tags, beschrijvingen en afbeeldingen"
            icon={Package}
            defaultOpen={true}
            badge={`${productsWithMeta}/${totalProducts} compleet`}
            badgeVariant={productsWithMeta === totalProducts ? 'default' : 'secondary'}
          >
            <div className="space-y-6">
              <SEOHealthChecklist 
                items={healthItems} 
                isLoading={isLoading}
                onGenerateSitemap={generateSitemap}
                isGeneratingSitemap={isGeneratingSitemap}
              />
              
              <div className="border-t pt-6">
                <h4 className="font-medium mb-4 flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Product SEO
                </h4>
                <SEOProductTable
                  products={productsWithSEO}
                  isLoading={isLoadingProducts}
                  onGenerateContent={handleGenerateContent}
                  isGenerating={isGenerating}
                />
              </div>

              <div className="border-t pt-6">
                <h4 className="font-medium mb-4 flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" />
                  Categorie SEO
                </h4>
                <SEOCategoryTable
                  categories={categoriesWithSEO}
                  isLoading={isLoadingCategories}
                  onGenerateContent={handleGenerateCategoryContent}
                  isGenerating={isGenerating}
                />
              </div>

              <div className="border-t pt-6">
                <h4 className="font-medium mb-4 flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Afbeelding Alt-teksten
                </h4>
                <ImageAltTextPanel
                  products={products || []}
                  isLoading={isLoadingProducts}
                  onGenerateAltText={(productIds) => generateContent({ type: 'alt_text', productIds })}
                  isGenerating={isGenerating}
                />
              </div>
            </div>
          </SectionCard>

          {/* Technische SEO */}
          <SectionCard
            title="Technische SEO"
            description="Web Vitals, Structured Data, Robots.txt en Sitemap"
            icon={FileCode}
            badge={`Score: ${tenantScore?.technical_score ?? '--'}`}
          >
            <div className="space-y-6">
              <CoreWebVitalsPanel />
              
              <div className="border-t pt-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  <RobotsTxtEditor baseUrl={window.location.origin} />
                  <StructuredDataPreview
                    products={structuredProducts}
                    business={businessData}
                    baseUrl={window.location.origin}
                  />
                </div>
              </div>

              <div className="border-t pt-6">
                <SlugManager
                  products={products || []}
                  categories={categories || []}
                  isLoading={isLoadingProducts || isLoadingCategories}
                />
              </div>
            </div>
          </SectionCard>

          {/* AI & Zoekprestaties */}
          <SectionCard
            title="AI & Zoekprestaties"
            description="AI Search optimalisatie en Google Search Console"
            icon={Bot}
            badge={`AI Score: ${tenantScore?.ai_search_score ?? '--'}`}
          >
            <div className="space-y-6">
              <AISearchOptimizer
                aiSearchScore={tenantScore?.ai_search_score ?? null}
                products={products || []}
                isLoading={isLoading}
                onGenerateFAQ={(productIds) => {
                  toast.info('FAQ generatie wordt binnenkort toegevoegd');
                }}
                onGenerateLongForm={(productIds) => {
                  generateContent({ type: 'product_description', productIds });
                }}
                isGenerating={isGenerating}
              />
              
              <div className="border-t pt-6">
                <SearchConsolePanel />
              </div>
            </div>
          </SectionCard>

          {/* Geavanceerde Tools */}
          <SectionCard
            title="Geavanceerde Tools"
            description="Keyword research, concurrent analyse en automatische audits"
            icon={Settings2}
          >
            <div className="space-y-6">
              <div>
                <h4 className="font-medium mb-4 flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Keywords
                </h4>
                <KeywordResearchPanel
                  keywords={keywords || []}
                  onAddKeyword={addKeyword}
                  onDeleteKeyword={deleteKeyword}
                  isLoading={isLoading}
                />
              </div>

              <div className="border-t pt-6">
                <h4 className="font-medium mb-4 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Concurrent Analyse
                </h4>
                <CompetitorAnalysisPanel />
              </div>

              <div className="border-t pt-6">
                <h4 className="font-medium mb-4 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Automatische Audits
                </h4>
                <ScheduledAuditsPanel />
              </div>
            </div>
          </SectionCard>

          {/* Score Geschiedenis */}
          <SectionCard
            title="Score Geschiedenis"
            description="Bekijk de ontwikkeling van je SEO score over tijd"
            icon={BarChart3}
          >
            <SEOScoreHistoryChart
              history={history || []}
              isLoading={isLoading}
            />
          </SectionCard>
        </div>
      </div>
    </FeatureGate>
  );
}
