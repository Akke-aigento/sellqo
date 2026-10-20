import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { readableTextColor } from '../../../../supabase/functions/_shared/colorContrast';
import type { EmailLogoPreviewState } from '@/hooks/useLogoUpload';
import { EMAIL_LOGO_MIN_SHARP_HEIGHT } from '@/lib/emailLogo';

interface EmailLogoPreviewProps {
  /** Het logo zoals de mail het toont (variant of origineel), of null → winkelnaam. */
  logoUrl: string | null;
  shopName: string;
  primaryColor?: string | null;
  /** Gegevens van de zojuist gemaakte e-mailvariant. */
  variant?: EmailLogoPreviewState | null;
}

// Zelfde kleuren als emailBaseLayout (supabase/functions/_shared/sellqoEmail.ts) en de kop in
// renderTenantEmailHeader (tenantEmail.ts): wit logovlak, 44 px hoog, ook in dark mode wit.
const MAIL_TEXT = '#1a2332';
const SCHEMES = [
  { key: 'light', bg: '#f4f6f9', card: '#ffffff', line: '#e4e8ee' },
  { key: 'dark', bg: '#0f172a', card: '#1a2332', line: '#283449' },
] as const;

/** MAIL-LOGO-1 — hoe de kop van je mails eruitziet, licht en donker. */
export function EmailLogoPreview({ logoUrl, shopName, primaryColor, variant }: EmailLogoPreviewProps) {
  const { t } = useTranslation();
  const nameColor = readableTextColor(primaryColor, '#ffffff', MAIL_TEXT, 3);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{t('settings.emailLogo.previewTitle')}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {SCHEMES.map((s) => (
          <figure key={s.key} className="m-0 space-y-1">
            <div className="rounded-lg border p-4" style={{ backgroundColor: s.bg }}>
              <div className="flex justify-center">
                <div className="rounded-[10px] bg-white px-5 py-3">
                  {logoUrl ? (
                    <img src={logoUrl} alt={shopName} className="mx-auto block h-[44px] w-auto max-w-none" />
                  ) : (
                    <span
                      className="block py-2 text-center text-[22px] font-bold leading-7"
                      style={{ color: nameColor }}
                    >
                      {shopName}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-4 space-y-2 rounded-md p-3" style={{ backgroundColor: s.card }} aria-hidden="true">
                <div className="h-2 w-2/3 rounded" style={{ backgroundColor: s.line }} />
                <div className="h-2 w-full rounded" style={{ backgroundColor: s.line }} />
                <div className="h-2 w-5/6 rounded" style={{ backgroundColor: s.line }} />
              </div>
            </div>
            <figcaption className="text-xs text-muted-foreground">
              {s.key === 'light' ? t('settings.emailLogo.previewLight') : t('settings.emailLogo.previewDark')}
            </figcaption>
          </figure>
        ))}
      </div>
      {variant && variant.result === 'saved' && (
        <p className="text-xs text-muted-foreground">
          {t('settings.emailLogo.variantInfo', {
            width: variant.width,
            height: variant.height,
            kb: Math.max(1, Math.round(variant.bytes / 1024)),
          })}
        </p>
      )}
      {variant && variant.result === 'skipped_theme_logo' && (
        <p className="text-xs text-muted-foreground">{t('settings.emailLogo.themeLogoWins')}</p>
      )}
      {variant?.blurry && (
        <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {t('settings.emailLogo.blurryWarning', { height: EMAIL_LOGO_MIN_SHARP_HEIGHT })}
        </p>
      )}
      {!logoUrl && <p className="text-xs text-muted-foreground">{t('settings.emailLogo.noLogoName')}</p>}
    </div>
  );
}
