import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils';

interface SearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId?: string;
  basePath: string;
  currency?: string;
}

interface SearchResult {
  id: string;
  name: string;
  slug: string;
  price: number;
  images: string[];
}

export function SearchModal({ open, onOpenChange, tenantId, basePath, currency = 'EUR' }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.length < 2 || !tenantId) {
      setResults([]);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, slug, price, images')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .ilike('name', `%${query}%`)
        .limit(8);
      setResults((data as SearchResult[]) || []);
      setLoading(false);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, tenantId]);

  const goToProduct = (slug: string) => {
    navigate(`${basePath}/product/${slug}`);
    onOpenChange(false);
  };

  const goToSearch = () => {
    if (query.trim()) {
      navigate(`${basePath}/products?q=${encodeURIComponent(query.trim())}`);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-6 py-4 border-b">
          <Search className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && goToSearch()}
            placeholder="Waar ben je naar op zoek?"
            className="flex-1 bg-transparent text-lg outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {loading && (
            <div className="px-6 py-8 text-center text-muted-foreground">Zoeken...</div>
          )}

          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="px-6 py-8 text-center">
              <p className="text-muted-foreground">Geen producten gevonden voor "{query}"</p>
              <p className="text-sm text-muted-foreground mt-1">Probeer een andere zoekterm</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="divide-y">
              {results.map((product) => (
                <button
                  key={product.id}
                  onClick={() => goToProduct(product.slug)}
                  className="w-full flex items-center gap-4 px-6 py-3 hover:bg-muted/50 transition-colors text-left"
                >
                  {product.images?.[0] ? (
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      <img src={product.images[0]} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-muted flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{product.name}</p>
                    <p className="text-sm text-muted-foreground">{formatCurrency(product.price, currency)}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))}

              {/* View all */}
              <button onClick={goToSearch} className="w-full px-6 py-3 text-sm font-medium text-primary hover:bg-muted/50 transition-colors text-center">
                Bekijk alle resultaten voor "{query}"
              </button>
            </div>
          )}

          {!query && (
            <div className="px-6 py-8 text-center text-muted-foreground text-sm">
              Typ minimaal 2 tekens om te zoeken
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
