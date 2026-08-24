import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
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
import { useTranslation } from 'react-i18next';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';

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

const statusConfig: Record<string, { labelKey: string; className: string }> = {
  draft: { labelKey: 'admin.marketing.contentHistoryList.status.draft', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  scheduled: { labelKey: 'admin.marketing.contentHistoryList.status.gepland', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  published: { labelKey: 'admin.marketing.contentHistoryList.status.gepubliceerd', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  sent: { labelKey: 'admin.marketing.contentHistoryList.status.verzonden', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  pending: { labelKey: 'admin.marketing.contentHistoryList.status.wachtend', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
  failed: { labelKey: 'admin.marketing.contentHistoryList.status.mislukt', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
};

export function ContentHistoryList() {
  const { t } = useTranslation();
  const dateLocale = useDateFnsLocale();
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
          <CardTitle>{t('admin.marketing.contentHistoryList.content_historiek')}</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('common.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 w-[200px]"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={t('admin.marketing.aIContentLibrary.alle_types')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('admin.marketing.aIContentLibrary.alle_types')}</SelectItem>
                <SelectItem value="social_post">{t('admin.marketing.contentHistoryList.social_posts')}</SelectItem>
                <SelectItem value="email_campaign">{t('admin.marketing.aIContentLibrary.email')}</SelectItem>
                <SelectItem value="ai_content">{t('admin.marketing.contentHistoryList.ai_content')}</SelectItem>
                <SelectItem value="ai_suggestion">{t('admin.marketing.contentHistoryList.ai_suggesties')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={t('admin.marketing.contentHistoryList.alle_statussen_2')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('admin.marketing.contentHistoryList.alle_statussen')}</SelectItem>
                <SelectItem value="draft">{t('admin.marketing.contentHistoryList.draft')}</SelectItem>
                <SelectItem value="scheduled">{t('admin.marketing.contentHistoryList.gepland')}</SelectItem>
                <SelectItem value="published">{t('admin.marketing.contentHistoryList.gepubliceerd')}</SelectItem>
                <SelectItem value="sent">{t('admin.marketing.contentHistoryList.verzonden')}</SelectItem>
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
            <p>{t('admin.marketing.contentHistoryList.geen_content_gevonden')}</p>
            <p className="text-sm mt-1">{t('admin.marketing.contentHistoryList.probeer_andere_filters_of_zoektermen')}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">{t('admin.marketing.contentHistoryList.type')}</TableHead>
                <TableHead>{t('admin.marketing.contentHistoryList.titel')}</TableHead>
                <TableHead className="w-[100px]">{t('admin.marketing.contentHistoryList.platform')}</TableHead>
                <TableHead className="w-[120px]">{t('common.status')}</TableHead>
                <TableHead className="w-[120px]">{t('common.date')}</TableHead>
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
                      {statusConfig[item.status] ? t(statusConfig[item.status].labelKey) : item.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(item.created_at), 'd MMM yyyy', { locale: dateLocale })}
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
                          {t('admin.marketing.aIContentLibrary.bekijken')}
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Copy className="h-4 w-4 mr-2" />
                          {t('admin.marketing.aIContentLibrary.kopieren')}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t('common.delete')}
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
