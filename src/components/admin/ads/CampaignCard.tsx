import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { AD_PLATFORMS, type AdCampaign, type AdCampaignStatus } from '@/types/ads';
import { useAdCampaigns } from '@/hooks/useAdCampaigns';
import { MoreHorizontal, Pause, Play, Trash2, Edit, ExternalLink } from 'lucide-react';

interface CampaignCardProps {
  campaign: AdCampaign;
}

const STATUS_CONFIG: Record<AdCampaignStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft: { label: 'Concept', variant: 'outline' },
  pending_approval: { label: 'Wacht op goedkeuring', variant: 'secondary' },
  active: { label: 'Actief', variant: 'default' },
  paused: { label: 'Gepauzeerd', variant: 'secondary' },
  ended: { label: 'Beëindigd', variant: 'outline' },
  rejected: { label: 'Afgewezen', variant: 'destructive' },
};

export function CampaignCard({ campaign }: CampaignCardProps) {
  const { updateStatus, deleteCampaign } = useAdCampaigns();
  const platformInfo = AD_PLATFORMS[campaign.platform];
  const statusConfig = STATUS_CONFIG[campaign.status as AdCampaignStatus] || STATUS_CONFIG.draft;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const handlePause = () => {
    updateStatus.mutate({ id: campaign.id, status: 'paused' });
  };

  const handleActivate = () => {
    updateStatus.mutate({ id: campaign.id, status: 'active' });
  };

  const handleDelete = () => {
    if (confirm('Weet je zeker dat je deze campagne wilt verwijderen?')) {
      deleteCampaign.mutate(campaign.id);
    }
  };

  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
      {/* Platform Icon */}
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${platformInfo.color}`}>
        {platformInfo.icon}
      </div>

      {/* Campaign Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium truncate">{campaign.name}</h4>
          <Badge variant={statusConfig.variant} className="shrink-0">
            {statusConfig.label}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {platformInfo.name} • {campaign.campaign_type.replace(/_/g, ' ')}
        </p>
      </div>

      {/* Stats */}
      <div className="hidden md:flex items-center gap-6 text-sm">
        <div className="text-center">
          <p className="font-medium">{formatNumber(campaign.impressions)}</p>
          <p className="text-xs text-muted-foreground">Bereik</p>
        </div>
        <div className="text-center">
          <p className="font-medium">{formatNumber(campaign.clicks)}</p>
          <p className="text-xs text-muted-foreground">Clicks</p>
        </div>
        <div className="text-center">
          <p className="font-medium">{formatCurrency(campaign.spend)}</p>
          <p className="text-xs text-muted-foreground">Uitgaven</p>
        </div>
        <div className="text-center">
          <p className="font-medium">{campaign.roas?.toFixed(1) || '-'}x</p>
          <p className="text-xs text-muted-foreground">ROAS</p>
        </div>
      </div>

      {/* Budget */}
      {campaign.budget_amount && (
        <div className="hidden lg:block text-right">
          <p className="font-medium">{formatCurrency(campaign.budget_amount)}</p>
          <p className="text-xs text-muted-foreground">
            {campaign.budget_type === 'daily' ? '/dag' : 'totaal'}
          </p>
        </div>
      )}

      {/* Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>
            <Edit className="h-4 w-4 mr-2" />
            Bewerken
          </DropdownMenuItem>
          {campaign.platform_campaign_id && (
            <DropdownMenuItem>
              <ExternalLink className="h-4 w-4 mr-2" />
              Bekijk in {platformInfo.name}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {campaign.status === 'active' ? (
            <DropdownMenuItem onClick={handlePause}>
              <Pause className="h-4 w-4 mr-2" />
              Pauzeren
            </DropdownMenuItem>
          ) : campaign.status === 'paused' ? (
            <DropdownMenuItem onClick={handleActivate}>
              <Play className="h-4 w-4 mr-2" />
              Hervatten
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleDelete} className="text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Verwijderen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
