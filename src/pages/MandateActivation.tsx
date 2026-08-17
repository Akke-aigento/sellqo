import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe, type Stripe as StripeJs } from '@stripe/stripe-js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type Info = {
  client_secret: string;
  publishable_key: string;
  stripe_account: string | null;
  tenant: { id: string; name: string; primary_color?: string | null };
  customer: { id: string; email: string | null; name: string };
  /** UX-UNIFY-1: optional platform-subscription context (plan + period price). */
  context?: {
    plan_name?: string | null;
    price?: number | null;
    interval?: 'weekly' | 'monthly' | 'quarterly' | 'yearly' | null;
    /** MANDATE-CTX-1: context afkomstig van een tenant-subscription. */
    source?: string | null;
    creditor?: string | null;
    reason?: string | null;
    /** UX-POLISH-1: startdatum bij een geplande planwissel. */
    effective_from?: string | null;
  } | null;
};

function MandateForm({ token, info, onDone }: { token: string; info: Info; onDone: () => void }) {
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    const { error: confirmError, setupIntent } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: window.location.href,
        payment_method_data: {
          billing_details: {
            name: info.customer.name || undefined,
            email: info.customer.email || undefined,
          },
        },
      },
      redirect: 'if_required',
    });
    if (confirmError) {
      setError(confirmError.message ?? t('mandate.errors.confirm_failed'));
      setSubmitting(false);
      return;
    }
    if (!setupIntent) {
      setError(t('mandate.errors.confirm_failed'));
      setSubmitting(false);
      return;
    }
    try {
      const { data, error: fnError } = await supabase.functions.invoke('mandate-setup-complete', {
        body: { token, setup_intent_id: setupIntent.id },
      });
      if (fnError) throw fnError;
      if (!data?.success) throw new Error(data?.error ?? 'Activation failed');
      onDone();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ layout: 'tabs', paymentMethodOrder: ['sepa_debit', 'card'], defaultValues: { billingDetails: { name: info.customer.name, email: info.customer.email ?? undefined } } }} />
      <p className="text-xs text-muted-foreground leading-relaxed">
        {t('mandate.sepa_mandate_text', { creditor: info.tenant.name })}
      </p>
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <Button type="submit" disabled={!stripe || submitting} className="w-full">
        {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {t('mandate.authorize')}
      </Button>
    </form>
  );
}

export default function MandateActivation() {
  const { t, i18n } = useTranslation();
  const { token = '' } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [stripePromise, setStripePromise] = useState<Promise<StripeJs | null> | null>(null);
  /** UX-UNIFY-2 — platform-context tokens return to the tenant's own billing page. */
  const hasPlatformContext = !!info?.context?.plan_name;

  useEffect(() => {
    if (!done || !hasPlatformContext) return;
    const timer = window.setTimeout(() => {
      window.location.assign('/admin/billing');
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [done, hasPlatformContext]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke('mandate-setup-info', {
          body: { token },
        });
        if (!alive) return;
        if (fnError) throw fnError;
        if (!data?.success) throw new Error(data?.error ?? 'invalid_token');
        const payload = data as Info & { success: true };
        setInfo(payload);
        setStripePromise(
          loadStripe(payload.publishable_key, payload.stripe_account ? { stripeAccount: payload.stripe_account } : undefined),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  const options = useMemo(
    () => (info ? { clientSecret: info.client_secret, appearance: { theme: 'stripe' as const } } : null),
    [info],
  );

  const errorLabel = (code: string | null) => {
    if (!code) return t('mandate.errors.generic');
    if (code === 'invalid_token') return t('mandate.errors.invalid_token');
    if (code === 'token_used') return t('mandate.errors.token_used');
    if (code === 'token_expired') return t('mandate.errors.token_expired');
    return code;
  };

  const ctx = info?.context ?? null;
  const contextLine = (() => {
    if (!ctx) return null;
    // MANDATE-CTX-1: manueel mandaat vanuit een subscription.
    if (ctx.source === 'subscription') {
      const subPrice = Number(ctx.price ?? 0);
      if (!subPrice) return null;
      const amount = new Intl.NumberFormat(i18n.language, {
        style: 'currency',
        currency: 'EUR',
      }).format(subPrice);
      // MANDATE-CTX-1b: map elk interval + interval_count juridisch correct.
      const count = Number(ctx.interval_count ?? 1);
      const iv = ctx.interval as 'weekly' | 'monthly' | 'quarterly' | 'yearly' | undefined;
      const singularKey = iv === 'weekly' ? 'mandate.context.per_week'
        : iv === 'quarterly' ? 'mandate.context.per_quarter'
        : iv === 'yearly' ? 'mandate.context.per_year'
        : 'mandate.context.per_month';
      const pluralKey = iv === 'weekly' ? 'mandate.context.per_week_n'
        : iv === 'quarterly' ? 'mandate.context.per_quarter_n'
        : iv === 'yearly' ? 'mandate.context.per_year_n'
        : 'mandate.context.per_month_n';
      const period = count > 1 ? t(pluralKey, { count }) : t(singularKey);
      return t('mandate.context.line_generic', {
        creditor: ctx.creditor || info?.tenant.name || '',
        reason: ctx.reason || '',
        amount,
        period,
      });
    }
    if (!ctx.plan_name) return null;
    const price = Number(ctx.price ?? 0);
    if (!price) return null;
    const amount = new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency: 'EUR',
    }).format(price);
    const period =
      ctx.interval === 'yearly' ? t('mandate.context.per_year') : t('mandate.context.per_month');
    if (ctx.effective_from) {
      const date = new Date(ctx.effective_from);
      const from = Number.isNaN(date.getTime())
        ? String(ctx.effective_from)
        : new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long' }).format(date);
      return t('mandate.context.line_from', {
        plan: ctx.plan_name,
        amount,
        period,
        date: from,
      });
    }
    return t('mandate.context.line', { plan: ctx.plan_name, amount, period });
  })();

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>{t('mandate.title')}</CardTitle>
          <CardDescription>
            {info ? t('mandate.description', { tenant: info.tenant.name }) : t('mandate.loading')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && error && (
            <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-medium">{t('mandate.errors.title')}</p>
                <p>{errorLabel(error)}</p>
              </div>
            </div>
          )}
          {!loading && !error && done && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-medium">{t('mandate.success.title')}</p>
                  <p>{t('mandate.success.body', { tenant: info?.tenant.name ?? '' })}</p>
                </div>
              </div>
              {hasPlatformContext && (
                <div className="space-y-2">
                  <Button
                    className="w-full"
                    onClick={() => window.location.assign('/admin/billing')}
                  >
                    {t('mandate.success.back_to_billing')}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    {t('mandate.success.redirecting')}
                  </p>
                </div>
              )}
            </div>
          )}
          {!loading && !error && !done && info && options && stripePromise && (
            <>
              <div className="mb-4 rounded-md border bg-muted/40 p-3 text-sm">
                <p className="font-medium">
                  {contextLine ??
                    t('mandate.context.recurring_no_amount', { creditor: info.tenant.name })}
                </p>
                <p className="text-muted-foreground mt-1">{t('mandate.context.cancel_note')}</p>
              </div>
              <Elements stripe={stripePromise} options={options}>
                <MandateForm token={token} info={info} onDone={() => setDone(true)} />
              </Elements>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}