import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Bell, Package, Truck, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';

interface TrackingSettings {
  notify_on_shipped: boolean;
  notify_on_delivered: boolean;
  notify_on_exception: boolean;
  notify_on_out_for_delivery: boolean;
  auto_poll_17track: boolean;
  poll_interval_hours: number;
  api_key_17track: string | null;
}

const defaultSettings: TrackingSettings = {
  notify_on_shipped: true,
  notify_on_delivered: false,
  notify_on_exception: true,
  notify_on_out_for_delivery: false,
  auto_poll_17track: false,
  poll_interval_hours: 4,
  api_key_17track: null,
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
      const { data, error } = await supabase
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
          auto_poll_17track: data.auto_poll_17track ?? false,
          poll_interval_hours: data.poll_interval_hours ?? 4,
          api_key_17track: data.api_key_17track ?? null,
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
      }, {
        onConflict: 'tenant_id',
      });

    if (error) {
      toast({
        title: 'Fout bij opslaan',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Instellingen opgeslagen',
        description: 'Tracking notificatie instellingen zijn bijgewerkt',
      });
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
              <p className="text-sm text-muted-foreground">
                Email wanneer tracking wordt toegevoegd
              </p>
            </div>
            <Switch
              id="notify-shipped"
              checked={settings.notify_on_shipped}
              onCheckedChange={(checked) =>
                setSettings((s) => ({ ...s, notify_on_shipped: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="notify-delivery">Onderweg voor bezorging</Label>
                <Badge variant="secondary">Optioneel</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Email wanneer pakket onderweg is naar eindbestemming
              </p>
            </div>
            <Switch
              id="notify-delivery"
              checked={settings.notify_on_out_for_delivery}
              onCheckedChange={(checked) =>
                setSettings((s) => ({ ...s, notify_on_out_for_delivery: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="notify-delivered">Pakket bezorgd</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Email wanneer pakket is afgeleverd (+ review verzoek)
              </p>
            </div>
            <Switch
              id="notify-delivered"
              checked={settings.notify_on_delivered}
              onCheckedChange={(checked) =>
                setSettings((s) => ({ ...s, notify_on_delivered: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="notify-exception">Probleem met zending</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Email bij uitzonderingen (retour, douane, etc.)
              </p>
            </div>
            <Switch
              id="notify-exception"
              checked={settings.notify_on_exception}
              onCheckedChange={(checked) =>
                setSettings((s) => ({ ...s, notify_on_exception: checked }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            17TRACK Integratie
            <Badge variant="outline">Premium</Badge>
          </CardTitle>
          <CardDescription>
            Automatische status updates voor internationale zendingen via 17TRACK API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="auto-poll">Automatisch tracking status ophalen</Label>
              <p className="text-sm text-muted-foreground">
                Poll 17TRACK elke {settings.poll_interval_hours} uur voor status updates
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
            <>
              <div className="space-y-2">
                <Label htmlFor="api-key">17TRACK API Key</Label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder="Voer je 17TRACK API key in"
                  value={settings.api_key_17track || ''}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, api_key_17track: e.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Verkrijg een API key op{' '}
                  <a
                    href="https://www.17track.net/en/apiTrack"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    17track.net
                  </a>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="poll-interval">Poll interval (uren)</Label>
                <Input
                  id="poll-interval"
                  type="number"
                  min={1}
                  max={24}
                  value={settings.poll_interval_hours}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      poll_interval_hours: parseInt(e.target.value) || 4,
                    }))
                  }
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Opslaan...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Instellingen opslaan
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
