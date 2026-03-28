import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { HealthStatusIndicator } from './HealthStatusIndicator';
import { 
  ShoppingCart, Package, MessageCircle, CreditCard, Search, Shield,
  ArrowRight, ExternalLink
} from 'lucide-react';
import type { HealthCategory } from '@/lib/healthScoreCalculator';

interface HealthCategoryCardProps {
  category: HealthCategory;
  compact?: boolean;
}

const iconComponents: Record<string, React.ElementType> = {
  ShoppingCart,
  Package,
  MessageCircle,
  CreditCard,
  Search,
  Shield,
};

const statusStyles = {
  healthy: 'border-emerald-500/20 bg-emerald-500/5',
  attention: 'border-amber-500/20 bg-amber-500/5',
  warning: 'border-orange-500/20 bg-orange-500/5',
  critical: 'border-red-500/20 bg-red-500/5',
};

export function HealthCategoryCard({ category, compact = false }: HealthCategoryCardProps) {
  const Icon = iconComponents[category.icon] || Package;
  
  return (
    <Card className={cn('transition-all hover:shadow-md', statusStyles[category.status])}>
      <CardHeader className={cn('pb-2', compact && 'p-4')}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HealthStatusIndicator status={category.status} size="md" pulse={category.status === 'critical'} />
            <CardTitle className="text-sm font-medium">{category.name}</CardTitle>
          </div>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      
      <CardContent className={cn('space-y-3', compact && 'p-4 pt-0')}>
        {/* Emotional message */}
        <p className="text-xs text-muted-foreground line-clamp-2">
          {category.emotionalMessage}
        </p>
        
        {/* Items list */}
        <div className="space-y-1.5">
          {category.items.slice(0, compact ? 2 : 4).map((item, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground truncate flex-1">
                {item.label}
              </span>
              <span className={cn(
                'font-medium ml-2',
                item.status === 'ok' && 'text-emerald-600',
                item.status === 'warning' && 'text-amber-600',
                item.status === 'critical' && 'text-red-600'
              )}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
        
        {/* Score and action */}
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-xs text-muted-foreground">
            Score: {category.currentScore}/{category.maxScore}
          </span>
          
          {category.actionUrl && (
            <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
              <Link to={category.actionUrl}>
                Bekijk
                <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function HealthCategoryCardCompact({ category }: { category: HealthCategory }) {
  const Icon = iconComponents[category.icon] || Package;
  const mainItem = category.items.find(i => i.status !== 'ok') || category.items[0];
  
  return (
    <Link to={category.actionUrl || '#'}>
      <Card className={cn(
        'transition-all hover:shadow-md cursor-pointer h-full min-h-[88px]',
        statusStyles[category.status]
      )}>
        <CardContent className="p-3 h-full flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <HealthStatusIndicator status={category.status} size="sm" />
              <span className="text-sm font-medium truncate">{category.name}</span>
            </div>
            <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </div>
          
          {mainItem && (
            <div className="flex items-center justify-between gap-2 mt-2">
              <span className="text-xs text-muted-foreground line-clamp-1 flex-1">
                {mainItem.label}
              </span>
              <span className={cn(
                'text-sm font-semibold flex-shrink-0',
                mainItem.status === 'ok' && 'text-emerald-600',
                mainItem.status === 'warning' && 'text-amber-600',
                mainItem.status === 'critical' && 'text-red-600'
              )}>
                {mainItem.value}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
