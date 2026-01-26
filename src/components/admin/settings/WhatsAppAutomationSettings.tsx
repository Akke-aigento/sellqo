import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Settings, ShoppingCart, Package, Truck, CheckCircle } from 'lucide-react';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';

interface AutomationSettingsState {
  whatsapp_order_confirmation: boolean;
  whatsapp_shipping_updates: boolean;
  whatsapp_abandoned_cart: boolean;
  whatsapp_abandoned_cart_delay_hours: number;
}

export function WhatsAppAutomationSettings() {
  const { currentTenant, refreshTenants } = useTenant();
  const { toast } = useToast();
  const [settings, setSettings] = useState<AutomationSettingsState>({
    whatsapp_order_confirmation: true,
    whatsapp_shipping_updates: true,
    whatsapp_abandoned_cart: false,
    whatsapp_abandoned_cart_delay_hours: 1,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (currentTenant) {
      setSettings({
        whatsapp_order_confirmation: currentTenant.whatsapp_order_confirmation ?? true,
        whatsapp_shipping_updates: currentTenant.whatsapp_shipping_updates ?? true,
        whatsapp_abandoned_cart: currentTenant.whatsapp_abandoned_cart ?? false,
        whatsapp_abandoned_cart_delay_hours: currentTenant.whatsapp_abandoned_cart_delay_hours ?? 1,
      });
    }
  }, [currentTenant]);

  const handleSave = async () => {
    if (!currentTenant?.id) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('tenants')
        .update(settings)
        .eq('id', currentTenant.id);

      if (error) throw error;

      await refreshTenants();
      toast({
        title: 'Instellingen opgeslagen',
        description: 'Je WhatsApp automatisering instellingen zijn bijgewerkt.',
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Opslaan mislukt',
        description: 'Er ging iets mis bij het opslaan.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const automations = [
    {
      id: 'order_confirmation',
      key: 'whatsapp_order_confirmation' as const,
      icon: ShoppingCart,
      title: 'Bestelbevestiging',
      description: 'Stuur bevestiging na succesvolle betaling',
    },
    {
      id: 'shipping_updates',
      key: 'whatsapp_shipping_updates' as const,
      icon: Truck,
      title: 'Verzending updates',
      description: 'Stuur track & trace wanneer bestelling is verzonden',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Automatische Berichten
        </CardTitle>
        <CardDescription>
          Configureer welke berichten automatisch via WhatsApp worden verzonden
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {automations.map((automation) => (
          <div key={automation.id} className="flex items-start justify-between gap-4 pb-4 border-b last:border-0">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <automation.icon className="h-4 w-4" />
              </div>
              <div>
                <Label htmlFor={automation.id} className="font-medium cursor-pointer">
                  {automation.title}
                </Label>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {automation.description}
                </p>
              </div>
            </div>
            <Switch
              id={automation.id}
              checked={settings[automation.key]}
              onCheckedChange={(checked) => 
                setSettings(prev => ({ ...prev, [automation.key]: checked }))
              }
            />
          </div>
        ))}

        {/* Abandoned Cart with extra settings */}
        <div className="space-y-4 pb-4 border-b">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <ShoppingCart className="h-4 w-4" />
              </div>
              <div>
                <Label htmlFor="abandoned_cart" className="font-medium cursor-pointer">
                  Verlaten winkelwagen
                </Label>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Herinner klanten aan achtergelaten items
                </p>
              </div>
            </div>
            <Switch
              id="abandoned_cart"
              checked={settings.whatsapp_abandoned_cart}
              onCheckedChange={(checked) => 
                setSettings(prev => ({ ...prev, whatsapp_abandoned_cart: checked }))
              }
            />
          </div>

          {settings.whatsapp_abandoned_cart && (
            <div className="ml-11 p-4 bg-muted/50 rounded-lg space-y-3">
              <div className="flex items-center gap-3">
                <Label htmlFor="delay_hours" className="text-sm whitespace-nowrap">
                  Verstuur na
                </Label>
                <Input
                  id="delay_hours"
                  type="number"
                  min={1}
                  max={72}
                  className="w-20"
                  value={settings.whatsapp_abandoned_cart_delay_hours}
                  onChange={(e) => 
                    setSettings(prev => ({ 
                      ...prev, 
                      whatsapp_abandoned_cart_delay_hours: parseInt(e.target.value) || 1 
                    }))
                  }
                />
                <span className="text-sm text-muted-foreground">uur</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Alleen klanten die WhatsApp updates hebben geaccepteerd ontvangen deze herinnering.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Opslaan...' : 'Instellingen opslaan'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
