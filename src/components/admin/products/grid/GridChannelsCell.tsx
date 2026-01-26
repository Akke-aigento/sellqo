import { useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { 
  SOCIAL_CHANNEL_INFO, 
  type SocialChannelType,
  type ProductSocialChannels 
} from '@/types/socialChannels';
import { useSocialChannels } from '@/hooks/useSocialChannels';

interface GridChannelsCellProps {
  value: ProductSocialChannels | null;
  isEditing: boolean;
  isSelected: boolean;
  hasChange: boolean;
  onChange: (value: ProductSocialChannels) => void;
  onStartEdit: () => void;
  onStopEdit: () => void;
}

// Compact channel badges with icons
const CHANNEL_BADGES: Record<SocialChannelType, { letter: string; bgClass: string; textClass: string }> = {
  google_shopping: { letter: 'G', bgClass: 'bg-blue-100', textClass: 'text-blue-700' },
  facebook_shop: { letter: 'f', bgClass: 'bg-blue-100', textClass: 'text-blue-800' },
  instagram_shop: { letter: 'I', bgClass: 'bg-pink-100', textClass: 'text-pink-600' },
  tiktok_shop: { letter: 'T', bgClass: 'bg-gray-100', textClass: 'text-gray-900' },
  pinterest_catalog: { letter: 'P', bgClass: 'bg-red-100', textClass: 'text-red-600' },
  whatsapp_business: { letter: 'W', bgClass: 'bg-green-100', textClass: 'text-green-600' },
  microsoft_shopping: { letter: 'M', bgClass: 'bg-cyan-100', textClass: 'text-cyan-700' },
  snapchat_catalog: { letter: 'S', bgClass: 'bg-yellow-100', textClass: 'text-yellow-700' },
};

function ChannelBadge({ type, active }: { type: SocialChannelType; active: boolean }) {
  const badge = CHANNEL_BADGES[type];
  const info = SOCIAL_CHANNEL_INFO[type];
  
  if (!badge || !info) return null;
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            'w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center transition-opacity',
            active ? badge.bgClass : 'bg-muted',
            active ? badge.textClass : 'text-muted-foreground/50'
          )}
        >
          {badge.letter}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {info.name} - {active ? 'Actief' : 'Inactief'}
      </TooltipContent>
    </Tooltip>
  );
}

export function GridChannelsCell({
  value,
  isEditing,
  isSelected,
  hasChange,
  onChange,
  onStartEdit,
  onStopEdit,
}: GridChannelsCellProps) {
  const { activeConnections } = useSocialChannels();
  const [open, setOpen] = useState(false);
  const [localValue, setLocalValue] = useState<ProductSocialChannels>(value || {});

  // Get connected channel types
  const connectedChannels = activeConnections.map(c => c.channel_type);
  const allChannelTypes = Object.keys(SOCIAL_CHANNEL_INFO) as SocialChannelType[];
  
  // Only show channels that are connected
  const availableChannels = allChannelTypes.filter(type => 
    connectedChannels.includes(type) || (value && value[type])
  );

  const channels = value || {};
  const activeChannels = Object.entries(channels).filter(([_, active]) => active);

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setLocalValue(value || {});
      onStartEdit();
    } else {
      onStopEdit();
    }
    setOpen(newOpen);
  };

  const handleToggleChannel = (type: SocialChannelType) => {
    setLocalValue(prev => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  const handleSave = () => {
    onChange(localValue);
    setOpen(false);
    onStopEdit();
  };

  const handleCancel = () => {
    setLocalValue(value || {});
    setOpen(false);
    onStopEdit();
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <div
          className={cn(
            'h-full min-h-[32px] px-1 flex items-center gap-0.5 rounded transition-colors cursor-pointer',
            isSelected && 'ring-2 ring-primary ring-inset',
            hasChange && 'bg-amber-50'
          )}
        >
          {availableChannels.length === 0 ? (
            <span className="text-xs text-muted-foreground">Geen kanalen</span>
          ) : activeChannels.length === 0 ? (
            <span className="text-xs text-muted-foreground">Geen actief</span>
          ) : (
            availableChannels.slice(0, 6).map(type => (
              <ChannelBadge 
                key={type} 
                type={type} 
                active={!!channels[type]} 
              />
            ))
          )}
          {availableChannels.length > 6 && (
            <span className="text-xs text-muted-foreground ml-1">
              +{availableChannels.length - 6}
            </span>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Verkoopkanalen</h4>
          
          {availableChannels.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Geen kanalen gekoppeld. Ga naar Instellingen → Kanalen om kanalen te koppelen.
            </p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {availableChannels.map(type => {
                const info = SOCIAL_CHANNEL_INFO[type];
                if (!info) return null;
                
                return (
                  <div 
                    key={type}
                    className="flex items-center gap-2"
                  >
                    <Checkbox
                      id={`channel-${type}`}
                      checked={!!localValue[type]}
                      onCheckedChange={() => handleToggleChannel(type)}
                    />
                    <Label 
                      htmlFor={`channel-${type}`}
                      className="flex items-center gap-2 text-sm cursor-pointer flex-1"
                    >
                      <ChannelBadge type={type} active={!!localValue[type]} />
                      <span>{info.name}</span>
                    </Label>
                  </div>
                );
              })}
            </div>
          )}
          
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button size="sm" variant="outline" onClick={handleCancel}>
              Annuleren
            </Button>
            <Button size="sm" onClick={handleSave}>
              <Check className="h-3 w-3 mr-1" />
              Opslaan
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
