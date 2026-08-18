import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CookieBannerProps {
  style: 'minimal' | 'detailed' | 'popup';
  tenantSlug: string;
}

export interface CookieConsent {
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp: number;
}

const STORAGE_KEY = 'cookie-consent';

/** Read stored cookie consent. Returns null if not yet given. */
export function getCookieConsent(tenantSlug: string): CookieConsent | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}-${tenantSlug}`);
    if (!raw) return null;
    return JSON.parse(raw) as CookieConsent;
  } catch {
    return null;
  }
}

/** Check if a specific category is consented to */
export function hasConsent(tenantSlug: string, category: 'analytics' | 'marketing'): boolean {
  const consent = getCookieConsent(tenantSlug);
  if (!consent) return false;
  return consent[category] === true;
}

export function CookieBanner({
  const { t } = useTranslation(); style, tenantSlug }: CookieBannerProps) {
  const [visible, setVisible] = useState(false);
  const [preferences, setPreferences] = useState({
    functional: true,
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    const consent = getCookieConsent(tenantSlug);
    if (!consent) {
      setVisible(true);
    }
  }, [tenantSlug]);

  const accept = (all: boolean = true) => {
    const value: CookieConsent = all
      ? { functional: true, analytics: true, marketing: true, timestamp: Date.now() }
      : { ...preferences, timestamp: Date.now() };
    localStorage.setItem(`${STORAGE_KEY}-${tenantSlug}`, JSON.stringify(value));
    setVisible(false);

    // Dispatch custom event so other scripts can react to consent changes
    window.dispatchEvent(new CustomEvent('cookie-consent-changed', { detail: value }));
  };

  const decline = () => {
    const value: CookieConsent = { functional: true, analytics: false, marketing: false, timestamp: Date.now() };
    localStorage.setItem(`${STORAGE_KEY}-${tenantSlug}`, JSON.stringify(value));
    setVisible(false);
    window.dispatchEvent(new CustomEvent('cookie-consent-changed', { detail: value }));
  };

  if (!visible) return null;

  if (style === 'popup') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
        <div className="bg-background rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">Cookie-instellingen</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            {t('storefront.cookieBanner.wij_gebruiken_cookies_om_je_de')}
          </p>
          <div className="space-y-3 mb-6">
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" checked disabled className="rounded" />
              <span>{t('storefront.cookieBanner.functioneel_noodzakelijk')}</span>
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={preferences.analytics}
                onChange={e => setPreferences(p => ({ ...p, analytics: e.target.checked }))}
                className="rounded"
              />
              <span>{t('storefront.cookieBanner.analytisch')}</span>
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={preferences.marketing}
                onChange={e => setPreferences(p => ({ ...p, marketing: e.target.checked }))}
                className="rounded"
              />
              <span>{t('navigation.groups.marketing')}</span>
            </label>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => accept(false)} className="flex-1">
              {t('common.save')}
            </Button>
            <Button onClick={() => accept(true)} className="flex-1">
              {t('storefront.cookieBanner.alles_accepteren')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (style === 'detailed') {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-[100] bg-background border-t shadow-lg p-4">
        <div className="container mx-auto max-w-4xl">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium mb-2">Cookie-voorkeuren</p>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked disabled className="rounded" />
                  {t('storefront.cookieBanner.functioneel')}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={preferences.analytics}
                    onChange={e => setPreferences(p => ({ ...p, analytics: e.target.checked }))}
                    className="rounded"
                  />
                  {t('storefront.cookieBanner.analytisch_2')}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={preferences.marketing}
                    onChange={e => setPreferences(p => ({ ...p, marketing: e.target.checked }))}
                    className="rounded"
                  />
                  {t('navigation.groups.marketing')}
                </label>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => accept(false)}>
                {t('common.save')}
              </Button>
              <Button size="sm" onClick={() => accept(true)}>
                {t('storefront.cookieBanner.alles_accepteren_2')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Minimal style
  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] bg-background border-t shadow-lg p-3">
      <div className="container mx-auto flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {t('storefront.cookieBanner.deze_website_gebruikt_cookies_voor_een')}
        </p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={decline}>
            {t('storefront.cookieBanner.weigeren')}
          </Button>
          <Button size="sm" onClick={() => accept(true)}>
            {t('storefront.cookieBanner.accepteren')}
          </Button>
        </div>
      </div>
    </div>
  );
}