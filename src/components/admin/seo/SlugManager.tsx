import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Link2,
  Wand2,
  Check,
  AlertCircle,
  Search,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SlugItem {
  id: string;
  name: string;
  currentSlug: string | null;
  suggestedSlug: string;
  hasConflict: boolean;
  entityType: 'product' | 'category';
}

interface SlugManagerProps {
  products: Array<{
    id: string;
    name: string;
    slug?: string | null;
  }>;
  categories: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  isLoading?: boolean;
  onUpdateSlugs?: (updates: Array<{ id: string; slug: string; entityType: string }>) => void;
  isUpdating?: boolean;
}

// Generate SEO-friendly slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ñ]/g, 'n')
    .replace(/[ç]/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

export function SlugManager({
  products,
  categories,
  isLoading,
  onUpdateSlugs,
  isUpdating,
}: SlugManagerProps) {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'missing' | 'suboptimal'>('all');

  // Combine products and categories
  const allSlugs = [...products, ...categories].map((item) => ({
    id: item.id,
    name: item.name,
    currentSlug: item.slug || null,
    suggestedSlug: generateSlug(item.name),
    hasConflict: false, // Would check against existing slugs in real implementation
    entityType: 'slug' in item && typeof item.slug === 'string' && categories.some(c => c.id === item.id) 
      ? 'category' as const 
      : 'product' as const,
  }));

  // Check for conflicts
  const slugCounts = new Map<string, number>();
  allSlugs.forEach((item) => {
    const slug = item.currentSlug || item.suggestedSlug;
    slugCounts.set(slug, (slugCounts.get(slug) || 0) + 1);
  });
  
  const items: SlugItem[] = allSlugs.map((item) => ({
    ...item,
    hasConflict: (slugCounts.get(item.currentSlug || item.suggestedSlug) || 0) > 1,
  }));

  // Filter items
  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    if (filter === 'missing') return matchesSearch && !item.currentSlug;
    if (filter === 'suboptimal') return matchesSearch && item.currentSlug !== item.suggestedSlug;
    return matchesSearch;
  });

  // Stats
  const missingCount = items.filter((item) => !item.currentSlug).length;
  const suboptimalCount = items.filter((item) => item.currentSlug && item.currentSlug !== item.suggestedSlug).length;
  const conflictCount = items.filter((item) => item.hasConflict).length;

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((item) => item.id)));
    }
  };

  const handleApplySuggested = () => {
    const updates = filteredItems
      .filter((item) => selectedIds.has(item.id))
      .map((item) => ({
        id: item.id,
        slug: item.suggestedSlug,
        entityType: item.entityType,
      }));
    onUpdateSlugs?.(updates);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full mb-4" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              URL/Slug Manager
            </CardTitle>
            <CardDescription>
              Optimaliseer je URL-structuur voor betere SEO
            </CardDescription>
          </div>
          {selectedIds.size > 0 && (
            <Button onClick={handleApplySuggested} disabled={isUpdating}>
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Bijwerken...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Pas suggesties toe ({selectedIds.size})
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="flex flex-wrap gap-4">
          {missingCount > 0 && (
            <Badge variant="destructive">
              <AlertCircle className="mr-1 h-3 w-3" />
              {missingCount} ontbrekend
            </Badge>
          )}
          {suboptimalCount > 0 && (
            <Badge variant="secondary">
              {suboptimalCount} te optimaliseren
            </Badge>
          )}
          {conflictCount > 0 && (
            <Badge variant="destructive">
              {conflictCount} conflicten
            </Badge>
          )}
          {missingCount === 0 && suboptimalCount === 0 && conflictCount === 0 && (
            <Badge variant="default" className="bg-green-500">
              <Check className="mr-1 h-3 w-3" />
              Alles geoptimaliseerd
            </Badge>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Zoeken..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              Alle
            </Button>
            <Button
              variant={filter === 'missing' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('missing')}
            >
              Ontbrekend
            </Button>
            <Button
              variant={filter === 'suboptimal' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('suboptimal')}
            >
              Suboptimaal
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedIds.size === filteredItems.length && filteredItems.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Naam</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Huidige URL</TableHead>
                <TableHead></TableHead>
                <TableHead>Suggestie</TableHead>
                <TableHead className="w-24">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Geen items gevonden
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.slice(0, 50).map((item) => {
                  const isOptimal = item.currentSlug === item.suggestedSlug;
                  
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          onCheckedChange={() => toggleSelect(item.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {item.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {item.entityType === 'product' ? 'Product' : 'Categorie'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {item.currentSlug ? (
                          <span className={cn(
                            item.hasConflict && 'text-destructive'
                          )}>
                            /{item.currentSlug}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="w-8">
                        {!isOptimal && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {!isOptimal && (
                          <span className="text-green-600">/{item.suggestedSlug}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.hasConflict ? (
                          <Badge variant="destructive">Conflict</Badge>
                        ) : isOptimal ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Badge variant="secondary">Te optimaliseren</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {filteredItems.length > 50 && (
          <p className="text-sm text-muted-foreground text-center">
            Toont 50 van {filteredItems.length} items
          </p>
        )}
      </CardContent>
    </Card>
  );
}
