import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { getScoreColor, getScoreLabel } from '@/types/seo';
import { TrendingUp, TrendingDown, Minus, Search, FileText, Cog, Bot } from 'lucide-react';

interface SEOScoreCardProps {
  overallScore: number | null;
  metaScore: number | null;
  contentScore: number | null;
  technicalScore: number | null;
  aiSearchScore: number | null;
  previousScore?: number | null;
  isLoading?: boolean;
}

export function SEOScoreCard({
  overallScore,
  metaScore,
  contentScore,
  technicalScore,
  aiSearchScore,
  previousScore,
  isLoading,
}: SEOScoreCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-6">
          <Skeleton className="h-32 w-32 rounded-full mx-auto" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const scoreDiff = previousScore !== null && overallScore !== null 
    ? overallScore - previousScore 
    : null;

  const scores = [
    { label: 'Meta Tags', score: metaScore, icon: FileText },
    { label: 'Content', score: contentScore, icon: Search },
    { label: 'Technisch', score: technicalScore, icon: Cog },
    { label: 'AI Zoeken', score: aiSearchScore, icon: Bot },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          SEO Score
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Score Circle */}
        <div className="flex flex-col items-center">
          <div className="relative w-32 h-32">
            <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
              <circle
                className="text-muted stroke-current"
                strokeWidth="8"
                fill="transparent"
                r="42"
                cx="50"
                cy="50"
              />
              <circle
                className={cn('stroke-current transition-all duration-500', getScoreColor(overallScore))}
                strokeWidth="8"
                strokeLinecap="round"
                fill="transparent"
                r="42"
                cx="50"
                cy="50"
                strokeDasharray={`${((overallScore || 0) / 100) * 264} 264`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn('text-3xl font-bold', getScoreColor(overallScore))}>
                {overallScore ?? '-'}
              </span>
              <span className="text-xs text-muted-foreground">/100</span>
            </div>
          </div>
          
          {/* Trend indicator */}
          <div className="flex items-center gap-2 mt-2">
            <span className={cn('text-sm font-medium', getScoreColor(overallScore))}>
              {getScoreLabel(overallScore)}
            </span>
            {scoreDiff !== null && scoreDiff !== 0 && (
              <span className={cn(
                'flex items-center text-xs',
                scoreDiff > 0 ? 'text-green-500' : 'text-red-500'
              )}>
                {scoreDiff > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(scoreDiff)}
              </span>
            )}
          </div>
        </div>

        {/* Sub-scores */}
        <div className="grid grid-cols-2 gap-3">
          {scores.map(({ label, score, icon: Icon }) => (
            <div key={label} className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={score ?? 0} className="h-2 flex-1" />
                <span className={cn('text-sm font-medium w-8 text-right', getScoreColor(score))}>
                  {score ?? '-'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
