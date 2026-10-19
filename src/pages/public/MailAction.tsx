// MAIL-1c: publieke pagina's voor links in marketingmails van winkels.
// Supabase serveert HTML uit edge functions als text/plain, dus de functies
// unsubscribe, email-preferences en newsletter-confirm renderen niets meer: een
// browser-GET krijgt een 302 hierheen, en deze pagina's praten via JSON terug.
//
//   /mail/afmelden    ?tenant&email&s&campaign  -> unsubscribe (info/unsubscribe/legacy)
//   /mail/voorkeuren  ?tenant&email&s           -> email-preferences (get/save)
//   /mail/bevestigd   ?status&shop&url&logo     -> resultaat nieuwsbriefbevestiging, geen servercall
//
// Lezers zijn klanten van een winkel, geen SellQo-gebruikers: geen login, taal
// uit ?lang= (de functies geven die mee) of anders de huidige taal.

import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageMeta } from '@/components/seo/PageMeta';
import { isLangCode } from '@/i18n/languages';
import { Loader2, CheckCircle2, AlertTriangle, MailCheck } from 'lucide-react';

const REASONS = ['too_many', 'not_relevant', 'never_signed_up', 'other'] as const;
const FREQUENCIES = ['normal', 'weekly', 'minimal'] as const;
type Frequency = (typeof FREQUENCIES)[number];

interface ShopInfo {
  shop_name?: string;
  logo_url?: string | null;
  shop_url?: string | null;
}

/** Enkel http(s) wordt een link of afbeelding; al de rest valt weg. */
const safeHttpUrl = (v: unknown): string | null => {
  if (typeof v !== 'string' || !v) return null;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
};

async function callMailFunction<T>(fn: 'unsubscribe' | 'email-preferences', body: Record<string, unknown>): Promise<T> {
  // Bewust fetch i.p.v. supabase.functions.invoke: de functies sturen CORS enkel
  // voor onze eigen origins en antwoorden ook bij 400 met bruikbare JSON
  // ({ valid: false }), die invoke als FunctionsHttpError zou wegstoppen.
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!data || res.status >= 500) throw new Error(`mail_function_${res.status}`);
  return data as T;
}

/** t vast op ?lang= als die geldig is, anders de huidige taal. */
function useMailT(): TFunction {
  const [params] = useSearchParams();
  const lang = params.get('lang');
  const { t } = useTranslation(undefined, isLangCode(lang) ? { lng: lang } : undefined);
  return t;
}

function Shell({ children, title, path }: { children: React.ReactNode; title: string; path: string }) {
  return (
    <main className="min-h-dvh overflow-x-hidden flex items-center justify-center bg-muted/30 px-4 py-10">
      <PageMeta title={title} description={title} path={path} noindex />
      <Card className="w-full max-w-md min-w-0">{children}</Card>
    </main>
  );
}

function ShopHeader({ shop }: { shop: ShopInfo }) {
  const logo = safeHttpUrl(shop.logo_url);
  if (logo) {
    return <img src={logo} alt={shop.shop_name || ''} className="mx-auto mb-2 max-h-14 max-w-[200px] object-contain" />;
  }
  if (shop.shop_name) {
    return <p className="mb-1 text-center text-lg font-semibold">{shop.shop_name}</p>;
  }
  return null;
}

function BackToShop({ shop, t }: { shop: ShopInfo; t: TFunction }) {
  const url = safeHttpUrl(shop.shop_url);
  if (!url) return null;
  return (
    <Button asChild variant="outline" className="w-full">
      <a href={url} rel="noopener noreferrer">{t('mailPages.common.back_to_shop')}</a>
    </Button>
  );
}

function StatePanel({
  icon,
  title,
  description,
  shop,
  children,
}: {
  icon: 'ok' | 'warn' | 'mail' | 'loading';
  title: string;
  description?: string;
  shop?: ShopInfo;
  children?: React.ReactNode;
}) {
  const Icon = icon === 'ok' ? CheckCircle2 : icon === 'warn' ? AlertTriangle : icon === 'mail' ? MailCheck : Loader2;
  const color = icon === 'warn' ? 'text-destructive' : 'text-primary';
  return (
    <>
      <CardHeader className="text-center">
        {shop && <ShopHeader shop={shop} />}
        <Icon className={`mx-auto h-10 w-10 ${color} ${icon === 'loading' ? 'animate-spin' : ''}`} aria-hidden="true" />
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      {children && <CardContent className="flex flex-col gap-3">{children}</CardContent>}
    </>
  );
}

