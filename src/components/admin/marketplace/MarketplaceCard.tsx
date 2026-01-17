import { CheckCircle, Clock, Link, Settings, ShoppingBag, Package, Store, ShoppingCart, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { MarketplaceConnection, MarketplaceInfo, MarketplaceType } from '@/types/marketplace';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';

const iconMap = {
  ShoppingBag,
  Package,
  Store,
  ShoppingCart,
  Plus,
};

interface MarketplaceCardProps {
  info: MarketplaceInfo;
  connection?: MarketplaceConnection;
  onConnect: () => void;
  onSettings: () => void;
  onDisconnect: () => void;
}

export function MarketplaceCard({
  info,
  connection,
  onConnect,
  onSettings,
  onDisconnect,
}: MarketplaceCardProps) {
  const isConnected = !!connection?.is_active;
  const Icon = iconMap[info.icon as keyof typeof iconMap] || ShoppingBag;

  return (
    <div className={cn(
      "bg-card border rounded-xl p-6 hover:shadow-lg transition-all duration-200",
      info.comingSoon && "opacity-60",
      !info.type && "border-dashed"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center", info.bgColor)}>
            <Icon className={cn("w-6 h-6", info.color)} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">{info.name}</h3>
              {info.comingSoon && (
                <Badge variant="secondary" className="text-xs">Binnenkort</Badge>
              )}
            </div>
            {isConnected ? (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle className="w-4 h-4" />
                Verbonden
              </span>
            ) : info.type ? (
              <span className="text-sm text-muted-foreground">Niet verbonden</span>
            ) : null}
          </div>
        </div>
        {isConnected && (
          <Button variant="ghost" size="icon" onClick={onSettings}>
            <Settings className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground mb-4">
        {info.description}
      </p>

      {/* Features Checklist */}
      {info.features.length > 0 && (
        <div className="space-y-2 mb-4">
          {info.features.map((feature, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm">
              {feature.available ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <Clock className="w-4 h-4 text-muted-foreground" />
              )}
              <span className={!feature.available ? 'text-muted-foreground' : ''}>
                {feature.text}
                {!feature.available && ' (binnenkort)'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Connection Stats */}
      {isConnected && connection && (
        <div className={cn("rounded-lg p-3 mb-4", info.bgColor.replace('bg-', 'bg-').replace('-100', '-50'))}>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Orders</p>
              <p className="font-semibold">{connection.stats?.totalOrders || 0}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Laatste sync</p>
              <p className="font-semibold">
                {connection.last_sync_at
                  ? formatDistanceToNow(new Date(connection.last_sync_at), { addSuffix: true, locale: nl })
                  : 'Nog niet'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        {isConnected ? (
          <>
            <Button variant="outline" className="flex-1" onClick={onSettings}>
              Instellingen
            </Button>
            <Button variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={onDisconnect}>
              Verbreek
            </Button>
          </>
        ) : info.comingSoon ? (
          <Button variant="outline" className="flex-1" disabled>
            Binnenkort Beschikbaar
          </Button>
        ) : info.type ? (
          <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={onConnect}>
            <Link className="w-4 h-4 mr-2" />
            Verbind {info.name}
          </Button>
        ) : (
          <Button variant="outline" className="flex-1" onClick={onConnect}>
            <Plus className="w-4 h-4 mr-2" />
            Vraag Integratie Aan
          </Button>
        )}
      </div>
    </div>
  );
}
