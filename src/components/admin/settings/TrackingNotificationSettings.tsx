import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Bell, Package, Truck, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';

interface TrackingSettings {
  notify_on_shipped: boolean;
  notify_on_delivered: boolean;
  notify_on_exception: boolean;
  notify_on_out_for_delivery: boolean;
  auto_poll_17track: boolean;
}

const defaultSettings: TrackingSettings = {
  notify_on_shipped: true,
  notify_on_delivered: false,
  notify_on_exception: true,
  notify_on_out_for_delivery: false,
  auto_poll_17track: true,
};

export function TrackingNotificationSettings() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const { toast } = useToast();

  const [settings, setSettings] = useState<TrackingSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!tenantId) return;

    const fetchSettings = async () => {
      setIsLoading(true);
      const { data } = await supabase
        .from('tenant_tracking_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (data) {
        setSettings({
          notify_on_shipped: data.notify_on_shipped ?? true,
          notify_on_delivered: data.notify_on_delivered ?? false,
          notify_on_exception: data.notify_on_exception ?? true,
          notify_on_out_for_delivery: data.notify_on_out_for_delivery ?? false,
          auto_poll_17track: data.auto_poll_17track ?? true,
        });
      } else {
        // Auto-create default settings with polling enabled
        await supabase
          .from('tenant_tracking_settings')
          .insert({
            tenant_id: tenantId,
            ...defaultSettings,
          });
      }
      setIsLoading(false);
    };

    fetchSettings();
  }, [tenantId]);

  const handleSave = async () => {
    if (!tenantId) return;
    setIsSaving(true);

    const { error } = await supabase
      .from('tenant_tracking_settings')
      .upsert({
        tenant_id: tenantId,
        ...settings,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id' });

    if (error) {
      toast({ title: 'Fout bij opslaan', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Instellingen opgeslagen', description: 'Tracking notificatie instellingen zijn bijgewerkt' });
    }
    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Automatische Tracking Updates
          </CardTitle>
          <CardDescription>
            SellQo controleert automatisch de verzendstatus bij PostNL, DHL, bpost, DPD en GLS. Geen API key nodig.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="auto-poll">Automatisch status ophalen</Label>
              <p className="text-sm text-muted-foreground">
                Elke 30 minuten wordt de status van openstaande zendingen bijgewerkt
              </p>
            </div>
            <Switch
              id="auto-poll"
              checked={settings.auto_poll_17track}
              onCheckedChange={(checked) =>
                setSettings((s) => ({ ...s, auto_poll_17track: checked }))
              }
            />
          </div>
          {settings.auto_poll_17track && (
            <div className="mt-4 flex flex-wrap gap-2">
              {['PostNL', 'DHL', 'bpost', 'DPD', 'GLS'].map((carrier) => (
                <Badge key={carrier} variant="secondary">{carrier}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Klant Notificaties
          </CardTitle>
          <CardDescription>
            Bepaal wanneer klanten automatisch een email ontvangen over hun zending.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="notify-shipped">Pakket verzonden</Label>
              </div>
              <p className="text-sm text-muted-foreground">Email wanneer tracking wordt toegevoegd</p>
            </div>
            <Switch
              id="notify-shipped"
              checked={settings.notify_on_shipped}
              onCheckedChange={(checked) => setSettings((s) => ({ ...s, notify_on_shipped: checked }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="notify-delivery">Onderweg voor bezorging</Label>
                <Badge variant="secondary">Optioneel</Badge>
              </div>
              <p className="text-sm text-muted-foreground">Email wanneer pakket onderweg is naar eindbestemming</p>
            </div>
            <Switch
              id="notify-delivery"
              checked={settings.notify_on_out_for_delivery}
              onCheckedChange={(checked) => setSettings((s) => ({ ...s, notify_on_out_for_delivery: checked }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="notify-delivered">Pakket bezorgd</Label>
              </div>
              <p className="text-sm text-muted-foreground">Email wanneer pakket is afgeleverd (+ review verzoek)</p>
            </div>
            <Switch
              id="notify-delivered"
              checked={settings.notify_on_delivered}
              onCheckedChange={(checked) => setSettings((s) => ({ ...s, notify_on_delivered: checked }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="notify-exception">Probleem met zending</Label>
              </div>
              <p className="text-sm text-muted-foreground">Email bij uitzonderingen (retour, douane, etc.)</p>
            </div>
            <Switch
              id="notify-exception"
              checked={settings.notify_on_exception}
              onCheckedChange={(checked) => setSettings((s) => ({ ...s, notify_on_exception: checked }))}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Opslaan...</>
          ) : (
            <><Save className="h-4 w-4 mr-2" />Instellingen opslaan</>
          )}
        </Button>
      </div>
    </div>
  );
}
