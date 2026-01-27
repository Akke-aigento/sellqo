import { useState } from 'react';
import { Search, Loader2, FolderTree, ChevronRight, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useMarketplaceConnections } from '@/hooks/useMarketplaceConnections';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface EbayCategory {
  id: string;
  name: string;
  path: string;
  level: number;
  relevancy: string;
}

interface EbayCategorySearchProps {
  selectedCategoryId?: string;
  selectedCategoryName?: string;
  selectedCategoryPath?: string;
  onCategorySelect: (category: { id: string; name: string; path: string }) => void;
  productName?: string;
}

export function EbayCategorySearch({
  selectedCategoryId,
  selectedCategoryName,
  selectedCategoryPath,
  onCategorySelect,
  productName,
}: EbayCategorySearchProps) {
  const { currentTenant } = useTenant();
  const { getConnectionByType } = useMarketplaceConnections();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState(productName || '');
  const [isSearching, setIsSearching] = useState(false);
  const [categories, setCategories] = useState<EbayCategory[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: 'Voer een zoekterm in',
        description: 'Typ een productnaam of trefwoord om categorieën te zoeken',
        variant: 'destructive',
      });
      return;
    }

    const connection = getConnectionByType('ebay');
    if (!connection || !currentTenant) {
      toast({
        title: 'Geen eBay connectie',
        description: 'Verbind eerst je eBay account in Connect',
        variant: 'destructive',
      });
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const { data, error } = await supabase.functions.invoke('search-ebay-categories', {
        body: {
          query: searchQuery.trim(),
          tenant_id: currentTenant.id,
          connection_id: connection.id,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Zoeken mislukt');

      setCategories(data.categories || []);

      if (data.categories?.length === 0) {
        toast({
          title: 'Geen categorieën gevonden',
          description: 'Probeer een andere zoekterm',
        });
      }
    } catch (error) {
      console.error('Category search error:', error);
      toast({
        title: 'Zoeken mislukt',
        description: error instanceof Error ? error.message : 'Kon categorieën niet ophalen',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>eBay Categorie</Label>
        
        {/* Selected category display */}
        {selectedCategoryId && selectedCategoryName && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-600" />
              <span className="font-medium text-green-700 dark:text-green-400">{selectedCategoryName}</span>
              <Badge variant="outline" className="text-xs">{selectedCategoryId}</Badge>
            </div>
            {selectedCategoryPath && selectedCategoryPath !== selectedCategoryName && (
              <p className="text-xs text-muted-foreground mt-1 pl-6">{selectedCategoryPath}</p>
            )}
          </div>
        )}
        
        {/* Search input */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Zoek op productnaam of trefwoord..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-9"
            />
          </div>
          <Button 
            variant="outline" 
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
          >
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Zoeken'
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Zoek naar de beste eBay categorie op basis van je productnaam of kenmerken
        </p>
      </div>

      {/* Category results */}
      {hasSearched && !isSearching && (
        <div className="border rounded-lg">
          <div className="p-2 bg-muted/50 border-b flex items-center gap-2">
            <FolderTree className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {categories.length > 0 
                ? `${categories.length} categorie${categories.length === 1 ? '' : 'ën'} gevonden`
                : 'Geen categorieën gevonden'
              }
            </span>
          </div>
          
          {categories.length > 0 && (
            <ScrollArea className="h-[240px]">
              <div className="divide-y">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => onCategorySelect({
                      id: category.id,
                      name: category.name,
                      path: category.path,
                    })}
                    className={cn(
                      "w-full p-3 text-left hover:bg-muted/50 transition-colors",
                      selectedCategoryId === category.id && "bg-primary/10"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{category.name}</span>
                          {selectedCategoryId === category.id && (
                            <Check className="h-4 w-4 text-primary shrink-0" />
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 flex items-center flex-wrap gap-1">
                          {category.path.split(' > ').map((part, idx, arr) => (
                            <span key={idx} className="flex items-center">
                              {part}
                              {idx < arr.length - 1 && (
                                <ChevronRight className="h-3 w-3 mx-0.5 text-muted-foreground/50" />
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-xs shrink-0",
                          category.relevancy === 'HIGH' && "border-green-500 text-green-600",
                          category.relevancy === 'MEDIUM' && "border-amber-500 text-amber-600",
                          category.relevancy === 'LOW' && "border-gray-400 text-gray-500"
                        )}
                      >
                        {category.relevancy === 'HIGH' && 'Beste match'}
                        {category.relevancy === 'MEDIUM' && 'Goed'}
                        {category.relevancy === 'LOW' && 'Mogelijk'}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  );
}
