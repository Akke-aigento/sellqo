import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useImageUpload } from '@/hooks/useImageUpload';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import {
  createEmailLogoVariant,
  emailLogoPath,
  type EmailLogoVariant,
} from '@/lib/emailLogo';

/**
 * MAIL-LOGO-1 — waar het logo opgeslagen wordt:
 *   • 'theme'  → tenant_theme_settings.logo_url (Branding, webshopthema). Dat logo gaat voor in mails.
 *   • 'tenant' → tenants.logo_url (Bedrijfsgegevens, onboarding). Enkel in mails zonder themalogo.
 */
export type LogoTarget = 'theme' | 'tenant';

export type EmailVariantResult = 'saved' | 'skipped_theme_logo' | 'failed';

/**
 * Uploadt de e-mailvariant naar tenant-logos/<tenant>/email-logo-<hash>.png en zet
 * tenants.email_logo_url + email_logo_source_url. Schrijft niets voor een bedrijfslogo als er
 * een themalogo bestaat: dat themalogo blijft het logo van de mails, en zijn variant blijft staan.
 * RLS: dezelfde rechten als het logo zelf (tenant-logos-policies, UPDATE op tenants voor tenant_admin).
 */
export async function saveEmailLogoVariant(
  tenantId: string,
  variant: EmailLogoVariant,
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
    const path = emailLogoPath(tenantId, variant.hash);
    const { error: upErr } = await supabase.storage.from('tenant-logos').upload(path, variant.blob, {
      // De naam bevat de hash van de inhoud: een nieuwe variant krijgt altijd een nieuwe URL.
      cacheControl: '31536000',
      upsert: true,
      contentType: 'image/png',
    });
    if (upErr) throw upErr;
    const { data: { publicUrl } } = supabase.storage.from('tenant-logos').getPublicUrl(path);
    const { error: dbErr } = await supabase
      .from('tenants')
      .update({ email_logo_url: publicUrl, email_logo_source_url: sourceUrl })
      .eq('id', tenantId);
    if (dbErr) throw dbErr;
    return 'saved';
  } catch (e) {
    console.error('[emailLogo] variant opslaan mislukt', e);
    return 'failed';
  }
}

export interface EmailLogoPreviewState {
  /** Object-URL van de zojuist gemaakte variant. */
  previewUrl: string;
  width: number;
  height: number;
  bytes: number;
  blurry: boolean;
  result: EmailVariantResult;
}

/**
 * Logo uploaden mét e-mailvariant. Het origineel gaat ongewijzigd via useImageUpload (storefront);
 * een onleesbaar bestand wordt vóór de upload geweigerd.
 */
export function useLogoUpload() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const { uploadImage, uploading } = useImageUpload();
  const [emailPreview, setEmailPreview] = useState<EmailLogoPreviewState | null>(null);

  useEffect(() => () => {
    if (emailPreview) URL.revokeObjectURL(emailPreview.previewUrl);
  }, [emailPreview]);

  const uploadLogo = async (file: File, path: string, target: LogoTarget): Promise<string | null> => {
    if (!currentTenant) return null;
    let variant: EmailLogoVariant;
    try {
      variant = await createEmailLogoVariant(file);
    } catch (e) {
      console.error('[emailLogo] onleesbaar bestand', e);
      toast({
        title: t('settings.emailLogo.unreadableTitle'),
        description: t('settings.emailLogo.unreadableBody', { name: file.name || '' }),
        variant: 'destructive',
        duration: 8000,
      });
      return null;
    }
    const url = await uploadImage(file, 'tenant-logos', path);
    if (!url) return null;
    const result = await saveEmailLogoVariant(currentTenant.id, variant, url, target);
    if (result === 'failed') {
      toast({
        title: t('settings.emailLogo.variantFailedTitle'),
        description: t('settings.emailLogo.variantFailedBody'),
      });
    }
    setEmailPreview({
      previewUrl: URL.createObjectURL(variant.blob),
      width: variant.width,
      height: variant.height,
      bytes: variant.bytes,
      blurry: variant.blurry,
      result,
    });
    return url;
  };

  return { uploadLogo, uploading, emailPreview, clearEmailPreview: () => setEmailPreview(null) };
}