function linkParams(tenant: string, email: string, s: string, lang: string | null) {
  const q = new URLSearchParams({ tenant, email, s });
  if (lang && isLangCode(lang)) q.set('lang', lang);
  return q.toString();
}

// ─────────────────────────────────────────────────────────────────────────────
// /mail/afmelden
// ─────────────────────────────────────────────────────────────────────────────

type UnsubState = 'loading' | 'ask' | 'legacy' | 'legacy_sent' | 'done' | 'invalid' | 'error';

export function MailUnsubscribe() {
  const t = useMailT();
  const [params] = useSearchParams();
  const tenant = params.get('tenant') || '';
  const email = params.get('email') || '';
  const s = params.get('s') || '';
  const campaign = params.get('campaign') || '';
  const lang = params.get('lang');
  const doneParam = params.get('done') === '1';

  const [state, setState] = useState<UnsubState>('loading');
  const [shop, setShop] = useState<ShopInfo>({});
  const [reason, setReason] = useState<string>('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!tenant || !email) {
      setState('invalid');
      return;
    }
    callMailFunction<{ valid: boolean; legacy: boolean } & ShopInfo>('unsubscribe', { action: 'info', tenant, email, s })
      .then((d) => {
        if (cancelled) return;
        setShop(d);
        if (d.valid) setState(doneParam ? 'done' : 'ask');
        else if (d.legacy) setState('legacy');
        else setState('invalid');
      })
      .catch(() => !cancelled && setState('error'));
    return () => {
      cancelled = true;
    };
  }, [tenant, email, s, doneParam]);

  const unsubscribe = async () => {
    setBusy(true);
    try {
      const d = await callMailFunction<{ ok: boolean }>('unsubscribe', {
        action: 'unsubscribe', tenant, email, s, campaign: campaign || undefined, reason: reason || undefined,
      });
      setState(d.ok ? 'done' : 'invalid');
    } catch {
      setState('error');
    } finally {
      setBusy(false);
    }
  };

  const requestLink = async () => {
    setBusy(true);
    try {
      await callMailFunction('unsubscribe', { action: 'legacy', tenant, email });
      setState('legacy_sent');
    } catch {
      setState('error');
    } finally {
      setBusy(false);
    }
  };

  const title = t('mailPages.unsubscribe.meta_title');
  const shell = (node: React.ReactNode) => <Shell title={title} path="/mail/afmelden">{node}</Shell>;

  if (state === 'loading') return shell(<StatePanel icon="loading" title={t('mailPages.common.loading')} />);
  if (state === 'invalid') {
    return shell(<StatePanel icon="warn" title={t('mailPages.common.invalid_title')} description={t('mailPages.common.invalid_body')} />);
  }
  if (state === 'error') {
    return shell(<StatePanel icon="warn" title={t('mailPages.common.error_title')} description={t('mailPages.common.error_body')} />);
  }
  if (state === 'legacy') {
    return shell(
      <StatePanel icon="mail" title={t('mailPages.unsubscribe.legacy_title')} description={t('mailPages.unsubscribe.legacy_body', { email })} shop={shop}>
        <Button onClick={requestLink} disabled={busy} className="w-full">
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
          {t('mailPages.unsubscribe.legacy_button')}
        </Button>
      </StatePanel>,
    );
  }
  if (state === 'legacy_sent') {
    return shell(<StatePanel icon="mail" title={t('mailPages.unsubscribe.legacy_sent_title')} description={t('mailPages.unsubscribe.legacy_sent_body')} shop={shop} />);
  }
  if (state === 'done') {
    return shell(
      <StatePanel
        icon="ok"
        title={t('mailPages.unsubscribe.done_title')}
        description={t('mailPages.unsubscribe.done_body', { shop: shop.shop_name || t('mailPages.common.the_shop') })}
        shop={shop}
      >
        <p className="text-center text-sm text-muted-foreground">{t('mailPages.unsubscribe.done_transactional')}</p>
        <Button asChild variant="secondary" className="w-full">
          <Link to={`/mail/voorkeuren?${linkParams(tenant, email, s, lang)}`}>{t('mailPages.unsubscribe.manage_preferences')}</Link>
        </Button>
        <BackToShop shop={shop} t={t} />
      </StatePanel>,
    );
  }

  // state === 'ask'
  return shell(
    <StatePanel
      icon="mail"
      title={t('mailPages.unsubscribe.title')}
      description={t('mailPages.unsubscribe.question', { shop: shop.shop_name || t('mailPages.common.the_shop') })}
      shop={shop}
    >
      <p className="text-center text-sm">
        {t('mailPages.unsubscribe.for_address')} <span className="font-semibold break-all">{email}</span>
      </p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="mail-unsub-reason">{t('mailPages.unsubscribe.reason_label')}</Label>
        <Select value={reason} onValueChange={setReason}>
          <SelectTrigger id="mail-unsub-reason">
            <SelectValue placeholder={t('mailPages.unsubscribe.reason_placeholder')} />
          </SelectTrigger>
          <SelectContent>
            {REASONS.map((r) => (
              <SelectItem key={r} value={r}>{t(`mailPages.unsubscribe.reasons.${r}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button variant="destructive" onClick={unsubscribe} disabled={busy} className="w-full">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
        {t('mailPages.unsubscribe.button')}
      </Button>
      <Button asChild variant="link" className="w-full">
        <Link to={`/mail/voorkeuren?${linkParams(tenant, email, s, lang)}`}>{t('mailPages.unsubscribe.or_manage')}</Link>
      </Button>
    </StatePanel>,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// /mail/voorkeuren
// ─────────────────────────────────────────────────────────────────────────────

interface Prefs {
  newsletter: boolean;
  promotions: boolean;
  product_updates: boolean;
  frequency: Frequency;
}

const PREF_KEYS = ['newsletter', 'promotions', 'product_updates'] as const;

export function MailPreferences() {
  const t = useMailT();
  const [params] = useSearchParams();
  const tenant = params.get('tenant') || '';
  const email = params.get('email') || '';
  const s = params.get('s') || '';
  const lang = params.get('lang');

  const [state, setState] = useState<'loading' | 'form' | 'invalid' | 'error'>('loading');
  const [shop, setShop] = useState<ShopInfo>({});
  const [prefs, setPrefs] = useState<Prefs>({ newsletter: true, promotions: true, product_updates: true, frequency: 'normal' });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!tenant || !email || !s) {
      setState('invalid');
      return;
    }
    callMailFunction<{ valid: boolean; preferences?: Prefs } & ShopInfo>('email-preferences', { action: 'get', tenant, email, s })
      .then((d) => {
        if (cancelled) return;
        if (!d.valid || !d.preferences) {
          setState('invalid');
          return;
        }
        setShop(d);
        const f = (FREQUENCIES as readonly string[]).includes(d.preferences.frequency) ? d.preferences.frequency : 'normal';
        setPrefs({ ...d.preferences, frequency: f });
        setState('form');
      })
      .catch(() => !cancelled && setState('error'));
    return () => {
      cancelled = true;
    };
  }, [tenant, email, s]);

  const save = async () => {
    setBusy(true);
    setSaved(false);
    setSaveError(false);
    try {
      const d = await callMailFunction<{ ok?: boolean }>('email-preferences', { action: 'save', tenant, email, s, ...prefs });
      if (d.ok) setSaved(true);
      else setSaveError(true);
    } catch {
      setSaveError(true);
    } finally {
      setBusy(false);
    }
  };

  const title = t('mailPages.preferences.meta_title');
  const shell = (node: React.ReactNode) => <Shell title={title} path="/mail/voorkeuren">{node}</Shell>;

  if (state === 'loading') return shell(<StatePanel icon="loading" title={t('mailPages.common.loading')} />);
  if (state === 'invalid') {
    return shell(<StatePanel icon="warn" title={t('mailPages.common.invalid_title')} description={t('mailPages.common.invalid_body')} />);
  }
  if (state === 'error') {
    return shell(<StatePanel icon="warn" title={t('mailPages.common.error_title')} description={t('mailPages.common.error_body')} />);
  }

  return shell(
    <>
      <CardHeader className="text-center">
        <ShopHeader shop={shop} />
        <CardTitle>{t('mailPages.preferences.title')}</CardTitle>
        <CardDescription>{t('mailPages.preferences.subtitle', { shop: shop.shop_name || t('mailPages.common.the_shop') })}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="rounded-md bg-muted px-3 py-2 text-sm break-all">
          {t('mailPages.preferences.email_label')} <span className="font-semibold">{email}</span>
        </p>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-sm font-medium text-muted-foreground">{t('mailPages.preferences.types_heading')}</legend>
          {PREF_KEYS.map((k) => (
            <div key={k} className="flex items-start gap-3 rounded-md border p-3">
              <Checkbox
                id={`mail-pref-${k}`}
                checked={prefs[k]}
                onCheckedChange={(v) => setPrefs((p) => ({ ...p, [k]: v === true }))}
                className="mt-0.5"
              />
              <div className="min-w-0">
                <Label htmlFor={`mail-pref-${k}`} className="font-medium">{t(`mailPages.preferences.types.${k}.title`)}</Label>
                <p className="text-sm text-muted-foreground">{t(`mailPages.preferences.types.${k}.description`)}</p>
              </div>
            </div>
          ))}
        </fieldset>

        <p className="text-xs text-muted-foreground">{t('mailPages.preferences.resubscribe_note')}</p>

        <div className="flex flex-col gap-2">
          <Label htmlFor="mail-pref-frequency">{t('mailPages.preferences.frequency_label')}</Label>
          <Select value={prefs.frequency} onValueChange={(v) => setPrefs((p) => ({ ...p, frequency: v as Frequency }))}>
            <SelectTrigger id="mail-pref-frequency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FREQUENCIES.map((f) => (
                <SelectItem key={f} value={f}>{t(`mailPages.preferences.frequency.${f}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {saved && (
          <p role="status" className="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
            {t('mailPages.preferences.saved')}
          </p>
        )}
        {saveError && (
          <p role="alert" className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" />
            {t('mailPages.common.error_body')}
          </p>
        )}

        <Button onClick={save} disabled={busy} className="w-full">
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
          {t('mailPages.preferences.save')}
        </Button>
        <BackToShop shop={shop} t={t} />
        <Button asChild variant="link" className="w-full text-destructive">
          <Link to={`/mail/afmelden?${linkParams(tenant, email, s, lang)}`}>{t('mailPages.preferences.unsubscribe_all')}</Link>
        </Button>
      </CardContent>
    </>,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// /mail/bevestigd — resultaat van newsletter-confirm, geen servercall
// ─────────────────────────────────────────────────────────────────────────────

const CONFIRM_STATUSES = ['ok', 'already', 'invalid', 'unsubscribed', 'error'] as const;
type ConfirmStatus = (typeof CONFIRM_STATUSES)[number];

export function MailConfirmed() {
  const t = useMailT();
  const [params] = useSearchParams();
  const raw = params.get('status') || '';
  const status: ConfirmStatus = (CONFIRM_STATUSES as readonly string[]).includes(raw) ? (raw as ConfirmStatus) : 'invalid';
  const shop = useMemo<ShopInfo>(
    () => ({
      // De naam komt uit de URL en wordt enkel als tekst gerenderd (React escapet).
      shop_name: (params.get('shop') || '').slice(0, 120),
      shop_url: safeHttpUrl(params.get('url')),
      logo_url: safeHttpUrl(params.get('logo')),
    }),
    [params],
  );
  const name = shop.shop_name || t('mailPages.common.the_shop');
  const positive = status === 'ok' || status === 'already';

  return (
    <Shell title={t('mailPages.confirmed.meta_title')} path="/mail/bevestigd">
      <StatePanel
        icon={positive ? 'ok' : 'warn'}
        title={t(`mailPages.confirmed.${status}.title`)}
        description={t(`mailPages.confirmed.${status}.body`, { shop: name })}
        shop={shop}
      >
        {shop.shop_url ? <BackToShop shop={shop} t={t} /> : null}
      </StatePanel>
    </Shell>
  );
}
