import { Package, ShoppingCart, Euro, AlertTriangle } from 'lucide-react';
import { StatsCard } from '@/components/admin/StatsCard';

export function StatsGridWidget() {
  return (
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
  );
}
