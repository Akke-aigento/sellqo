import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { DEFAULT_LANG, isLangCode, type LangCode } from '@/i18n/languages';

/** Frontend mirror of getTenantBrand() in supabase/functions/_shared/tenantEmail.ts. */
export interface TenantBrandInfo {
  tenantId: string;
  tenantName: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  headingFont: string;
  defaultLocale: LangCode;
}

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const URL_RE = /^https?:\/\//i;

const FALLBACK_LOGO = 'https://sellqo.app/lovable-uploads/sellqo-logo.png';
const FALLBACK_PRIMARY = '#0F766E';
const FALLBACK_ACCENT = '#14B8A6';

function color(v: unknown, fb: string) {
  return typeof v === 'string' && HEX_RE.test(v.trim()) ? v.trim() : fb;
}
function url(v: unknown, fb: string) {
  return typeof v === 'string' && URL_RE.test(v.trim()) ? v.trim() : fb;
}
function locale(v: unknown): TenantBrandInfo['defaultLocale'] {
  const s = String(v || '').toLowerCase().slice(0, 2);
  return isLangCode(s) ? s : DEFAULT_LANG;
}

export function useTenantBrand() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery<TenantBrandInfo | null>({
    queryKey: ['tenant-brand', tenantId],
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!tenantId) return null;
      const [{ data: tenantRow }, { data: themeRow }] = await Promise.all([
        supabase
          .from('tenants')
          .select('id, name, primary_color, logo_url, language')
          .eq('id', tenantId)
          .maybeSingle(),
        supabase
          .from('tenant_theme_settings')
          .select('logo_url, primary_color, accent_color, brand_color, heading_font')
          .eq('tenant_id', tenantId)
          .maybeSingle(),
      ]);

      const t: any = tenantRow || {};
      const th: any = themeRow || {};

      return {
        tenantId,
        tenantName: (t.name && String(t.name).trim()) || 'SellQo',
        logoUrl: url(th.logo_url || t.logo_url, FALLBACK_LOGO),
        primaryColor: color(th.primary_color || t.primary_color, FALLBACK_PRIMARY),
        accentColor: color(th.accent_color || th.brand_color || th.primary_color || t.primary_color, FALLBACK_ACCENT),
        headingFont: (typeof th.heading_font === 'string' && th.heading_font) || 'Inter',
        defaultLocale: locale(t.language),
      };
    },
  });
}

/**
 * Substitute {{tenant_logo}} / {{brand_primary_color}} / customer sample
 * values in preview HTML so the admin sees the real branding.
 */
export function applyPreviewVariables(
  html: string,
  brand: TenantBrandInfo | null | undefined,
  extras: Record<string, string> = {},
): string {
  if (!html) return '';
  const logoImg = brand?.logoUrl
    ? `<img src="${brand.logoUrl}" alt="${brand.tenantName}" style="height:44px;width:auto;display:block;border:0;outline:none;" />`
    : '';
  const map: Record<string, string> = {
    tenant_logo: logoImg,
    tenant_logo_url: brand?.logoUrl || '',
    brand_primary_color: brand?.primaryColor || '',
    brand_accent_color: brand?.accentColor || '',
    brand_heading_font: brand?.headingFont || 'Inter',
    company_name: brand?.tenantName || '',
    customer_name: 'Jan Peeters',
    customer_first_name: 'Jan',
    customer_last_name: 'Peeters',
    customer_email: 'jan.peeters@voorbeeld.be',
    customer_phone: '+32 470 12 34 56',
    customer_company: 'Peeters BV',
    customer_city: 'Antwerpen',
    customer_country: 'BE',
    total_orders: '3',
    total_spent: '€ 249,00',
    current_date: new Date().toLocaleDateString('nl-BE', { dateStyle: 'long' }),
    subject: 'Voorbeeldonderwerp',
    unsubscribe_url: '#',
    ...extras,
  };
  return html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) =>
    Object.prototype.hasOwnProperty.call(map, key) ? map[key] : '',
  );
}