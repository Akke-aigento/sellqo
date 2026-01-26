import { 
  CheckCircle, 
  Clock, 
  Link, 
  Settings, 
  Search, 
  Facebook, 
  Instagram, 
  Music, 
  Image, 
  MessageCircle, 
  Globe, 
  Camera,
  Info,
  Rss
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { SocialChannelConnection, SocialChannelInfo, SyncStatus } from '@/types/socialChannels';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';

const iconMap = {
  Search,
  Facebook,
  Instagram,
  Music,
  Image,
  MessageCircle,
  Globe,
  Camera,
};

interface SocialChannelCardProps {
  info: SocialChannelInfo;
  connection?: SocialChannelConnection;
  onConnect: () => void;
  onSettings: () => void;
  onDisconnect: () => void;
}

export function SocialChannelCard({
  info,
  connection,
  onConnect,
  onSettings,
  onDisconnect,
}: SocialChannelCardProps) {
  const isConnected = !!connection?.is_active;
  const Icon = iconMap[info.icon as keyof typeof iconMap] || Search;

  return (
    <div className={cn(
      "bg-card border rounded-xl p-6 hover:shadow-lg transition-all duration-200",
      info.comingSoon && "opacity-60"
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
              {info.feedBased && !info.comingSoon && (
                <Badge variant="outline" className="text-xs gap-1">
                  <Rss className="w-3 h-3" />
                  Feed
                </Badge>
              )}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Info className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>{info.tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            {isConnected ? (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle className="w-4 h-4" />
                Verbonden
              </span>
            ) : !info.comingSoon ? (
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
          {info.features.slice(0, 3).map((feature, idx) => (
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
        <div className={cn("rounded-lg p-3 mb-4", info.bgColor)}>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Producten</p>
              <p className="font-semibold">{connection.products_in_catalog || connection.products_synced || 0}</p>
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
          {/* Sync status indicator */}
          {connection.sync_status && connection.sync_status !== 'idle' && (
            <div className="mt-2 pt-2 border-t border-white/20">
              <span className={cn(
                "text-xs font-medium",
                connection.sync_status === 'synced' && "text-green-700",
                connection.sync_status === 'syncing' && "text-blue-700",
                connection.sync_status === 'error' && "text-red-700",
              )}>
                {connection.sync_status === 'synced' && '✓ Gesynchroniseerd'}
                {connection.sync_status === 'syncing' && '⟳ Synchroniseren...'}
                {connection.sync_status === 'error' && '⚠ Sync fout'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        {isConnected ? (
          <>
            <Button variant="outline" className="flex-1" onClick={onSettings}>
              Instellingen
            </Button>
            <Button 
              variant="ghost" 
              className="text-destructive hover:text-destructive hover:bg-destructive/10" 
              onClick={onDisconnect}
            >
              Verbreek
            </Button>
          </>
        ) : info.comingSoon ? (
          <Button variant="outline" className="flex-1" disabled>
            Binnenkort Beschikbaar
          </Button>
        ) : (
          <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={onConnect}>
            <Link className="w-4 h-4 mr-2" />
            Verbind {info.name}
          </Button>
        )}
      </div>
    </div>
  );
}
