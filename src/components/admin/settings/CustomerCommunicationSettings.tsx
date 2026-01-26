import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageSquare, Mail, MessageCircle, AlertCircle, ExternalLink, Loader2 } from 'lucide-react';
import { useCustomerCommunicationSettings } from '@/hooks/useCustomerCommunicationSettings';
import { useWhatsAppConnection } from '@/hooks/useWhatsAppConnection';
import { CommunicationCategoryCard } from './CommunicationCategoryCard';
import { CommunicationTriggerRow } from './CommunicationTriggerRow';
import { 
  COMMUNICATION_CATEGORIES, 
  getTriggersByCategory,
  type CommunicationCategory 
} from '@/types/customerCommunication';
import { Link } from 'react-router-dom';

export function CustomerCommunicationSettings() {
  const { 
    settings, 
    isLoading, 
    initializeSettings, 
    updateSetting,
    getSetting,
  } = useCustomerCommunicationSettings();
  
  const { isConnected: whatsAppConnected } = useWhatsAppConnection();

  // Initialize settings on first load if needed
  useEffect(() => {
    if (!isLoading && (!settings || settings.length === 0)) {
      initializeSettings.mutate();
    }
  }, [isLoading, settings]);

  const handleEmailToggle = (triggerType: string, enabled: boolean) => {
    updateSetting.mutate({
      triggerType,
      updates: { email_enabled: enabled },
    });
  };

  const handleWhatsAppToggle = (triggerType: string, enabled: boolean) => {
    updateSetting.mutate({
      triggerType,
      updates: { whatsapp_enabled: enabled },
    });
  };

  const handleDelayChange = (triggerType: string, value: number, unit: 'hours' | 'days') => {
    updateSetting.mutate({
      triggerType,
      updates: unit === 'days' ? { delay_days: value } : { delay_hours: value },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Klant Communicatie</CardTitle>
              <CardDescription>
                Configureer welke automatische berichten je klanten ontvangen
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Channel Legend */}
          <div className="flex flex-wrap gap-6 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-background rounded border">
                <Mail className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-xs text-muted-foreground">Transactionele emails</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-background rounded border">
                <MessageCircle className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="flex items-center gap-2">
                <div>
                  <p className="text-sm font-medium">WhatsApp</p>
                  <p className="text-xs text-muted-foreground">Vereist klant opt-in</p>
                </div>
                {whatsAppConnected ? (
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-xs">
                    Gekoppeld
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    Niet gekoppeld
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* WhatsApp Warning */}
          {!whatsAppConnected && (
            <div className="flex items-start gap-2 mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  WhatsApp Business is nog niet gekoppeld. Koppel je account om WhatsApp berichten te kunnen versturen.
                </p>
                <Button variant="link" size="sm" className="h-auto p-0 mt-1 text-amber-700" asChild>
                  <Link to="/admin/settings?section=whatsapp">
                    <ExternalLink className="h-3 w-3 mr-1" />
                    WhatsApp instellen
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Cards */}
      {COMMUNICATION_CATEGORIES.map((category) => {
        const triggers = getTriggersByCategory(category.id as CommunicationCategory);
        
        return (
          <CommunicationCategoryCard key={category.id} category={category.id as CommunicationCategory}>
            {triggers.map((trigger) => (
              <CommunicationTriggerRow
                key={trigger.id}
                trigger={trigger}
                setting={getSetting(trigger.type)}
                whatsAppConnected={whatsAppConnected}
                onEmailToggle={(enabled) => handleEmailToggle(trigger.type, enabled)}
                onWhatsAppToggle={(enabled) => handleWhatsAppToggle(trigger.type, enabled)}
                onDelayChange={trigger.hasDelay ? (value) => handleDelayChange(trigger.type, value, trigger.delayUnit || 'hours') : undefined}
                isUpdating={updateSetting.isPending}
              />
            ))}
          </CommunicationCategoryCard>
        );
      })}

      {/* Footer Note */}
      <Card className="bg-muted/30">
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">
            💡 <strong>Tip:</strong> WhatsApp berichten worden alleen verzonden naar klanten die 
            tijdens het afrekenen hebben aangegeven updates via WhatsApp te willen ontvangen.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
