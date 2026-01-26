import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { MessageCircle, AlertCircle, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWhatsAppConnection } from '@/hooks/useWhatsAppConnection';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { WhatsAppConnectionCard } from './WhatsAppConnectionCard';
import { WhatsAppAutomationSettings } from './WhatsAppAutomationSettings';
import { WhatsAppTemplatesTable } from './WhatsAppTemplatesTable';

export function WhatsAppSettings() {
  const { currentTenant, refreshTenants } = useTenant();
  const { connection, isConnected } = useWhatsAppConnection();
  const { toast } = useToast();

  const webhookUrl = connection 
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`
    : null;

  const handleCopyWebhook = () => {
    if (webhookUrl) {
      navigator.clipboard.writeText(webhookUrl);
      toast({
        title: 'Webhook URL gekopieerd',
      });
    }
  };

  const handleToggleWhatsApp = async (enabled: boolean) => {
    if (!currentTenant?.id) return;

    const { error } = await supabase
      .from('tenants')
      .update({ whatsapp_enabled: enabled })
      .eq('id', currentTenant.id);

    if (error) {
      toast({
        title: 'Fout',
        description: 'Kon instelling niet opslaan',
        variant: 'destructive',
      });
      return;
    }

    await refreshTenants();
    toast({
      title: enabled ? 'WhatsApp ingeschakeld' : 'WhatsApp uitgeschakeld',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <MessageCircle className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <CardTitle>WhatsApp Business</CardTitle>
                <CardDescription>
                  Stuur automatische berichten naar klanten via WhatsApp
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Label htmlFor="whatsapp-enabled" className="text-sm">
                WhatsApp berichten
              </Label>
              <Switch
                id="whatsapp-enabled"
                checked={currentTenant?.whatsapp_enabled ?? false}
                onCheckedChange={handleToggleWhatsApp}
                disabled={!isConnected}
              />
            </div>
          </div>
        </CardHeader>
        {!isConnected && (
          <CardContent className="pt-0">
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Koppel eerst je WhatsApp Business account om berichten te kunnen versturen
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Connection */}
      <WhatsAppConnectionCard />

      {/* Webhook URL (only shown when connected) */}
      {isConnected && connection && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Webhook configuratie</CardTitle>
            <CardDescription>
              Configureer deze URL in je Meta Business Platform om berichten te ontvangen
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Webhook URL</Label>
              <div className="flex gap-2">
                <code className="flex-1 p-2 bg-muted rounded text-sm font-mono break-all">
                  {webhookUrl}
                </code>
                <Button variant="outline" size="icon" onClick={handleCopyWebhook}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Verify Token</Label>
              <div className="flex gap-2">
                <code className="flex-1 p-2 bg-muted rounded text-sm font-mono break-all">
                  {connection.webhook_verify_token}
                </code>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => {
                    navigator.clipboard.writeText(connection.webhook_verify_token);
                    toast({ title: 'Verify token gekopieerd' });
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a 
                href="https://business.facebook.com/settings/whatsapp-business-accounts" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Meta Business Platform
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Automation Settings */}
      {isConnected && <WhatsAppAutomationSettings />}

      {/* Templates */}
      {isConnected && <WhatsAppTemplatesTable />}
    </div>
  );
}
