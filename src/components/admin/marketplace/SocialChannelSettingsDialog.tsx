import { useState } from 'react';
import { Copy, Check, RefreshCw, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useSocialChannels } from '@/hooks/useSocialChannels';
import { SOCIAL_CHANNEL_INFO, type SocialChannelType, type SocialChannelConnection } from '@/types/socialChannels';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';

interface SocialChannelSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelType: SocialChannelType;
  connection?: SocialChannelConnection;
}

export function SocialChannelSettingsDialog({
  open,
  onOpenChange,
  channelType,
  connection,
}: SocialChannelSettingsDialogProps) {
  const { updateConnection } = useSocialChannels();
  const [copied, setCopied] = useState(false);
  const [isActive, setIsActive] = useState(connection?.is_active ?? true);
  const info = SOCIAL_CHANNEL_INFO[channelType];

  const handleCopyFeedUrl = () => {
    if (connection?.feed_url) {
      navigator.clipboard.writeText(connection.feed_url);
      setCopied(true);
      toast.success('Feed URL gekopieerd!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSave = async () => {
    if (!connection) return;

    try {
      await updateConnection.mutateAsync({
        id: connection.id,
        updates: {
          is_active: isActive,
        },
      });
      onOpenChange(false);
    } catch {
      // Error handled by mutation
    }
  };

  if (!connection) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {info.name} Instellingen
            <Badge variant={connection.is_active ? 'default' : 'secondary'}>
              {connection.is_active ? 'Actief' : 'Inactief'}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Beheer je {info.name} integratie
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Producten gesynchroniseerd</p>
              <p className="text-2xl font-bold">{connection.products_synced || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Laatste sync</p>
              <p className="text-lg font-semibold">
                {connection.last_sync_at
                  ? formatDistanceToNow(new Date(connection.last_sync_at), { addSuffix: true, locale: nl })
                  : 'Nog niet'}
              </p>
            </div>
          </div>

          {/* Feed URL */}
          {connection.feed_url && (
            <div className="space-y-2">
              <Label>Product Feed URL</Label>
              <div className="flex gap-2">
                <Input 
                  value={connection.feed_url} 
                  readOnly 
                  className="font-mono text-xs"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  size="icon"
                  onClick={handleCopyFeedUrl}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {connection.last_feed_generated_at 
                  ? `Feed gegenereerd ${formatDistanceToNow(new Date(connection.last_feed_generated_at), { addSuffix: true, locale: nl })}`
                  : 'Feed nog niet gegenereerd'}
              </p>
            </div>
          )}

          {/* Credentials info */}
          {connection.credentials && (connection.credentials as any).merchantId && (
            <div className="space-y-2">
              <Label>Merchant ID</Label>
              <Input 
                value={(connection.credentials as any).merchantId} 
                readOnly 
                className="bg-muted"
              />
            </div>
          )}

          {/* Error display */}
          {connection.last_error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              <p className="font-medium">Laatste fout:</p>
              <p>{connection.last_error}</p>
            </div>
          )}

          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Kanaal Actief</Label>
              <p className="text-sm text-muted-foreground">
                Schakel de synchronisatie in of uit
              </p>
            </div>
            <Switch
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Sync Nu
            </Button>
            
            {info.feedBased && (
              <Button variant="outline" size="sm" asChild>
                <a href={connection.feed_url || '#'} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Preview Feed
                </a>
              </Button>
            )}
          </div>

          {/* Save */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuleer
            </Button>
            <Button onClick={handleSave} disabled={updateConnection.isPending}>
              {updateConnection.isPending ? 'Opslaan...' : 'Opslaan'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
