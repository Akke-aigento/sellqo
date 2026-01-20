import { Link } from 'react-router-dom';
import { Sparkles, Bot, Zap, ArrowRight, CreditCard } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FeatureGate } from '@/components/FeatureGate';
import { useAICredits } from '@/hooks/useAICredits';
import { cn } from '@/lib/utils';

export function DashboardAIWidget() {
  const { credits, isLoading } = useAICredits();

  if (isLoading) {
    return (
      <FeatureGate feature="ai_marketing">
        <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-blue-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              AI Marketing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </FeatureGate>
    );
  }

  const totalCredits = credits?.credits_total || 0;
  const usedCredits = credits?.credits_used || 0;
  const availableCredits = credits?.available || 0;
  const usagePercentage = totalCredits > 0 ? (usedCredits / totalCredits) * 100 : 0;

  const isLow = availableCredits <= 10 && availableCredits > 0;
  const isEmpty = availableCredits <= 0;

  return (
    <FeatureGate feature="ai_marketing">
      <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-blue-500/5 overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500">
              <Bot className="h-4 w-4 text-white" />
            </div>
            AI Marketing
          </CardTitle>
          <CardDescription>
            Genereer content met AI
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Credits Status */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">AI Credits</span>
              <Badge 
                variant={isEmpty ? 'destructive' : isLow ? 'secondary' : 'outline'}
                className={cn(
                  isEmpty && 'bg-red-500/10 text-red-500 border-red-500/20',
                  isLow && 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                )}
              >
                {availableCredits} / {totalCredits}
              </Badge>
            </div>
            <Progress 
              value={100 - usagePercentage} 
              className={cn(
                'h-2',
                isEmpty && '[&>div]:bg-red-500',
                isLow && '[&>div]:bg-amber-500'
              )}
            />
            {isEmpty && (
              <p className="text-xs text-red-500">
                Geen credits meer. Koop extra credits om door te gaan.
              </p>
            )}
            {isLow && !isEmpty && (
              <p className="text-xs text-amber-600">
                Bijna op. Overweeg extra credits te kopen.
              </p>
            )}
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-2">
            <Button 
              asChild 
              variant="outline" 
              size="sm" 
              className="h-auto py-2 flex-col items-center gap-1"
            >
              <Link to="/admin/marketing/ai?tab=social">
                <Zap className="h-4 w-4 text-pink-500" />
                <span className="text-xs">Social Post</span>
              </Link>
            </Button>
            <Button 
              asChild 
              variant="outline" 
              size="sm" 
              className="h-auto py-2 flex-col items-center gap-1"
            >
              <Link to="/admin/marketing/ai?tab=email">
                <Zap className="h-4 w-4 text-blue-500" />
                <span className="text-xs">Email</span>
              </Link>
            </Button>
          </div>

          {/* CTA */}
          <Button asChild className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
            <Link to="/admin/marketing/ai">
              <Sparkles className="mr-2 h-4 w-4" />
              AI Hub openen
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>

          {(isEmpty || isLow) && (
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link to="/admin/marketing/ai?purchase=open">
                <CreditCard className="mr-2 h-4 w-4" />
                Credits bijkopen
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </FeatureGate>
  );
}
