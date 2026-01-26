import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Search, Filter, Mail, Instagram, Facebook, Linkedin, Twitter, Sparkles, Lightbulb, MoreHorizontal, Eye, Copy, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { cn } from '@/lib/utils';

interface ContentHistoryItem {
  id: string;
  type: 'social_post' | 'email_campaign' | 'ai_content' | 'ai_suggestion';
  title: string;
  platform: string | null;
  status: string;
  created_at: string;
  scheduled_at: string | null;
}

const typeIcons: Record<string, React.ReactNode> = {
  social_post: <Instagram className="h-4 w-4" />,
  email_campaign: <Mail className="h-4 w-4" />,
  ai_content: <Sparkles className="h-4 w-4" />,
  ai_suggestion: <Lightbulb className="h-4 w-4" />,
};

const platformIcons: Record<string, React.ReactNode> = {
  instagram: <Instagram className="h-3 w-3" />,
  facebook: <Facebook className="h-3 w-3" />,
  linkedin: <Linkedin className="h-3 w-3" />,
  twitter: <Twitter className="h-3 w-3" />,
  email: <Mail className="h-3 w-3" />,
};

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  scheduled: { label: 'Gepland', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  published: { label: 'Gepubliceerd', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  sent: { label: 'Verzonden', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  pending: { label: 'Wachtend', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
  failed: { label: 'Mislukt', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
};

export function ContentHistoryList() {
  const { currentTenant } = useTenant();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['content-history', currentTenant?.id, typeFilter, statusFilter],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const results: ContentHistoryItem[] = [];

      // Fetch AI generated content
      const { data: aiContent } = await supabase
        .from('ai_generated_content')
        .select('id, title, content_type, platform, publish_status, created_at, scheduled_at')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (aiContent) {
        for (const item of aiContent) {
          results.push({
            id: item.id,
            type: item.content_type === 'campaign_suggestion' ? 'ai_suggestion' : 'ai_content',
            title: item.title || 'AI Content',
            platform: item.platform,
            status: item.publish_status || 'draft',
            created_at: item.created_at,
            scheduled_at: item.scheduled_at,
          });
        }
      }

      // Fetch social posts
      const { data: socialPosts } = await supabase
        .from('social_posts')
        .select('id, post_text, platform, status, created_at, scheduled_for')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (socialPosts) {
        for (const post of socialPosts) {
          results.push({
            id: post.id,
            type: 'social_post',
            title: post.post_text?.slice(0, 60) || 'Social Post',
            platform: post.platform,
            status: post.status || 'draft',
            created_at: post.created_at || new Date().toISOString(),
            scheduled_at: post.scheduled_for,
          });
        }
      }

      // Fetch email campaigns
      const { data: emailCampaigns } = await supabase
        .from('email_campaigns')
        .select('id, name, status, created_at, scheduled_at')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (emailCampaigns) {
        for (const campaign of emailCampaigns) {
          results.push({
            id: campaign.id,
            type: 'email_campaign',
            title: campaign.name,
            platform: 'email',
            status: campaign.status,
            created_at: campaign.created_at,
            scheduled_at: campaign.scheduled_at,
          });
        }
      }

      // Sort by created_at descending
      return results.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
    enabled: !!currentTenant?.id,
  });

  const filteredItems = items.filter(item => {
    const matchesSearch = !search || 
      item.title.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || item.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle>Content Historiek</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Zoeken..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 w-[200px]"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Alle types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle types</SelectItem>
                <SelectItem value="social_post">Social Posts</SelectItem>
                <SelectItem value="email_campaign">Email</SelectItem>
                <SelectItem value="ai_content">AI Content</SelectItem>
                <SelectItem value="ai_suggestion">AI Suggesties</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Alle statussen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle statussen</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="scheduled">Gepland</SelectItem>
                <SelectItem value="published">Gepubliceerd</SelectItem>
                <SelectItem value="sent">Verzonden</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="h-[400px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <Filter className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>Geen content gevonden</p>
            <p className="text-sm mt-1">Probeer andere filters of zoektermen</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Type</TableHead>
                <TableHead>Titel</TableHead>
                <TableHead className="w-[100px]">Platform</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead className="w-[120px]">Datum</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map(item => (
                <TableRow key={`${item.type}-${item.id}`} className="cursor-pointer hover:bg-muted/50">
                  <TableCell>
                    <span className="text-muted-foreground">{typeIcons[item.type]}</span>
                  </TableCell>
                  <TableCell className="font-medium max-w-[300px] truncate">
                    {item.title}
                  </TableCell>
                  <TableCell>
                    {item.platform && (
                      <div className="flex items-center gap-1.5">
                        {platformIcons[item.platform.toLowerCase()]}
                        <span className="text-sm capitalize">{item.platform}</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="secondary" 
                      className={cn('text-xs', statusConfig[item.status]?.className)}
                    >
                      {statusConfig[item.status]?.label || item.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(item.created_at), 'd MMM yyyy', { locale: nl })}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Eye className="h-4 w-4 mr-2" />
                          Bekijken
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Copy className="h-4 w-4 mr-2" />
                          Kopiëren
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Verwijderen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
