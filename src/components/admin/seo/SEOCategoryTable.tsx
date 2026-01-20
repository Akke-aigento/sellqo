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
  FolderOpen, 
  Search, 
  Wand2, 
  MoreHorizontal,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getScoreColor } from '@/types/seo';
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

export function SEOCategoryTable({
  categories,
  isLoading,
  onGenerateContent,
  isGenerating,
}: SEOCategoryTableProps) {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
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
    if (selectedIds.size === filteredCategories.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCategories.map((c) => c.id)));
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
            <FolderOpen className="h-5 w-5" />
            Categorie SEO Status
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
                <DropdownMenuItem onClick={() => handleBulkGenerate('category_description')}>
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
            placeholder="Zoek categorieën..."
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
                    checked={selectedIds.size === filteredCategories.length && filteredCategories.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Categorie</TableHead>
                <TableHead className="w-24">Score</TableHead>
                <TableHead className="w-32">Meta Title</TableHead>
                <TableHead className="w-32">Meta Desc</TableHead>
                <TableHead className="w-24">Afbeelding</TableHead>
                <TableHead className="w-24">Issues</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCategories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Geen categorieën gevonden
                  </TableCell>
                </TableRow>
              ) : (
                filteredCategories.map((category) => {
                  const score = category.seo_score?.overall_score ?? null;
                  const issues = category.seo_score?.issues?.length ?? 0;
                  const hasMeta = !!category.meta_title;
                  const hasDesc = !!category.meta_description;
                  const hasImage = !!category.image_url;

                  return (
                    <TableRow key={category.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(category.id)}
                          onCheckedChange={() => toggleSelect(category.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {category.image_url ? (
                            <img
                              src={category.image_url}
                              alt=""
                              className="w-10 h-10 rounded object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                              <FolderOpen className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <span className="font-medium truncate max-w-[200px]">
                            {category.name}
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
                        {hasImage ? (
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
                              onClick={() => onGenerateContent('meta_title', [category.id])}
                            >
                              <Wand2 className="h-4 w-4 mr-2" />
                              Genereer Meta Title
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onGenerateContent('meta_description', [category.id])}
                            >
                              <Wand2 className="h-4 w-4 mr-2" />
                              Genereer Meta Description
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onGenerateContent('category_description', [category.id])}
                            >
                              <Wand2 className="h-4 w-4 mr-2" />
                              Optimaliseer Beschrijving
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Bekijk categorie
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
