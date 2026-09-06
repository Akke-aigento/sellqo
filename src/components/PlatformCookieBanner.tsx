import { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Cookie } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

export interface PlatformCookieConsent {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  timestamp: number;
  version: number;
}

const STORAGE_KEY = 'sellqo-cookie-consent';
const CONSENT_VERSION = 1;

/** Routes waar de platform-banner NIET hoort (tenant storefront + ingelogde apps). */
const EXCLUDED_PREFIXES = ['/shop/', '/admin', '/platform', '/pos', '/checkout', '/betaling'];

export function getPlatformCookieConsent(): PlatformCookieConsent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlatformCookieConsent;
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function hasPlatformConsent(category: 'analytics' | 'marketing'): boolean {
  return getPlatformCookieConsent()?.[category] === true;
}

/** Heropent de banner (bv. via een "Cookievoorkeuren"-link in de footer). */
export function openPlatformCookieSettings() {
  window.dispatchEvent(new CustomEvent('sellqo-open-cookie-settings'));
}

export function PlatformCookieBanner() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [prefs, setPrefs] = useState({ analytics: false, marketing: false });

  const excluded = EXCLUDED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p)
  );

  // In de native app zijn er geen browser-cookies waarvoor toestemming nodig is,
  // dus de banner hoort daar niet. Hij dekte er bovendien het inlogscherm af:
  // /auth staat niet in EXCLUDED_PREFIXES, en NativeLandingRedirect stuurt een
  // uitgelogde native gebruiker precies daarheen.
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    if (isNative || excluded) return;
    if (!getPlatformCookieConsent()) setVisible(true);
  }, [isNative, excluded]);

  useEffect(() => {
    const reopen = () => {
      const stored = getPlatformCookieConsent();
      setPrefs({
        analytics: stored?.analytics ?? false,
        marketing: stored?.marketing ?? false,
      });
      setShowDetails(true);
      setVisible(true);
    };
    window.addEventListener('sellqo-open-cookie-settings', reopen);
    return () => window.removeEventListener('sellqo-open-cookie-settings', reopen);
  }, []);

  const persist = useCallback((analytics: boolean, marketing: boolean) => {
    const value: PlatformCookieConsent = {
      necessary: true,
      analytics,
      marketing,
      timestamp: Date.now(),
      version: CONSENT_VERSION,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      /* private mode: consent geldt dan alleen voor deze sessie */
    }
    setVisible(false);
    setShowDetails(false);
    window.dispatchEvent(new CustomEvent('sellqo-cookie-consent-changed', { detail: value }));
  }, []);

  if (isNative || excluded || !visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={t('cookieConsent.title')}
      className="fixed inset-x-0 bottom-0 z-[200] border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-lg pb-safe"
    >
      <div className="container mx-auto max-w-5xl px-4 py-4 sm:py-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex gap-3">
            <span className="mt-0.5 hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:flex">
              <Cookie className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-foreground">{t('cookieConsent.title')}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('cookieConsent.body')}{' '}
                <Link to="/cookies" className="underline underline-offset-2 hover:text-foreground">
                  {t('cookieConsent.policy')}
                </Link>
                {' · '}
                <Link to="/privacy" className="underline underline-offset-2 hover:text-foreground">
                  {t('cookieConsent.privacy')}
                </Link>
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row md:shrink-0">
            <Button variant="ghost" size="sm" onClick={() => setShowDetails((v) => !v)}>
              {t('cookieConsent.customize')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => persist(false, false)}>
              {t('cookieConsent.rejectAll')}
            </Button>
            <Button size="sm" onClick={() => persist(true, true)}>
              {t('cookieConsent.acceptAll')}
            </Button>
          </div>
        </div>

        {showDetails && (
          <div className="mt-4 space-y-3 border-t border-border pt-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{t('cookieConsent.necessary')}</p>
                <p className="text-xs text-muted-foreground">{t('cookieConsent.necessaryDesc')}</p>
              </div>
              <Switch checked disabled aria-label={t('cookieConsent.necessary')} />
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{t('cookieConsent.analytics')}</p>
                <p className="text-xs text-muted-foreground">{t('cookieConsent.analyticsDesc')}</p>
              </div>
              <Switch
                checked={prefs.analytics}
                onCheckedChange={(v) => setPrefs((p) => ({ ...p, analytics: v }))}
                aria-label={t('cookieConsent.analytics')}
              />
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{t('cookieConsent.marketing')}</p>
                <p className="text-xs text-muted-foreground">{t('cookieConsent.marketingDesc')}</p>
              </div>
              <Switch
                checked={prefs.marketing}
                onCheckedChange={(v) => setPrefs((p) => ({ ...p, marketing: v }))}
                aria-label={t('cookieConsent.marketing')}
              />
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={() => persist(prefs.analytics, prefs.marketing)}>
                {t('cookieConsent.save')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}