import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { AtSign, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import { useCan } from '@/hooks/useCan';
import { supabase } from '@/integrations/supabase/client';

const emailSchema = z.string().trim().email();
// Zelfde regel en domein als _shared/customerContact.ts en _shared/inboundAddress.ts.
const MAIL_PREFIX_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;
const INBOUND_DOMAIN = 'mail.sellqo.app';

type Mode = 'inbox' | 'own';

/**
 * MAIL-CONTACT-1 / MAIL-SENDER-1 — het adres dat klanten van de winkel zien.
 *
 * `tenants.support_email` is de Reply-To, footer en mailto van elke mail aan
 * klanten. Twee keuzes:
 * - Mijn SellQo-inbox: `support_email = null`. Antwoorden gaan naar
 *   <prefix>@mail.sellqo.app en komen in de inbox in de admin.
 * - Eigen adres: `support_email` = het ingevulde adres.
 *
 * Opslaan mag alleen wie `settings_general` kan schrijven — dat is precies wat
 * de RLS op `tenants` toelaat (tenant_admin, platform_admin).
 */
export function CustomerContactEmailCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { currentTenant, refreshTenants } = useTenant();
  const canWrite = useCan('write', 'settings_general');

  const savedOwn = (currentTenant?.support_email ?? '').trim();
  const prefixCandidate = (currentTenant?.inbound_email_prefix || currentTenant?.slug || '').trim().toLowerCase();
  const inboxAddress = MAIL_PREFIX_RE.test(prefixCandidate) ? `${prefixCandidate}@${INBOUND_DOMAIN}` : null;

  const [mode, setMode] = useState<Mode>(savedOwn ? 'own' : 'inbox');
  const [value, setValue] = useState(savedOwn);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const own = (currentTenant?.support_email ?? '').trim();
    setMode(own ? 'own' : 'inbox');
    setValue(own);
    setError(null);
  }, [currentTenant?.id, currentTenant?.support_email]);

  const trimmed = value.trim();
  const dirty = mode === 'inbox' ? savedOwn !== '' : trimmed !== savedOwn;

  const handleSave = async () => {
    if (!currentTenant?.id) return;
    if (mode === 'own' && !emailSchema.safeParse(trimmed).success) {
      setError(t('settings.email.contactInvalid'));
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const { data, error: updateError } = await supabase
        .from('tenants')
        .update({ support_email: mode === 'own' ? trimmed : null })
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

  const disabled = !canWrite || saving;

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
      <CardContent className="space-y-4">
        <RadioGroup
          value={mode}
          onValueChange={(v) => {
            setMode(v as Mode);
            setError(null);
          }}
          disabled={disabled}
          className="space-y-3"
        >
          <div className="flex items-start gap-3">
            <RadioGroupItem value="inbox" id="contact-mode-inbox" className="mt-1 shrink-0" />
            <div className="min-w-0">
              <Label htmlFor="contact-mode-inbox" className="font-medium">
                {t('settings.email.contactModeInbox')}
              </Label>
              {inboxAddress && (
                <p className="font-mono text-sm break-all">{inboxAddress}</p>
              )}
              <p className="text-sm text-muted-foreground">{t('settings.email.contactModeInboxHint')}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <RadioGroupItem value="own" id="contact-mode-own" className="mt-1 shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor="contact-mode-own" className="font-medium">
                {t('settings.email.contactModeOwn')}
              </Label>
              {mode === 'own' && (
                <>
                  <Input
                    id="customer-contact-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={value}
                    placeholder="info@jouwwinkel.be"
                    aria-label={t('settings.email.contactLabel')}
                    onChange={(e) => {
                      setValue(e.target.value);
                      if (error) setError(null);
                    }}
                    disabled={disabled}
                    aria-invalid={!!error}
                    className="min-w-0"
                  />
                  {error && <p className="text-sm text-destructive">{error}</p>}
                </>
              )}
              <p className="text-sm text-muted-foreground">{t('settings.email.contactModeOwnHint')}</p>
            </div>
          </div>
        </RadioGroup>

        {canWrite ? (
          <Button onClick={handleSave} disabled={!dirty || saving} className="w-full sm:w-auto">
            {saving && <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />}
            {t('settings.email.contactSave')}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">{t('settings.email.contactReadOnly')}</p>
        )}
      </CardContent>
    </Card>
  );
}
