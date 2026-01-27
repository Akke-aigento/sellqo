import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Mail, 
  Copy, 
  Check, 
  ExternalLink,
  Info,
  ShoppingBag,
  MessageSquare,
} from 'lucide-react';

const INBOUND_DOMAIN = 'sellqo.app';

export function InboundEmailSettings() {
  const { currentTenant, refreshTenants } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  // Fetch inbound stats
  const { data: stats } = useQuery({
    queryKey: ['inbound-email-stats', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const { count } = await supabase
        .from('customer_messages')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', currentTenant.id)
        .eq('direction', 'inbound')
        .eq('channel', 'email')
        .gte('created_at', weekAgo.toISOString());

      return { weeklyCount: count || 0 };
    },
    enabled: !!currentTenant?.id,
  });

  const inboundEmail = currentTenant?.inbound_email_prefix 
    ? `${currentTenant.inbound_email_prefix}@${INBOUND_DOMAIN}`
    : null;

  const toggleEnabled = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!currentTenant?.id) throw new Error('No tenant');

      const { error } = await supabase
        .from('tenants')
        .update({ inbound_email_enabled: enabled })
        .eq('id', currentTenant.id);

      if (error) throw error;
    },
    onSuccess: async (_, enabled) => {
      await refreshTenants();
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
      toast({
        title: enabled ? 'Inkomende e-mails geactiveerd' : 'Inkomende e-mails gedeactiveerd',
        description: enabled 
          ? 'Je kunt nu e-mails ontvangen in je SellQo inbox.'
          : 'Inkomende e-mails worden niet meer verwerkt.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fout bij opslaan',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const copyToClipboard = async () => {
    if (!inboundEmail) return;
    
    try {
      await navigator.clipboard.writeText(inboundEmail);
      setCopied(true);
      toast({
        title: 'Gekopieerd!',
        description: 'Je forwarding adres is gekopieerd naar het klembord.',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: 'Kopiëren mislukt',
        description: 'Kopieer het adres handmatig.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Inkomende E-mails</CardTitle>
              <CardDescription>
                Ontvang klantvragen direct in je SellQo inbox
              </CardDescription>
            </div>
          </div>
          <Switch
            checked={currentTenant?.inbound_email_enabled ?? false}
            onCheckedChange={(checked) => toggleEnabled.mutate(checked)}
            disabled={toggleEnabled.isPending}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Forwarding Address */}
        <div className="space-y-2">
          <Label>Je unieke forwarding adres</Label>
          <div className="flex gap-2">
            <Input
              value={inboundEmail || 'Laden...'}
              readOnly
              className="font-mono text-sm bg-muted"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={copyToClipboard}
              disabled={!inboundEmail}
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Gebruik dit adres als je klantenservice e-mailadres in externe platforms.
          </p>
        </div>

        {/* Status */}
        {stats && (
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">
                {currentTenant?.inbound_email_enabled ? (
                  <Badge variant="default" className="bg-green-600">Actief</Badge>
                ) : (
                  <Badge variant="secondary">Inactief</Badge>
                )}
              </p>
              <p className="text-sm text-muted-foreground">
                {stats.weeklyCount} {stats.weeklyCount === 1 ? 'bericht' : 'berichten'} ontvangen deze week
              </p>
            </div>
          </div>
        )}

        {/* Bol.com Instructions */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-orange-500" />
            <h4 className="font-medium">Bol.com koppelen</h4>
          </div>
          
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Stapsgewijze instructies</AlertTitle>
            <AlertDescription className="mt-2 space-y-2">
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Ga naar <strong>Bol.com Partner Platform</strong> → Instellingen → Winkelsettings</li>
                <li>Zoek het veld <strong>"Klantenservice e-mailadres"</strong></li>
                <li>
                  Vul in: <code className="px-1 py-0.5 bg-muted rounded text-xs font-mono">
                    {inboundEmail || '...'}
                  </code>
                </li>
                <li>Klik op <strong>Opslaan</strong></li>
              </ol>
            </AlertDescription>
          </Alert>

          <Button variant="outline" size="sm" asChild>
            <a 
              href="https://partner.bol.com/retailer/settings/shop" 
              target="_blank" 
              rel="noopener noreferrer"
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Open Bol.com Winkelsettings
            </a>
          </Button>
        </div>

        {/* Info about reply flow */}
        <Alert className="bg-primary/5 border-primary/20">
          <MessageSquare className="h-4 w-4 text-primary" />
          <AlertTitle>Antwoorden werkt automatisch</AlertTitle>
          <AlertDescription>
            Wanneer je een klantvraag beantwoordt via de SellQo inbox, wordt je antwoord 
            automatisch doorgestuurd via Bol.com naar de klant. Je hoeft nooit meer in 
            te loggen op Bol.com voor klantenservice!
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
