import { Link } from 'react-router-dom';
import { ArrowRight, AlertTriangle } from 'lucide-react';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { DashboardGrid } from '@/components/admin/DashboardGrid';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminDashboard() {
  const { currentTenant, loading: tenantLoading } = useTenant();
  const { isPlatformAdmin } = useAuth();

  if (tenantLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!currentTenant && !isPlatformAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Geen winkel gevonden</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Je hebt nog geen toegang tot een winkel. Neem contact op met een administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dynamic Dashboard Grid */}
      <DashboardGrid />

      {/* Platform Admin Notice */}
      {isPlatformAdmin && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">Platform Administrator</CardTitle>
            <CardDescription>
              Je hebt volledige toegang tot het platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/admin/platform">
                Ga naar Platform Beheer
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
