import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSocialChannels } from '@/hooks/useSocialChannels';
import { SOCIAL_CHANNEL_INFO, type SocialChannelType } from '@/types/socialChannels';
import type { ColumnDefinition } from './gridTypes';

interface CellBulkEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field: string;
  fieldLabel: string;
  cellCount: number;
  fieldType: ColumnDefinition['type'];
  onApply: (type: 'add' | 'subtract' | 'percentage_up' | 'percentage_down' | 'exact', value: number) => void;
  onApplyChannels?: (channels: Record<string, boolean>) => void;
}

export function CellBulkEditor({
  open,
  onOpenChange,
  field,
  fieldLabel,
  cellCount,
  fieldType,
  onApply,
  onApplyChannels,
}: CellBulkEditorProps) {
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'subtract' | 'percentage_up' | 'percentage_down' | 'exact'>('exact');
  const [value, setValue] = useState('');
  
  // Channel bulk editing state
  const [channelsToEnable, setChannelsToEnable] = useState<Set<SocialChannelType>>(new Set());
  const [channelsToDisable, setChannelsToDisable] = useState<Set<SocialChannelType>>(new Set());
  const { activeConnections } = useSocialChannels();

  const isCurrency = fieldType === 'currency';
  const isNumber = fieldType === 'number' || isCurrency;
  const isChannels = fieldType === 'channels';

  // Get connected channels
  const connectedChannels = activeConnections.map(c => c.channel_type);
  const availableChannels = (Object.keys(SOCIAL_CHANNEL_INFO) as SocialChannelType[])
    .filter(type => connectedChannels.includes(type));

  const handleApply = () => {
    if (isChannels && onApplyChannels) {
      const channels: Record<string, boolean> = {};
      channelsToEnable.forEach(type => { channels[type] = true; });
      channelsToDisable.forEach(type => { channels[type] = false; });
      onApplyChannels(channels);
      onOpenChange(false);
      setChannelsToEnable(new Set());
      setChannelsToDisable(new Set());
    } else {
      const numValue = parseFloat(value.replace(',', '.'));
      if (!isNaN(numValue)) {
        onApply(adjustmentType, numValue);
        onOpenChange(false);
        setValue('');
        setAdjustmentType('exact');
      }
    }
  };

  const getValueLabel = () => {
    switch (adjustmentType) {
      case 'add':
        return isCurrency ? 'Bedrag toevoegen (€)' : 'Waarde toevoegen';
      case 'subtract':
        return isCurrency ? 'Bedrag aftrekken (€)' : 'Waarde aftrekken';
      case 'percentage_up':
        return 'Percentage verhogen (%)';
      case 'percentage_down':
        return 'Percentage verlagen (%)';
      case 'exact':
        return isCurrency ? 'Exacte waarde (€)' : 'Exacte waarde';
    }
  };

  const toggleEnableChannel = (type: SocialChannelType) => {
    setChannelsToEnable(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
        // Remove from disable if present
        setChannelsToDisable(d => {
          const nd = new Set(d);
          nd.delete(type);
          return nd;
        });
      }
      return next;
    });
  };

  const toggleDisableChannel = (type: SocialChannelType) => {
    setChannelsToDisable(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
        // Remove from enable if present
        setChannelsToEnable(e => {
          const ne = new Set(e);
          ne.delete(type);
          return ne;
        });
      }
      return next;
    });
  };

  const hasChannelChanges = channelsToEnable.size > 0 || channelsToDisable.size > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk bewerken: {fieldLabel}</DialogTitle>
          <DialogDescription>
            Pas {cellCount} geselecteerde cel(len) aan
          </DialogDescription>
        </DialogHeader>

        {isChannels ? (
          <div className="space-y-4 py-4">
            {availableChannels.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Geen kanalen gekoppeld. Ga naar Instellingen → Kanalen om kanalen te koppelen.
              </p>
            ) : (
              <Tabs defaultValue="enable" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="enable">Inschakelen</TabsTrigger>
                  <TabsTrigger value="disable">Uitschakelen</TabsTrigger>
                </TabsList>
                <TabsContent value="enable" className="space-y-2 mt-4">
                  <p className="text-sm text-muted-foreground mb-2">
                    Selecteer kanalen om in te schakelen voor alle geselecteerde producten:
                  </p>
                  {availableChannels.map(type => {
                    const info = SOCIAL_CHANNEL_INFO[type];
                    return (
                      <div key={type} className="flex items-center gap-2">
                        <Checkbox
                          id={`enable-${type}`}
                          checked={channelsToEnable.has(type)}
                          onCheckedChange={() => toggleEnableChannel(type)}
                        />
                        <Label htmlFor={`enable-${type}`} className="cursor-pointer">
                          {info.name}
                        </Label>
                      </div>
                    );
                  })}
                </TabsContent>
                <TabsContent value="disable" className="space-y-2 mt-4">
                  <p className="text-sm text-muted-foreground mb-2">
                    Selecteer kanalen om uit te schakelen voor alle geselecteerde producten:
                  </p>
                  {availableChannels.map(type => {
                    const info = SOCIAL_CHANNEL_INFO[type];
                    return (
                      <div key={type} className="flex items-center gap-2">
                        <Checkbox
                          id={`disable-${type}`}
                          checked={channelsToDisable.has(type)}
                          onCheckedChange={() => toggleDisableChannel(type)}
                        />
                        <Label htmlFor={`disable-${type}`} className="cursor-pointer">
                          {info.name}
                        </Label>
                      </div>
                    );
                  })}
                </TabsContent>
              </Tabs>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {isNumber && (
              <RadioGroup
                value={adjustmentType}
                onValueChange={(v) => setAdjustmentType(v as typeof adjustmentType)}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="exact" id="exact" />
                  <Label htmlFor="exact">Exacte waarde instellen</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="add" id="add" />
                  <Label htmlFor="add">
                    {isCurrency ? 'Bedrag toevoegen' : 'Waarde toevoegen'}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="subtract" id="subtract" />
                  <Label htmlFor="subtract">
                    {isCurrency ? 'Bedrag aftrekken' : 'Waarde aftrekken'}
                  </Label>
                </div>
                {isCurrency && (
                  <>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="percentage_up" id="percentage_up" />
                      <Label htmlFor="percentage_up">Percentage verhogen</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="percentage_down" id="percentage_down" />
                      <Label htmlFor="percentage_down">Percentage verlagen</Label>
                    </div>
                  </>
                )}
              </RadioGroup>
            )}

            <div className="space-y-2">
              <Label htmlFor="value">{getValueLabel()}</Label>
              <Input
                id="value"
                type="text"
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={adjustmentType.includes('percentage') ? '10' : isCurrency ? '9,99' : '100'}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button 
            onClick={handleApply} 
            disabled={isChannels ? !hasChannelChanges : !value.trim()}
          >
            Toepassen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
