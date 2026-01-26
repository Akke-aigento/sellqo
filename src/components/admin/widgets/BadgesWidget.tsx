import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useBadges } from '@/hooks/useBadges';
import { useMilestones } from '@/hooks/useMilestones';
import { BadgeCard } from '@/components/gamification/BadgeCard';
import { MilestoneProgress } from '@/components/gamification/MilestoneProgress';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronRight, Trophy } from 'lucide-react';

export function BadgesWidget() {
  const { earnedBadges, allBadges, isLoading } = useBadges();
  const { tenantStats } = useMilestones();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-28" />
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-14" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show up to 6 badges (earned first, then locked)
  const displayBadges = [
    ...earnedBadges.slice(0, 5),
    ...allBadges.filter((b) => !b.earned).slice(0, Math.max(0, 6 - earnedBadges.length)),
  ].slice(0, 6);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            Jouw Badges
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 gap-1" asChild>
            <Link to="/admin/badges">
              Alle
              <ChevronRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Badge display */}
        <div className="flex gap-1 overflow-x-auto pb-2">
          {displayBadges.map((badge) => (
            <BadgeCard key={badge.id} badge={badge} size="sm" />
          ))}
        </div>

        {/* Next milestone progress */}
        {tenantStats && tenantStats.lifetime_order_count !== undefined && (
          <MilestoneProgress
            type="orders"
            currentValue={tenantStats.lifetime_order_count || 0}
          />
        )}
      </CardContent>
    </Card>
  );
}
