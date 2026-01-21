import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ExternalLink, Loader2, HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useReviewsHub } from '@/hooks/useReviewsHub';
import {
  getPlatformInfo,
  SYNC_FREQUENCY_OPTIONS,
  type ReviewPlatform,
  type ReviewPlatformConnection,
  type SyncFrequency,
} from '@/types/reviews-hub';

interface ReviewsPlatformConfigProps {
  platform: ReviewPlatform | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingConnection?: ReviewPlatformConnection;
}

export function ReviewsPlatformConfig({
  platform,
  open,
  onOpenChange,
  existingConnection,
}: ReviewsPlatformConfigProps) {
  const { upsertConnection, syncPlatform } = useReviewsHub();
  const platformInfo = platform ? getPlatformInfo(platform) : null;

  const [formData, setFormData] = useState({
    is_enabled: true,
    api_key: '',
    api_secret: '',
    external_id: '',
    external_url: '',
    display_name: '',
    sync_frequency: 'daily' as SyncFrequency,
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open && existingConnection) {
      setFormData({
        is_enabled: existingConnection.is_enabled,
        api_key: existingConnection.api_key || '',
        api_secret: existingConnection.api_secret || '',
        external_id: existingConnection.external_id || '',
        external_url: existingConnection.external_url || '',
        display_name: existingConnection.display_name || '',
        sync_frequency: existingConnection.sync_frequency as SyncFrequency,
      });
    } else if (open) {
      setFormData({
        is_enabled: true,
        api_key: '',
        api_secret: '',
        external_id: '',
        external_url: '',
        display_name: '',
        sync_frequency: 'daily',
      });
    }
  }, [open, existingConnection]);

  const handleSave = async () => {
    if (!platform) return;
    
    await upsertConnection.mutateAsync({
      platform,
      ...formData,
    });
    
    // Auto-sync after saving if enabled
    if (formData.is_enabled && formData.external_id) {
      syncPlatform.mutate(platform);
    }
    
    onOpenChange(false);
  };

  if (!platform || !platformInfo) return null;

  const getExternalIdLabel = () => {
    switch (platform) {
      case 'google': return 'Place ID';
      case 'trustpilot': return 'Business Unit ID';
      case 'kiyoh': return 'Company ID';
      case 'webwinkelkeur': return 'Shop ID';
      case 'trusted_shops': return 'TSID';
      case 'facebook': return 'Page ID';
      default: return 'External ID';
    }
  };

  const getExternalIdHelp = () => {
    switch (platform) {
      case 'google': 
        return 'Vind je Place ID via Google Maps of de Places API';
      case 'trustpilot': 
        return 'Te vinden in je Trustpilot Business dashboard URL';
      case 'kiyoh': 
        return 'Je Kiyoh bedrijfs-ID uit het dashboard';
      case 'webwinkelkeur': 
        return 'Je WebwinkelKeur shop ID';
      case 'trusted_shops': 
        return 'Je Trusted Shops ID (TSID)';
      case 'facebook': 
        return 'Je Facebook Page ID (te vinden in Page Info)';
      default: 
        return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: platformInfo.bgColor }}
            >
              <img 
                src={platformInfo.logo} 
                alt={platformInfo.name}
                className="w-6 h-6"
              />
            </div>
            <div>
              <DialogTitle>{platformInfo.name} Koppelen</DialogTitle>
              <DialogDescription>
                {existingConnection ? 'Bewerk de verbinding' : 'Voeg deze review bron toe'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="is_enabled">Platform Actief</Label>
            <Switch
              id="is_enabled"
              checked={formData.is_enabled}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_enabled: checked }))}
            />
          </div>

          {/* External ID */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="external_id">{getExternalIdLabel()}</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">{getExternalIdHelp()}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input
              id="external_id"
              value={formData.external_id}
              onChange={(e) => setFormData(prev => ({ ...prev, external_id: e.target.value }))}
              placeholder={`Voer je ${getExternalIdLabel()} in`}
            />
          </div>

          {/* API Key */}
          {platformInfo.apiKeyRequired && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="api_key">API Key</Label>
                {platformInfo.apiKeyUrl && (
                  <a 
                    href={platformInfo.apiKeyUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    API key verkrijgen <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <Input
                id="api_key"
                type="password"
                value={formData.api_key}
                onChange={(e) => setFormData(prev => ({ ...prev, api_key: e.target.value }))}
                placeholder="sk_live_..."
              />
            </div>
          )}

          {/* API Secret (for platforms that need it) */}
          {(platform === 'trustpilot' || platform === 'facebook') && (
            <div className="space-y-2">
              <Label htmlFor="api_secret">API Secret</Label>
              <Input
                id="api_secret"
                type="password"
                value={formData.api_secret}
                onChange={(e) => setFormData(prev => ({ ...prev, api_secret: e.target.value }))}
                placeholder="Secret key..."
              />
            </div>
          )}

          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="display_name">Weergavenaam (optioneel)</Label>
            <Input
              id="display_name"
              value={formData.display_name}
              onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
              placeholder="Mijn Bedrijf op Google"
            />
          </div>

          {/* External URL */}
          <div className="space-y-2">
            <Label htmlFor="external_url">Profiel URL (optioneel)</Label>
            <Input
              id="external_url"
              value={formData.external_url}
              onChange={(e) => setFormData(prev => ({ ...prev, external_url: e.target.value }))}
              placeholder="https://..."
            />
          </div>

          {/* Sync Frequency */}
          <div className="space-y-2">
            <Label htmlFor="sync_frequency">Synchronisatie Frequentie</Label>
            <Select
              value={formData.sync_frequency}
              onValueChange={(value) => setFormData(prev => ({ ...prev, sync_frequency: value as SyncFrequency }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SYNC_FREQUENCY_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button 
            onClick={handleSave}
            disabled={upsertConnection.isPending || !formData.external_id}
          >
            {upsertConnection.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {existingConnection ? 'Opslaan' : 'Koppelen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
