import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Settings, ShoppingCart, Package, Truck, CheckCircle } from 'lucide-react';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';

interface AutomationSettingsState {
  whatsapp_order_confirmation: boolean;
  whatsapp_shipping_updates: boolean;
}

export function WhatsAppAutomationSettings() {
  const { t } = useTranslation();
  const { currentTenant, refreshTenants } = useTenant();
  const { toast } = useToast();
  const [settings, setSettings] = useState<AutomationSettingsState>({
    whatsapp_order_confirmation: true,
    whatsapp_shipping_updates: true,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (currentTenant) {
      setSettings({
        whatsapp_order_confirmation: currentTenant.whatsapp_order_confirmation ?? true,
        whatsapp_shipping_updates: currentTenant.whatsapp_shipping_updates ?? true,
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
        title: t('settings.whatsapp.auto.saved'),
        description: t('settings.whatsapp.auto.savedBody'),
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: t('settings.whatsapp.auto.saveFailed'),
        description: t('settings.whatsapp.auto.saveFailedBody'),
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
      title: t('settings.whatsapp.auto.orderConfirmTitle'),
      description: t('settings.whatsapp.auto.orderConfirmBody'),
    },
    {
      id: 'shipping_updates',
      key: 'whatsapp_shipping_updates' as const,
      icon: Truck,
      title: t('settings.whatsapp.auto.shippingTitle'),
      description: t('settings.whatsapp.auto.shippingBody'),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          {t('settings.whatsapp.auto.title')}
        </CardTitle>
        <CardDescription>
          {t('settings.whatsapp.auto.subtitle')}
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

        {/* MAIL-2a: de WhatsApp-herinnering voor verlaten winkelwagens had geen verzender
            (dode schakelaar) en is verborgen. De kolommen whatsapp_abandoned_cart(_delay_hours)
            blijven bestaan maar worden hier niet meer gelezen of geschreven. De e-mailherinnering
            staat in Marketing > Automatiseringen. */}
        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Opslaan...' : 'Instellingen opslaan'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
