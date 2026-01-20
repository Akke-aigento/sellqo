import { useQuery } from '@tanstack/react-query';
import { 
  Library, Instagram, Mail, Lightbulb, Copy, Check,
  ArrowRight, ImageIcon, Rocket
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useState } from 'react';
import { Link } from 'react-router-dom';

interface AIContent {
  id: string;
  content_type: string;
  title: string | null;
  content_text: string | null;
  platform: string | null;
  created_at: string;
}

const typeIcons: Record<string, typeof Instagram> = {
  social: Instagram,
  email: Mail,
  suggestion: Lightbulb,
  image: ImageIcon,
  product_promo_kit: Rocket,
};

const typeColors: Record<string, string> = {
  social: 'bg-pink-500/10 text-pink-500',
  email: 'bg-blue-500/10 text-blue-500',
  suggestion: 'bg-amber-500/10 text-amber-500',
  image: 'bg-green-500/10 text-green-500',
  product_promo_kit: 'bg-purple-500/10 text-purple-500',
};

interface RecentContentStripProps {
  onViewLibrary?: () => void;
}

export function RecentContentStrip({ onViewLibrary }: RecentContentStripProps) {
  const { currentTenant } = useTenant();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: content, isLoading } = useQuery({
    queryKey: ['recent-ai-content', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('ai_generated_content')
        .select('id, content_type, title, content_text, platform, created_at')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return (data || []) as AIContent[];
    },
    enabled: !!currentTenant?.id,
  });

  const handleCopy = async (item: AIContent) => {
    const text = item.content_text || item.title || '';
    await navigator.clipboard.writeText(text);
    setCopiedId(item.id);
    toast.success('Gekopieerd');
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Library className="h-5 w-5 text-muted-foreground" />
            Recente Content
          </h3>
        </div>
        <div className="grid gap-2">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!content?.length) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Library className="h-5 w-5 text-muted-foreground" />
            Recente Content
          </h3>
        </div>
        <div className="flex flex-col items-center justify-center p-8 rounded-lg border border-dashed text-center">
          <Library className="h-8 w-8 text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">Nog geen AI content gegenereerd</p>
          <p className="text-xs text-muted-foreground">Start met de Product Promo Wizard hierboven</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Library className="h-5 w-5 text-muted-foreground" />
          Recente Content
        </h3>
        <Link to="/admin/marketing/ai?tab=library">
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            Bekijk alles
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      </div>

      <div className="grid gap-2">
        {content.map((item) => {
          const Icon = typeIcons[item.content_type] || Lightbulb;
          const colorClass = typeColors[item.content_type] || 'bg-muted text-muted-foreground';
          
          return (
            <div
              key={item.id}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors group"
            >
              <div className={`p-2 rounded-lg ${colorClass}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">
                    {item.title || 'Geen titel'}
                  </span>
                  {item.platform && (
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {item.platform}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {item.content_text?.substring(0, 80)}...
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground hidden sm:block">
                  {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: nl })}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleCopy(item)}
                >
                  {copiedId === item.id ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
