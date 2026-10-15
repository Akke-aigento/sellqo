import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import type { ActionItem } from '@/lib/healthScoreCalculator';
import { actionPriorityLabels } from '@/config/healthMessages';

interface HealthActionListProps {
  actionItems: ActionItem[];
}

export function HealthActionList({ actionItems }: HealthActionListProps) {
  const { t } = useTranslation();
  if (actionItems.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            {t('admin.shopHealth.actions_empty_title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('admin.shopHealth.actions_empty_body')}
          </p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          {t('admin.shopHealth.actions_title', { count: actionItems.length })}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {actionItems.map((item) => {
          const priorityConfig = actionPriorityLabels[item.priority];
          
          return (
            <div
              key={item.id}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border',
                item.priority === 'urgent' && 'bg-red-500/5 border-red-500/20',
                item.priority === 'medium' && 'bg-amber-500/5 border-amber-500/20',
                item.priority === 'tip' && 'bg-blue-500/5 border-blue-500/20'
              )}
            >
              {/* Priority badge */}
              <Badge
                variant="outline"
                className={cn('shrink-0 text-xs', priorityConfig.className)}
              >
                {t(priorityConfig.labelKey)}
              </Badge>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              
              {/* Action button */}
              <Button variant="ghost" size="sm" asChild className="shrink-0">
                <Link to={item.action.url}>
                  {item.action.label}
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
