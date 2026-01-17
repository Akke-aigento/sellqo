import { 
  Package, 
  ShoppingCart, 
  Euro, 
  AlertTriangle,
  Plus,
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { StatsCard } from '@/components/admin/StatsCard';
import { DashboardMarketplaceWidget } from '@/components/admin/marketplace/DashboardMarketplaceWidget';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminDashboard() {
  const { currentTenant, loading: tenantLoading } = useTenant();
  const { user, isPlatformAdmin } = useAuth();

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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welkom{currentTenant ? ` bij ${currentTenant.name}` : ''}!
        </h1>
        <p className="text-muted-foreground">
          Hier is een overzicht van je winkel
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Omzet deze maand"
          value="€0,00"
          description="vs vorige maand"
          icon={Euro}
          trend={{ value: 0, isPositive: true }}
        />
        <StatsCard
          title="Bestellingen"
          value="0"
          description="deze maand"
          icon={ShoppingCart}
        />
        <StatsCard
          title="Actieve producten"
          value="0"
          description="in catalogus"
          icon={Package}
        />
        <StatsCard
          title="Openstaande bestellingen"
          value="0"
          description="te verwerken"
          icon={AlertTriangle}
        />
      </div>

      {/* Quick Actions & Recent Orders */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Snelle acties</CardTitle>
            <CardDescription>Veelgebruikte taken</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild className="w-full justify-start">
              <Link to="/admin/products/new">
                <Plus className="mr-2 h-4 w-4" />
                Nieuw product toevoegen
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link to="/admin/orders">
                <ShoppingCart className="mr-2 h-4 w-4" />
                Bestellingen bekijken
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link to="/admin/categories">
                <Package className="mr-2 h-4 w-4" />
                Categorieën beheren
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recente bestellingen</CardTitle>
              <CardDescription>Laatste 5 bestellingen</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/orders">
                Alles bekijken
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <ShoppingCart className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                Nog geen bestellingen
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Bestellingen verschijnen hier zodra ze binnenkomen
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Marketplace Widget */}
        <DashboardMarketplaceWidget />
      </div>

      {/* Low Stock Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Lage voorraad
          </CardTitle>
          <CardDescription>
            Producten die bijna op zijn
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Package className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              Geen producten met lage voorraad
            </p>
          </div>
        </CardContent>
      </Card>

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
