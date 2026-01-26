import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBadges } from '@/hooks/useBadges';
import { useMilestones } from '@/hooks/useMilestones';
import { BadgeCard } from './BadgeCard';
import { MilestoneProgress } from './MilestoneProgress';
import { Skeleton } from '@/components/ui/skeleton';

export function BadgesOverview() {
  const { allBadges, badgeCounts, getBadgesByCategoryWithStatus, isLoading } = useBadges();
  const { tenantStats } = useMilestones();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-16" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            🏆 Jouw Badges
          </CardTitle>
          <span className="text-sm text-muted-foreground">
            {badgeCounts.total} / {allBadges.length} verdiend
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="all">Alle ({badgeCounts.total})</TabsTrigger>
            <TabsTrigger value="orders">Orders ({badgeCounts.orders})</TabsTrigger>
            <TabsTrigger value="revenue">Omzet ({badgeCounts.revenue})</TabsTrigger>
            <TabsTrigger value="customers">Klanten ({badgeCounts.customers})</TabsTrigger>
            <TabsTrigger value="special">Speciaal ({badgeCounts.special})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
              {allBadges.map((badge) => (
                <BadgeCard key={badge.id} badge={badge} size="sm" />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="orders" className="space-y-4">
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {getBadgesByCategoryWithStatus('orders').map((badge) => (
                <BadgeCard key={badge.id} badge={badge} />
              ))}
            </div>
            {tenantStats && (
              <MilestoneProgress
                type="orders"
                currentValue={tenantStats.lifetime_order_count || 0}
              />
            )}
          </TabsContent>

          <TabsContent value="revenue" className="space-y-4">
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {getBadgesByCategoryWithStatus('revenue').map((badge) => (
                <BadgeCard key={badge.id} badge={badge} />
              ))}
            </div>
            {tenantStats && (
              <MilestoneProgress
                type="revenue"
                currentValue={tenantStats.lifetime_revenue || 0}
              />
            )}
          </TabsContent>

          <TabsContent value="customers" className="space-y-4">
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {getBadgesByCategoryWithStatus('customers').map((badge) => (
                <BadgeCard key={badge.id} badge={badge} />
              ))}
            </div>
            {tenantStats && (
              <MilestoneProgress
                type="customers"
                currentValue={tenantStats.lifetime_customer_count || 0}
              />
            )}
          </TabsContent>

          <TabsContent value="special" className="space-y-4">
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {getBadgesByCategoryWithStatus('special').map((badge) => (
                <BadgeCard key={badge.id} badge={badge} showDescription />
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Speciale badges worden verdiend door uitstekende prestaties zoals snelle verzending, 
              tevreden klanten en goede voorraadbeheer.
            </p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
