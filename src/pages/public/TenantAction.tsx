// TENANT-ACTION-1: publieke wrapper-pagina voor een deelbare onboarding-link.
// /actie/:token          -> vraagt de resolver om een VERSE Stripe
//                           onboarding-link (JSON) en navigeert er zelf heen.
// /actie/:token/gelukt   -> succesmelding na afronden bij Stripe.

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

const ERROR_KEYS = [
  'invalid_token',
  'token_used',
  'token_revoked',
  'token_expired',
  'unsupported_action',
  'origin_unresolved',
] as const;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-10">
      <Card className="w-full max-w-md">{children}</Card>
    </main>
  );
}

export function TenantActionSuccess() {
  const { t } = useTranslation();
  return (
    <Shell>
      <CardHeader className="text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-primary" aria-hidden="true" />
        <CardTitle>{t('tenantAction.success.title')}</CardTitle>
        <CardDescription>{t('tenantAction.success.description')}</CardDescription>
      </CardHeader>
      <CardContent className="text-center text-sm text-muted-foreground">
        {t('tenantAction.success.close_hint')}
      </CardContent>
    </Shell>
  );
}

export default function TenantAction() {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('invalid_token');
      return;
    }

    let cancelled = false;

    const go = async () => {
      const base = import.meta.env.VITE_SUPABASE_URL;
      const endpoint =
        `${base}/functions/v1/resolve-tenant-action` +
        `?token=${encodeURIComponent(token)}&origin=${encodeURIComponent(window.location.origin)}`;

      try {
        // TENANT-FIX-1: de resolver antwoordt altijd met JSON — bij succes
        // { success: true, url }, anders { success: false, error }. Eerder gaf
        // hij een 302 naar Stripe; die volgde de browser binnen deze fetch naar
        // connect.stripe.com, dat geen CORS-header voor ons origin zet, waarna
        // de fetch faalde en iedereen de foutpagina zag. Navigeren doen we nu
        // zelf, buiten de fetch om.
        const res = await fetch(endpoint);
        if (cancelled) return;

        const payload = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (payload?.success && typeof payload.url === 'string') {
          window.location.href = payload.url;
          return;
        }

        const code = typeof payload?.error === 'string' ? payload.error : 'unknown';
        setError((ERROR_KEYS as readonly string[]).includes(code) ? code : 'unknown');
      } catch {
        if (!cancelled) setError('unknown');
      }
    };

    void go();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (error) {
    return (
      <Shell>
        <CardHeader className="text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-destructive" aria-hidden="true" />
          <CardTitle>{t('tenantAction.error.title')}</CardTitle>
          <CardDescription>{t(`tenantAction.error.${error}`)}</CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          {t('tenantAction.error.contact_hint')}
        </CardContent>
      </Shell>
    );
  }

  return (
    <Shell>
      <CardHeader className="text-center">
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" aria-hidden="true" />
        <CardTitle>{t('tenantAction.loading.title')}</CardTitle>
        <CardDescription>{t('tenantAction.loading.description')}</CardDescription>
      </CardHeader>
    </Shell>
  );
}
