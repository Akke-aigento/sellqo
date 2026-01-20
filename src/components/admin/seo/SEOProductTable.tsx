import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Package, 
  Search, 
  Wand2, 
  MoreHorizontal,
  ExternalLink,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getScoreColor, getScoreLabel } from '@/types/seo';
import type { SEOScore } from '@/types/seo';

interface ProductWithSEO {
  id: string;
  name: string;
  slug?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  images: string[];
  seo_score: SEOScore | null;
}

interface SEOProductTableProps {
  products: ProductWithSEO[];
  isLoading?: boolean;
  onGenerateContent: (type: string, productIds: string[]) => void;
  isGenerating?: boolean;
}

export function SEOProductTable({
  products,
  isLoading,
  onGenerateContent,
  isGenerating,
}: SEOProductTableProps) {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

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
    if (selectedIds.size === filteredProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map((p) => p.id)));
    }
  };

  const handleBulkGenerate = (type: string) => {
    onGenerateContent(type, Array.from(selectedIds));
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
              <Skeleton key={i} className="h-16 w-full" />
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
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Product SEO Status
          </CardTitle>
          {selectedIds.size > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" disabled={isGenerating}>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Genereer ({selectedIds.size})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleBulkGenerate('meta_title')}>
                  Meta Titles genereren
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkGenerate('meta_description')}>
                  Meta Descriptions genereren
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkGenerate('alt_text')}>
                  Alt Teksten genereren
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkGenerate('product_description')}>
                  Beschrijvingen optimaliseren
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Zoek producten..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedIds.size === filteredProducts.length && filteredProducts.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="w-24">Score</TableHead>
                <TableHead className="w-32">Meta Title</TableHead>
                <TableHead className="w-32">Meta Desc</TableHead>
                <TableHead className="w-24">Issues</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Geen producten gevonden
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((product) => {
                  const score = product.seo_score?.overall_score ?? null;
                  const issues = product.seo_score?.issues?.length ?? 0;
                  const hasMeta = !!product.meta_title;
                  const hasDesc = !!product.meta_description;

                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(product.id)}
                          onCheckedChange={() => toggleSelect(product.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {product.images?.[0] ? (
                            <img
                              src={product.images[0]}
                              alt=""
                              className="w-10 h-10 rounded object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                              <Package className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <span className="font-medium truncate max-w-[200px]">
                            {product.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={cn('font-semibold', getScoreColor(score))}>
                          {score !== null ? score : '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {hasMeta ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell>
                        {hasDesc ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell>
                        {issues > 0 ? (
                          <Badge variant="secondary">{issues}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => onGenerateContent('meta_title', [product.id])}
                            >
                              <Wand2 className="h-4 w-4 mr-2" />
                              Genereer Meta Title
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onGenerateContent('meta_description', [product.id])}
                            >
                              <Wand2 className="h-4 w-4 mr-2" />
                              Genereer Meta Description
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Bekijk product
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
