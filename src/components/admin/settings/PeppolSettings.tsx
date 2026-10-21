import { useState, useEffect } from 'react';
import { Network, Save, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { FloatingSaveBar } from '@/components/admin/FloatingSaveBar';

export function PeppolSettings() {
  const { t } = useTranslation();
  const { currentTenant, refreshTenants } = useTenant();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [peppolId, setPeppolId] = useState('');

  useEffect(() => {
    if (currentTenant) {
      setPeppolId((currentTenant as any).peppol_id || '');
    }
  }, [currentTenant]);

  const handleSave = async () => {
    if (!currentTenant) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('tenants')
        .update({
          peppol_id: peppolId || null,
        })
        .eq('id', currentTenant.id);

      if (error) throw error;

      await refreshTenants();
      
      toast({
        title: t('toast.saved'),
        description: t('peppol.settings.saved'),
      });
    } catch (error: any) {
      toast({
        title: t('toast.error'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Network className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle>{t('peppol.title')}</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            {t('peppol.mandatory_notice')}
          </AlertDescription>
        </Alert>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="peppol_id">{t('peppol.your_peppol_id')}</Label>
            <Input
              id="peppol_id"
              value={peppolId}
              onChange={(e) => setPeppolId(e.target.value)}
              placeholder={t('peppol.peppol_id_placeholder')}
            />
            <p className="text-xs text-muted-foreground">
              {t('peppol.settings.formatHint')}
            </p>
          </div>
        </div>

        <div className="pt-4 border-t">
          <h4 className="font-medium mb-2">{t('peppol.settings.schemesTitle')}</h4>
          <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
            <div>• {t('peppol.settings.schemes.be')}</div>
            <div>• {t('peppol.settings.schemes.nl')}</div>
            <div>• {t('peppol.settings.schemes.de')}</div>
            <div>• {t('peppol.settings.schemes.fr')}</div>
          </div>
        </div>

      </CardContent>
    </Card>

      <FloatingSaveBar
        isDirty={peppolId !== ((currentTenant as any)?.peppol_id || '')}
        isSaving={isSaving}
        onSave={handleSave}
        onCancel={() => setPeppolId((currentTenant as any)?.peppol_id || '')}
      />
    </>
  );
}
