import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SEOScoreBadgeProps {
  score: number | null;
  className?: string;
}

export function getScoreBadgeStyle(score: number | null) {
  if (score === null) return 'bg-muted text-muted-foreground';
  if (score >= 90) return 'bg-green-600/15 text-green-700 border-green-600/30';
  if (score >= 70) return 'bg-green-500/15 text-green-600 border-green-500/30';
  if (score >= 50) return 'bg-orange-500/15 text-orange-600 border-orange-500/30';
  return 'bg-destructive/15 text-destructive border-destructive/30';
}

export function getRowHighlight(score: number | null) {
  if (score !== null && score < 50) return 'bg-destructive/5';
  return '';
}

export function SEOScoreBadge({ score, className }: SEOScoreBadgeProps) {
  return (
    <Badge variant="outline" className={cn('font-semibold tabular-nums', getScoreBadgeStyle(score), className)}>
      {score !== null ? score : '—'}
    </Badge>
  );
}
