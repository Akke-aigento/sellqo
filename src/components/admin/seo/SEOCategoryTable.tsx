import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  FolderOpen, Search, Wand2, MoreHorizontal, ExternalLink,
  AlertCircle, CheckCircle2, ArrowUp, ArrowDown, Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SEOScoreBadge, getRowHighlight } from './SEOScoreBadge';
import type { SEOScore } from '@/types/seo';

interface CategoryWithSEO {
  id: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  image_url?: string | null;
  seo_score: SEOScore | null;
}

interface SEOCategoryTableProps {
  categories: CategoryWithSEO[];
  isLoading?: boolean;
  onGenerateContent: (type: string, categoryIds: string[]) => void;
  isGenerating?: boolean;
}

type SortDir = 'asc' | 'desc';

export function SEOCategoryTable({
  categories, isLoading, onGenerateContent, isGenerating,
}: SEOCategoryTableProps) {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const filteredCategories = useMemo(() => {
    const filtered = categories.filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase())
    );
    return filtered.sort((a, b) => {
      const scoreA = a.seo_score?.overall_score ?? -1;
      const scoreB = b.seo_score?.overall_score ?? -1;
      return sortDir === 'asc' ? scoreA - scoreB : scoreB - scoreA;
    });
  }, [categories, search, sortDir]);

  const poorItems = useMemo(() => 
    filteredCategories.filter(c => {
      const s = c.seo_score?.overall_score;
      return s === null || s === undefined || s < 70;
    }), [filteredCategories]);

  const toggleSort = () => setSortDir(d => d === 'asc' ? 'desc' : 'asc');

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    newSet.has(id) ? newSet.delete(id) : newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    setSelectedIds(
      selectedIds.size === filteredCategories.length
        ? new Set()
        : new Set(filteredCategories.map((c) => c.id))
    );
  };

  const handleBulkGenerate = (type: string) => {
    onGenerateContent(type, Array.from(selectedIds));
  };

  const handleOptimizeAllPoor = () => {
    setSelectedIds(new Set(poorItems.map(c => c.id)));
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full mb-4" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Categorie SEO Status
          </CardTitle>
          <div className="flex items-center gap-2">
            {poorItems.length > 0 && (
              <Button size="sm" variant="outline" onClick={handleOptimizeAllPoor} className="text-orange-600 border-orange-300 hover:bg-orange-50">
                <Zap className="h-4 w-4 mr-1" />
                Selecteer zwakke ({poorItems.length})
              </Button>
            )}
            {selectedIds.size > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" disabled={isGenerating}>
                    <Wand2 className="h-4 w-4 mr-2" />
                    Genereer ({selectedIds.size})
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleBulkGenerate('meta_title')}>Meta Titles genereren</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkGenerate('meta_description')}>Meta Descriptions genereren</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkGenerate('category_description')}>Beschrijvingen optimaliseren</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Zoek categorieën..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedIds.size === filteredCategories.length && filteredCategories.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Categorie</TableHead>
                <TableHead className="w-28">
                  <Button variant="ghost" size="sm" onClick={toggleSort} className="h-auto p-0 font-medium hover:bg-transparent">
                    Score
                    {sortDir === 'asc' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />}
                  </Button>
                </TableHead>
                <TableHead className="w-32">Meta Title</TableHead>
                <TableHead className="w-32">Meta Desc</TableHead>
                <TableHead className="w-24">Afbeelding</TableHead>
                <TableHead className="w-24">Issues</TableHead>
                <TableHead className="w-36"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCategories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Geen categorieën gevonden</TableCell>
                </TableRow>
              ) : (
                filteredCategories.map((category) => {
                  const score = category.seo_score?.overall_score ?? null;
                  const issues = category.seo_score?.issues?.length ?? 0;
                  const hasMeta = !!category.meta_title;
                  const hasDesc = !!category.meta_description;
                  const hasImage = !!category.image_url;
                  const needsOptimization = score === null || score < 70;

                  return (
                    <TableRow key={category.id} className={getRowHighlight(score)}>
                      <TableCell>
                        <Checkbox checked={selectedIds.has(category.id)} onCheckedChange={() => toggleSelect(category.id)} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {category.image_url ? (
                            <img src={category.image_url} alt="" className="w-10 h-10 rounded object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                              <FolderOpen className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <span className="font-medium truncate max-w-[200px]">{category.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <SEOScoreBadge score={score} />
                      </TableCell>
                      <TableCell>
                        {hasMeta ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <AlertCircle className="h-4 w-4 text-muted-foreground" />}
                      </TableCell>
                      <TableCell>
                        {hasDesc ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <AlertCircle className="h-4 w-4 text-muted-foreground" />}
                      </TableCell>
                      <TableCell>
                        {hasImage ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <AlertCircle className="h-4 w-4 text-muted-foreground" />}
                      </TableCell>
                      <TableCell>
                        {issues > 0 ? <Badge variant="secondary">{issues}</Badge> : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {needsOptimization && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="sm"
                                  variant={score !== null && score < 50 ? 'destructive' : 'outline'}
                                  className="h-7 text-xs"
                                  disabled={isGenerating}
                                >
                                  <Wand2 className="h-3 w-3 mr-1" />
                                  Optimaliseer
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => onGenerateContent('meta_title', [category.id])}>Meta Title genereren</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onGenerateContent('meta_description', [category.id])}>Meta Description genereren</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onGenerateContent('category_description', [category.id])}>Beschrijving optimaliseren</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onGenerateContent('meta_title', [category.id])}>
                                <Wand2 className="h-4 w-4 mr-2" />Genereer Meta Title
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onGenerateContent('meta_description', [category.id])}>
                                <Wand2 className="h-4 w-4 mr-2" />Genereer Meta Description
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onGenerateContent('category_description', [category.id])}>
                                <Wand2 className="h-4 w-4 mr-2" />Optimaliseer Beschrijving
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <ExternalLink className="h-4 w-4 mr-2" />Bekijk categorie
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
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
