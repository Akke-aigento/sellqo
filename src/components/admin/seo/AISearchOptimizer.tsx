import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Bot,
  Wand2,
  Check,
  AlertCircle,
  Lightbulb,
  MessageSquare,
  FileText,
  Link2,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface AISearchOptimizerProps {
  aiSearchScore: number | null;
  products: Array<{
    id: string;
    name: string;
    description?: string | null;
  }>;
  isLoading?: boolean;
  onGenerateFAQ?: (productIds: string[]) => void;
  onGenerateLongForm?: (productIds: string[]) => void;
  isGenerating?: boolean;
}

interface OptimizationTip {
  id: string;
  title: string;
  description: string;
  status: 'complete' | 'partial' | 'missing';
  icon: React.ElementType;
  priority: 'high' | 'medium' | 'low';
}

export function AISearchOptimizer({
  aiSearchScore,
  products,
  isLoading,
  onGenerateFAQ,
  onGenerateLongForm,
  isGenerating,
}: AISearchOptimizerProps) {
  const { t } = useTranslation();
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // Calculate optimization status
  const productsWithDescription = products.filter((p) => p.description && p.description.length > 100).length;
  const productsWithLongDescription = products.filter((p) => p.description && p.description.length > 500).length;
  const totalProducts = products.length;

  const getStatus = (done: number, total: number): 'complete' | 'partial' | 'missing' => {
    if (total === 0) return 'missing';
    const percentage = (done / total) * 100;
    if (percentage >= 80) return 'complete';
    if (percentage >= 30) return 'partial';
    return 'missing';
  };

  const tips: OptimizationTip[] = [
    {
      id: 'eeat',
      title: t('admin.seo.aISearchOptimizer.e_e_a_t_signalen'),
      description: t('admin.seo.aISearchOptimizer.toon_expertise_en_autoriteit_in_je'),
      status: getStatus(productsWithLongDescription, totalProducts),
      icon: Lightbulb,
      priority: 'high',
    },
    {
      id: 'conversational',
      title: t('admin.seo.aISearchOptimizer.conversational_content'),
      description: t('admin.seo.aISearchOptimizer.beantwoord_natuurlijke_vragen_in_je_content'),
      status: 'partial',
      icon: MessageSquare,
      priority: 'high',
    },
    {
      id: 'faq',
      title: t('admin.seo.aISearchOptimizer.faq_secties'),
      description: t('admin.seo.aISearchOptimizer.voeg_veelgestelde_vragen_toe_aan_productpagina'),
      status: 'missing',
      icon: FileText,
      priority: 'medium',
    },
    {
      id: 'citations',
      title: t('admin.seo.aISearchOptimizer.citeerbare_content'),
      description: t('admin.seo.aISearchOptimizer.schrijf_content_die_ai_s_graag'),
      status: getStatus(productsWithDescription, totalProducts),
      icon: Link2,
      priority: 'medium',
    },
  ];

  const completeTips = tips.filter((t) => t.status === 'complete').length;
  const overallProgress = Math.round((completeTips / tips.length) * 100);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* AI Search Score Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            {t('admin.seo.aISearchOptimizer.ai_search_optimalisatie')}
          </CardTitle>
          <CardDescription>
            {t('admin.seo.aISearchOptimizer.optimaliseer_je_content_voor_ai_zoekmachines')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Score Overview */}
          <div className="flex items-center gap-6">
            <div className="relative w-24 h-24">
              <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  className="text-muted stroke-current"
                  strokeWidth="10"
                  fill="transparent"
                  r="40"
                  cx="50"
                  cy="50"
                />
                <circle
                  className="text-blue-500 stroke-current transition-all duration-500"
                  strokeWidth="10"
                  strokeLinecap="round"
                  fill="transparent"
                  r="40"
                  cx="50"
                  cy="50"
                  strokeDasharray={`${((aiSearchScore || 0) / 100) * 251} 251`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-blue-500">
                  {aiSearchScore ?? '-'}
                </span>
              </div>
            </div>
            <div className="flex-1">
              <h4 className="font-medium mb-2">{t('admin.seo.aISearchOptimizer.ai_search_readiness')}</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Je content is {aiSearchScore && aiSearchScore >= 70 ? 'goed' : 'nog niet optimaal'} voorbereid op AI-zoekmachines.
              </p>
              <div className="flex items-center gap-2">
                <Progress value={overallProgress} className="flex-1" />
                <span className="text-sm font-medium">{completeTips}/{tips.length}</span>
              </div>
            </div>
          </div>

          {/* Optimization Tips */}
          <div className="space-y-3">
            <h4 className="font-medium">{t('admin.seo.aISearchOptimizer.optimalisatie_checklist')}</h4>
            {tips.map((tip) => {
              const Icon = tip.icon;
              return (
                <div
                  key={tip.id}
                  className={cn(
                    'p-4 rounded-lg border flex items-start gap-4',
                    tip.status === 'complete' && 'bg-green-500/5 border-green-500/30',
                    tip.status === 'partial' && 'bg-yellow-500/5 border-yellow-500/30',
                    tip.status === 'missing' && 'bg-muted/50'
                  )}
                >
                  <div className={cn(
                    'p-2 rounded-lg',
                    tip.status === 'complete' && 'bg-green-500/10',
                    tip.status === 'partial' && 'bg-yellow-500/10',
                    tip.status === 'missing' && 'bg-muted'
                  )}>
                    <Icon className={cn(
                      'h-5 w-5',
                      tip.status === 'complete' && 'text-green-500',
                      tip.status === 'partial' && 'text-yellow-500',
                      tip.status === 'missing' && 'text-muted-foreground'
                    )} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h5 className="font-medium">{tip.title}</h5>
                      <Badge variant={tip.priority === 'high' ? 'default' : 'secondary'} className="text-xs">
                        {tip.priority === 'high' ? t('admin.seo.keywordResearchPanel.hoog') : t('admin.seo.keywordResearchPanel.medium')}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{tip.description}</p>
                  </div>
                  <div>
                    {tip.status === 'complete' ? (
                      <Check className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertCircle className={cn(
                        'h-5 w-5',
                        tip.status === 'partial' ? 'text-yellow-500' : 'text-muted-foreground'
                      )} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t">
            <h4 className="font-medium mb-3">{t('admin.seo.aISearchOptimizer.ai_content_genereren')}</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => onGenerateFAQ?.(selectedProductIds.length > 0 ? selectedProductIds : products.map(p => p.id))}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                FAQ's Genereren
              </Button>
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => onGenerateLongForm?.(selectedProductIds.length > 0 ? selectedProductIds : products.map(p => p.id))}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4 mr-2" />
                )}
                Long-form Content
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tips Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('admin.seo.aISearchOptimizer.ai_search_tips')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg border bg-blue-500/5 border-blue-500/30">
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-blue-500" />
              {t('admin.seo.aISearchOptimizer.gebruik_natuurlijke_taal')}
            </h4>
            <p className="text-sm text-muted-foreground">
              {t('admin.seo.aISearchOptimizer.schrijf_productbeschrijvingen_alsof_je_een_vraag')}
            </p>
          </div>
          <div className="p-4 rounded-lg border bg-green-500/5 border-green-500/30">
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-green-500" />
              {t('admin.seo.aISearchOptimizer.beantwoord_veelgestelde_vragen')}
            </h4>
            <p className="text-sm text-muted-foreground">
              {t('admin.seo.aISearchOptimizer.voeg_een_faq_sectie_toe_aan')}
            </p>
          </div>
          <div className="p-4 rounded-lg border bg-purple-500/5 border-purple-500/30">
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <Link2 className="h-4 w-4 text-purple-500" />
              {t('admin.seo.aISearchOptimizer.wees_citeerbaar')}
            </h4>
            <p className="text-sm text-muted-foreground">
              {t('admin.seo.aISearchOptimizer.geef_specifieke_feiten_cijfers_en_unieke')}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
