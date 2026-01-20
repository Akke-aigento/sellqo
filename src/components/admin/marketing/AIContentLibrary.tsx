import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Library, Instagram, Mail, Lightbulb, Trash2, Copy, 
  Eye, Filter, Search, MoreHorizontal, Check, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

interface AIContent {
  id: string;
  content_type: string;
  title: string | null;
  content_text: string | null;
  html_content: string | null;
  platform: string | null;
  is_used: boolean | null;
  used_at: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

const typeIcons: Record<string, typeof Instagram> = {
  social: Instagram,
  email: Mail,
  suggestion: Lightbulb,
};

const typeLabels: Record<string, string> = {
  social: 'Social Media',
  email: 'Email',
  suggestion: 'Suggestie',
};

export function AIContentLibrary() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [previewContent, setPreviewContent] = useState<AIContent | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: content, isLoading } = useQuery({
    queryKey: ['ai-content-library', currentTenant?.id, typeFilter],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      let query = supabase
        .from('ai_generated_content')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (typeFilter !== 'all') {
        query = query.eq('content_type', typeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AIContent[];
    },
    enabled: !!currentTenant?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ai_generated_content')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-content-library'] });
      toast.success('Content verwijderd');
    },
    onError: () => {
      toast.error('Kon content niet verwijderen');
    },
  });

  const markAsUsedMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ai_generated_content')
        .update({ is_used: true, used_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-content-library'] });
      toast.success('Content gemarkeerd als gebruikt');
    },
  });

  const handleCopy = async (item: AIContent) => {
    const text = item.content_text || item.title || '';
    await navigator.clipboard.writeText(text);
    setCopiedId(item.id);
    toast.success('Gekopieerd naar klembord');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredContent = content?.filter(item => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      item.title?.toLowerCase().includes(searchLower) ||
      item.content_text?.toLowerCase().includes(searchLower)
    );
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Library className="h-5 w-5" />
            Content Bibliotheek
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Library className="h-5 w-5" />
              Content Bibliotheek
            </CardTitle>
            <Badge variant="secondary">{content?.length || 0} items</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Zoeken..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle types</SelectItem>
                <SelectItem value="social">Social Media</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="suggestion">Suggesties</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Content List */}
          {filteredContent?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Library className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>Nog geen AI content gegenereerd</p>
              <p className="text-sm">Genereer content via de andere tabs</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {filteredContent?.map((item) => {
                  const Icon = typeIcons[item.content_type] || Lightbulb;
                  return (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="p-2 rounded-lg bg-muted">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium truncate">
                            {item.title || 'Geen titel'}
                          </span>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {typeLabels[item.content_type] || item.content_type}
                          </Badge>
                          {item.platform && (
                            <Badge variant="secondary" className="text-xs shrink-0">
                              {item.platform}
                            </Badge>
                          )}
                          {item.is_used && (
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs shrink-0">
                              Gebruikt
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {item.content_text?.substring(0, 150)}...
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(item.created_at), 'PPp', { locale: nl })}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="shrink-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setPreviewContent(item)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Bekijken
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleCopy(item)}>
                            {copiedId === item.id ? (
                              <Check className="mr-2 h-4 w-4" />
                            ) : (
                              <Copy className="mr-2 h-4 w-4" />
                            )}
                            Kopiëren
                          </DropdownMenuItem>
                          {!item.is_used && (
                            <DropdownMenuItem onClick={() => markAsUsedMutation.mutate(item.id)}>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Markeer als gebruikt
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => deleteMutation.mutate(item.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Verwijderen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={!!previewContent} onOpenChange={() => setPreviewContent(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{previewContent?.title || 'Content Preview'}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {previewContent?.html_content ? (
              <div
                className="prose dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: previewContent.html_content }}
              />
            ) : (
              <div className="whitespace-pre-wrap">{previewContent?.content_text}</div>
            )}
          </ScrollArea>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setPreviewContent(null)}>
              Sluiten
            </Button>
            {previewContent && (
              <Button onClick={() => handleCopy(previewContent)}>
                <Copy className="mr-2 h-4 w-4" />
                Kopiëren
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
