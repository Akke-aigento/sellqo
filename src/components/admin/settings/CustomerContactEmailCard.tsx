import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { AtSign, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import { useCan } from '@/hooks/useCan';
import { supabase } from '@/integrations/supabase/client';

const emailSchema = z.string().trim().email();

/**
 * MAIL-CONTACT-1 — het adres dat klanten van de winkel zien.
 *
 * `tenants.support_email` is de Reply-To, footer en mailto van elke mail aan
 * klanten (orderbevestigingen, facturen, nieuwsbrieven). Tot 18 sep 2026 kon
 * een winkel dit nergens instellen. Leeg laten mag: dan valt de server terug op
 * het eigenaar-adres (`_shared/customerContact.ts`).
 *
 * Opslaan mag alleen wie `settings_general` kan schrijven — dat is precies wat
 * de RLS op `tenants` toelaat (tenant_admin, platform_admin).
 */
export function CustomerContactEmailCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { currentTenant, refreshTenants } = useTenant();
  const canWrite = useCan('write', 'settings_general');

  const saved = currentTenant?.support_email ?? '';
  const [value, setValue] = useState(saved);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(currentTenant?.support_email ?? '');
    setError(null);
  }, [currentTenant?.id, currentTenant?.support_email]);

  const trimmed = value.trim();
  const dirty = trimmed !== saved.trim();

  const handleSave = async () => {
    if (!currentTenant?.id) return;
    if (trimmed && !emailSchema.safeParse(trimmed).success) {
      setError(t('settings.email.contactInvalid'));
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const { data, error: updateError } = await supabase
        .from('tenants')
        .update({ support_email: trimmed || null })
        .eq('id', currentTenant.id)
        .select('id');
      if (updateError) throw updateError;
      // RLS laat een update zonder rechten stil 0 rijen raken.
      if (!data || data.length === 0) throw new Error(t('settings.email.contactNoRights'));
      await refreshTenants();
      toast({ title: t('settings.email.contactSaved') });
    } catch (e) {
      toast({
        title: t('settings.email.saveError'),
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="p-2 bg-primary/10 rounded-lg shrink-0">
            <AtSign className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-lg">{t('settings.email.contactTitle')}</CardTitle>
            <CardDescription>{t('settings.email.contactHint')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <Label htmlFor="customer-contact-email">{t('settings.email.contactLabel')}</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="customer-contact-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={value}
            placeholder={currentTenant?.owner_email || 'info@jouwwinkel.be'}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            disabled={!canWrite || saving}
            aria-invalid={!!error}
            aria-describedby="customer-contact-email-help"
            className="min-w-0 sm:flex-1"
          />
          {canWrite && (
            <Button onClick={handleSave} disabled={!dirty || saving} className="shrink-0">
              {saving && <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />}
              {t('settings.email.contactSave')}
            </Button>
          )}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <p id="customer-contact-email-help" className="text-sm text-muted-foreground">
          {canWrite
            ? t('settings.email.contactFallback', { email: currentTenant?.owner_email || '' })
            : t('settings.email.contactReadOnly')}
        </p>
      </CardContent>
    </Card>
  );
}
