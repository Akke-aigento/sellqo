import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useImageUpload } from '@/hooks/useImageUpload';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import {
  createEmailLogoVariant,
  emailLogoPath,
  EmailLogoError,
  type EmailLogoVariant,
} from '@/lib/emailLogo';

/**
 * MAIL-LOGO-1 — waar het logo opgeslagen wordt:
 *   • 'theme'  → tenant_theme_settings.logo_url (Branding, webshopthema). Dat logo gaat voor in mails.
 *   • 'tenant' → tenants.logo_url (Bedrijfsgegevens, onboarding). Enkel in mails zonder themalogo.
 */
export type LogoTarget = 'theme' | 'tenant';

/**
 * - saved: variant opgeslagen, de mail toont die.
 * - failed: van dit bestand kon geen mailversie gemaakt worden (onleesbaar voor de browser, bv.
 *   HEIC, of wit/leeg). Het origineel is wél geüpload; de mail toont de winkelnaam.
 * - skipped_theme_logo: bedrijfslogo terwijl er een themalogo is; dat blijft het mail-logo.
 * - save_error: opslaan mislukte (rechten, netwerk); de mail toont voorlopig het origineel.
 */
export type EmailVariantResult = 'saved' | 'failed' | 'skipped_theme_logo' | 'save_error';

/**
 * Uploadt de e-mailvariant naar tenant-logos/<tenant>/email-logo-<hash>.png en zet
 * tenants.email_logo_url + email_logo_source_url. Zonder variant (`null`) wordt enkel de bron
 * gezet met een lege variant: getTenantBrand toont dan de winkelnaam i.p.v. een gebroken of
 * onzichtbaar beeld. Schrijft niets voor een bedrijfslogo als er een themalogo bestaat.
 * RLS: dezelfde rechten als het logo zelf (tenant-logos-policies, UPDATE op tenants voor tenant_admin).
 */
export async function saveEmailLogoVariant(
  tenantId: string,
  variant: EmailLogoVariant | null,
  sourceUrl: string,
  target: LogoTarget,
): Promise<EmailVariantResult> {
  try {
    if (target === 'tenant') {
      const { data } = await supabase
        .from('tenant_theme_settings')
        .select('logo_url')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      const themeLogo = typeof data?.logo_url === 'string' ? data.logo_url.trim() : '';
      if (themeLogo) return 'skipped_theme_logo';
    }
    let publicUrl: string | null = null;
    if (variant) {
      const path = emailLogoPath(tenantId, variant.hash);
      const { error: upErr } = await supabase.storage.from('tenant-logos').upload(path, variant.blob, {
        // De naam bevat de hash van de inhoud: een nieuwe variant krijgt altijd een nieuwe URL.
        cacheControl: '31536000',
        upsert: true,
        contentType: 'image/png',
      });
      if (upErr) throw upErr;
      publicUrl = supabase.storage.from('tenant-logos').getPublicUrl(path).data.publicUrl;
    }
    const { error: dbErr } = await supabase
      .from('tenants')
      .update({ email_logo_url: publicUrl, email_logo_source_url: sourceUrl })
      .eq('id', tenantId);
    if (dbErr) throw dbErr;
    return variant ? 'saved' : 'failed';
  } catch (e) {
    console.error('[emailLogo] variant opslaan mislukt', e);
    return 'save_error';
  }
}

export interface EmailLogoPreviewState {
  /** Object-URL van de zojuist gemaakte variant, of null als er geen variant is. */
  previewUrl: string | null;
  width: number;
  height: number;
  bytes: number;
  blurry: boolean;
  /** Waarom er geen variant is: onleesbaar voor de browser, of wit/leeg. */
  reason: 'unreadable' | 'blank' | null;
  result: EmailVariantResult;
}

/**
 * Logo uploaden mét e-mailvariant. Het origineel gaat altijd ongewijzigd via useImageUpload
 * (storefront), ook als er geen mailversie van te maken is (MAIL-LOGO-1 review).
 */
export function useLogoUpload() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const { uploadImage, uploading } = useImageUpload();
  const [emailPreview, setEmailPreview] = useState<EmailLogoPreviewState | null>(null);

  useEffect(() => () => {
    if (emailPreview?.previewUrl) URL.revokeObjectURL(emailPreview.previewUrl);
  }, [emailPreview]);

  const uploadLogo = async (file: File, path: string, target: LogoTarget): Promise<string | null> => {
    if (!currentTenant) return null;
    const url = await uploadImage(file, 'tenant-logos', path);
    if (!url) return null;

    let variant: EmailLogoVariant | null = null;
    let reason: EmailLogoPreviewState['reason'] = null;
    try {
      variant = await createEmailLogoVariant(file);
    } catch (e) {
      reason = e instanceof EmailLogoError && e.code === 'blank' ? 'blank' : 'unreadable';
      console.warn('[emailLogo] geen mailversie', e);
    }
    const result = await saveEmailLogoVariant(currentTenant.id, variant, url, target);
    if (result === 'failed') {
      toast({
        title: t('settings.emailLogo.noVariantTitle'),
        description: reason === 'blank' ? t('settings.emailLogo.blankWarning') : t('settings.emailLogo.noVariantBody'),
      });
    } else if (result === 'save_error') {
      toast({
        title: t('settings.emailLogo.variantFailedTitle'),
        description: t('settings.emailLogo.variantFailedBody'),
      });
    }
    setEmailPreview({
      previewUrl: variant ? URL.createObjectURL(variant.blob) : null,
      width: variant?.width ?? 0,
      height: variant?.height ?? 0,
      bytes: variant?.bytes ?? 0,
      blurry: variant?.blurry ?? false,
      reason,
      result,
    });
    return url;
  };

  return { uploadLogo, uploading, emailPreview, clearEmailPreview: () => setEmailPreview(null) };
}
