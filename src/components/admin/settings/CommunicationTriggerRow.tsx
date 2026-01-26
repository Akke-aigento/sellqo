import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings2, Mail, MessageCircle } from 'lucide-react';
import type { CommunicationTriggerDefinition, CustomerCommunicationSetting } from '@/types/customerCommunication';

interface CommunicationTriggerRowProps {
  trigger: CommunicationTriggerDefinition;
  setting?: CustomerCommunicationSetting;
  whatsAppConnected: boolean;
  onEmailToggle: (enabled: boolean) => void;
  onWhatsAppToggle: (enabled: boolean) => void;
  onDelayChange?: (value: number) => void;
  onEditTemplate?: (channel: 'email' | 'whatsapp') => void;
  isUpdating?: boolean;
}

export function CommunicationTriggerRow({
  trigger,
  setting,
  whatsAppConnected,
  onEmailToggle,
  onWhatsAppToggle,
  onDelayChange,
  onEditTemplate,
  isUpdating,
}: CommunicationTriggerRowProps) {
  const emailEnabled = setting?.email_enabled ?? trigger.defaultEmailEnabled;
  const whatsAppEnabled = setting?.whatsapp_enabled ?? trigger.defaultWhatsAppEnabled;
  const delayValue = trigger.delayUnit === 'days' 
    ? (setting?.delay_days ?? trigger.defaultDelayDays ?? 0)
    : (setting?.delay_hours ?? trigger.defaultDelayHours ?? 0);

  return (
    <div className="py-4 border-b last:border-0">
      <div className="flex items-start justify-between gap-4">
        {/* Trigger Info */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{trigger.label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{trigger.description}</p>
          
          {/* Delay setting inline */}
          {trigger.hasDelay && (emailEnabled || whatsAppEnabled) && (
            <div className="flex items-center gap-2 mt-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">
                Verstuur na:
              </Label>
              <Input
                type="number"
                min={1}
                max={trigger.delayUnit === 'days' ? 30 : 72}
                className="h-7 w-16 text-xs"
                value={delayValue}
                onChange={(e) => onDelayChange?.(parseInt(e.target.value) || 1)}
                disabled={isUpdating}
              />
              <span className="text-xs text-muted-foreground">
                {trigger.delayUnit === 'days' ? 'dagen' : 'uur'}
              </span>
            </div>
          )}
        </div>

        {/* Channel Toggles */}
        <div className="flex items-center gap-6 flex-shrink-0">
          {/* Email Toggle */}
          {trigger.supportsEmail && (
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Mail className="h-3 w-3" />
                <span className="hidden sm:inline">Email</span>
              </div>
              <Switch
                checked={emailEnabled}
                onCheckedChange={onEmailToggle}
                disabled={isUpdating}
                className="data-[state=checked]:bg-primary"
              />
            </div>
          )}

          {/* WhatsApp Toggle */}
          {trigger.supportsWhatsApp && (
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MessageCircle className="h-3 w-3" />
                <span className="hidden sm:inline">WhatsApp</span>
              </div>
              <Switch
                checked={whatsAppEnabled}
                onCheckedChange={onWhatsAppToggle}
                disabled={isUpdating || !whatsAppConnected}
                className="data-[state=checked]:bg-emerald-500"
              />
            </div>
          )}

          {/* Edit Template Button (optional) */}
          {onEditTemplate && (emailEnabled || whatsAppEnabled) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={() => onEditTemplate(emailEnabled ? 'email' : 'whatsapp')}
            >
              <Settings2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
