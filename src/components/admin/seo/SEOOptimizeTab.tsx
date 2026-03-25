import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Search, Wand2, Package, FolderOpen, AlertTriangle, CheckCircle, Filter, X
} from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useSEO } from '@/hooks/useSEO';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { SEOPreviewDialog } from './SEOPreviewDialog';

interface SEOEntity {
  id: string;
  name: string;
  type: 'product' | 'category';
  meta_title: string | null;
  meta_description: string | null;
  description: string | null;
  images: string[];
  seo_score: number | null;
}

type FilterStatus = 'all' | 'missing_meta_title' | 'missing_meta_description' | 'missing_description' | 'low_score' | 'no_images';
type GenerateType = 'meta_title' | 'meta_description' | 'product_description' | 'alt_text';

export function SEOOptimizeTab() {
  const { products, isLoading: isLoadingProducts } = useProducts();
  const { categories, isLoading: isLoadingCategories } = useCategories();
  const { productScores, categoryScores } = useSEO();
  const { currentTenant } = useTenant();

  const [entityTypeFilter, setEntityTypeFilter] = useState<'all' | 'product' | 'category'>('all');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [generateType, setGenerateType] = useState<GenerateType>('meta_title');
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewData, setPreviewData] = useState<any[] | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const isLoading = isLoadingProducts || isLoadingCategories;

  // Merge products + categories into unified list
  const entities: SEOEntity[] = useMemo(() => {
    const items: SEOEntity[] = [];

    if (entityTypeFilter !== 'category') {
      for (const p of products || []) {
        const score = productScores?.find(s => s.entity_id === p.id);
        items.push({
          id: p.id,
          name: p.name,
          type: 'product',
          meta_title: p.meta_title || null,
          meta_description: p.meta_description || null,
          description: p.description || null,
          images: p.images || [],
          seo_score: score?.overall_score ?? null,
        });
      }
    }

    if (entityTypeFilter !== 'product') {
      for (const c of categories || []) {
        const score = categoryScores?.find(s => s.entity_id === c.id);
        // Use multilingual meta fields with nl fallback
        const cat = c as any;
        const metaTitle = cat.meta_title_nl || cat.meta_title_en || null;
        const metaDesc = cat.meta_description_nl || cat.meta_description_en || null;
        items.push({
          id: c.id,
          name: c.name,
          type: 'category',
          meta_title: metaTitle,
          meta_description: metaDesc,
          description: c.description || null,
          images: cat.image_url ? [cat.image_url] : [],
          seo_score: score?.overall_score ?? null,
        });
      }
    }

    return items;
  }, [products, categories, productScores, categoryScores, entityTypeFilter]);

  // Apply filters
  const filteredEntities = useMemo(() => {
    let items = entities;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(e => e.name.toLowerCase().includes(q));
    }

    switch (statusFilter) {
      case 'missing_meta_title':
        items = items.filter(e => !e.meta_title);
        break;
      case 'missing_meta_description':
        items = items.filter(e => !e.meta_description);
        break;
      case 'missing_description':
        items = items.filter(e => !e.description);
        break;
      case 'low_score':
        items = items.filter(e => e.seo_score !== null && e.seo_score < 50);
        break;
      case 'no_images':
        items = items.filter(e => e.images.length === 0);
        break;
    }

    return items;
  }, [entities, searchQuery, statusFilter]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredEntities.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEntities.map(e => e.id)));
    }
  };

  const getScoreBadge = (score: number | null) => {
    if (score === null) return <Badge variant="outline" className="text-xs">—</Badge>;
    if (score >= 80) return <Badge className="bg-green-500/10 text-green-600 text-xs">{score}</Badge>;
    if (score >= 50) return <Badge className="bg-yellow-500/10 text-yellow-600 text-xs">{score}</Badge>;
    return <Badge className="bg-red-500/10 text-red-600 text-xs">{score}</Badge>;
  };

  const handleGeneratePreview = async () => {
    if (selectedIds.size === 0) {
      toast.error('Selecteer items om te optimaliseren');
      return;
    }

    setIsGenerating(true);

    try {
      const selectedEntities = filteredEntities.filter(e => selectedIds.has(e.id));
      const productIds = selectedEntities.filter(e => e.type === 'product').map(e => e.id);
      const categoryIds = selectedEntities.filter(e => e.type === 'category').map(e => e.id);

      const allResults: any[] = [];

      // Generate for products
      if (productIds.length > 0) {
        const { data, error } = await supabase.functions.invoke('ai-generate-seo-content', {
          body: { 
            tenantId: currentTenant?.id, 
            type: generateType, 
            productIds, 
            entityType: 'product',
            preview: true 
          },
        });
        if (error) throw error;
        allResults.push(...(data?.results || []).map((r: any) => ({ ...r, entity_type: 'product' })));
      }

      // Generate for categories
      if (categoryIds.length > 0) {
        const catType = generateType === 'product_description' ? 'category_description' : generateType;
        const { data, error } = await supabase.functions.invoke('ai-generate-seo-content', {
          body: { 
            tenantId: currentTenant?.id, 
            type: catType, 
            categoryIds, 
            entityType: 'category',
            preview: true 
          },
        });
        if (error) throw error;
        allResults.push(...(data?.results || []).map((r: any) => ({ ...r, entity_type: 'category' })));
      }

      if (allResults.length === 0) {
        toast.error('Geen resultaten gegenereerd');
        return;
      }

      setPreviewData(allResults);
      setPreviewOpen(true);
    } catch (err: any) {
      if (err?.message?.includes('credits')) {
        toast.error('Onvoldoende AI credits');
      } else {
        toast.error('Genereren mislukt', { description: err?.message });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyItems = async (approvedItems: any[]) => {
    try {
      // Group by entity type
      const productItems = approvedItems.filter(i => i.entity_type === 'product');
      const categoryItems = approvedItems.filter(i => i.entity_type === 'category');

      let appliedCount = 0;

      // Apply products
      for (const item of productItems) {
        const { error } = await supabase
          .from('products')
          .update({ [item.field]: item.generated })
          .eq('id', item.entity_id);
        if (!error) appliedCount++;
      }

      // Apply categories
      for (const item of categoryItems) {
        const { error } = await supabase
          .from('categories')
          .update({ [item.field]: item.generated })
          .eq('id', item.entity_id);
        if (!error) appliedCount++;
      }

      toast.success(`${appliedCount} items bijgewerkt`);
      setPreviewOpen(false);
      setPreviewData(null);
      setSelectedIds(new Set());
    } catch {
      toast.error('Toepassen mislukt');
    }
  };

  const selectedCount = selectedIds.size;
  const filterLabels: Record<FilterStatus, string> = {
    all: 'Alle items',
    missing_meta_title: 'Zonder meta title',
    missing_meta_description: 'Zonder meta description',
    missing_description: 'Zonder beschrijving',
    low_score: 'Score < 50',
    no_images: 'Zonder afbeeldingen',
  };

  const generateLabels: Record<GenerateType, string> = {
    meta_title: 'Meta Titles',
    meta_description: 'Meta Descriptions',
    product_description: 'Beschrijvingen',
    alt_text: 'Alt-teksten',
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Zoek op naam..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={entityTypeFilter} onValueChange={(v) => setEntityTypeFilter(v as any)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alles</SelectItem>
            <SelectItem value="product">Producten</SelectItem>
            <SelectItem value="category">Categorieën</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as FilterStatus)}>
          <SelectTrigger className="w-[200px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(filterLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {statusFilter !== 'all' && (
          <Button variant="ghost" size="sm" onClick={() => setStatusFilter('all')}>
            <X className="h-4 w-4 mr-1" /> Reset
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>{filteredEntities.length} items</span>
        {selectedCount > 0 && (
          <Badge variant="secondary">{selectedCount} geselecteerd</Badge>
        )}
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="p-3 text-left w-10">
                  <Checkbox
                    checked={filteredEntities.length > 0 && selectedIds.size === filteredEntities.length}
                    onCheckedChange={toggleAll}
                  />
                </th>
                <th className="p-3 text-left text-sm font-medium text-muted-foreground">Naam</th>
                <th className="p-3 text-left text-sm font-medium text-muted-foreground hidden md:table-cell">Type</th>
                <th className="p-3 text-left text-sm font-medium text-muted-foreground hidden lg:table-cell">Meta Title</th>
                <th className="p-3 text-left text-sm font-medium text-muted-foreground hidden lg:table-cell">Meta Desc</th>
                <th className="p-3 text-left text-sm font-medium text-muted-foreground hidden md:table-cell">Beschrijving</th>
                <th className="p-3 text-center text-sm font-medium text-muted-foreground">Score</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntities.map((entity) => (
                <tr key={entity.id} className="border-b hover:bg-muted/50 transition-colors">
                  <td className="p-3">
                    <Checkbox
                      checked={selectedIds.has(entity.id)}
                      onCheckedChange={() => toggleSelect(entity.id)}
                    />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {entity.type === 'product' ? (
                        <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="font-medium text-sm truncate max-w-[200px]">{entity.name}</span>
                    </div>
                  </td>
                  <td className="p-3 hidden md:table-cell">
                    <Badge variant="outline" className="text-xs">
                      {entity.type === 'product' ? 'Product' : 'Categorie'}
                    </Badge>
                  </td>
                  <td className="p-3 hidden lg:table-cell">
                    {entity.meta_title ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    )}
                  </td>
                  <td className="p-3 hidden lg:table-cell">
                    {entity.meta_description ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    )}
                  </td>
                  <td className="p-3 hidden md:table-cell">
                    {entity.description ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    )}
                  </td>
                  <td className="p-3 text-center">
                    {getScoreBadge(entity.seo_score)}
                  </td>
                </tr>
              ))}
              {filteredEntities.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Geen items gevonden met deze filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Floating action bar */}
      {selectedCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 lg:left-[var(--sidebar-width)] bg-background/95 backdrop-blur-sm border-t shadow-lg p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between gap-4 max-w-6xl mx-auto">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="text-sm">
                {selectedCount} geselecteerd
              </Badge>
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                Deselecteer
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <Select value={generateType} onValueChange={(v) => setGenerateType(v as GenerateType)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(generateLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button onClick={handleGeneratePreview} disabled={isGenerating} className="gap-2">
                {isGenerating ? (
                  <>
                    <Wand2 className="h-4 w-4 animate-spin" />
                    Genereren...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" />
                    Genereer & Preview
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Dialog */}
      <SEOPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        items={previewData || []}
        generateType={generateType}
        onApply={handleApplyItems}
      />
    </div>
  );
}
