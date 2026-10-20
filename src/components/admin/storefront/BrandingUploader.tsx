import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useImageUpload } from '@/hooks/useImageUpload';
import { useLogoUpload } from '@/hooks/useLogoUpload';
import { useTenant } from '@/hooks/useTenant';
import { EMAIL_LOGO_ACCEPT } from '@/lib/emailLogo';
import { EmailLogoPreview } from '@/components/admin/settings/EmailLogoPreview';

interface BrandingUploaderProps {
  logoUrl: string | null;
  faviconUrl: string | null;
  onLogoChange: (url: string | null) => void;
  onFaviconChange: (url: string | null) => void;
  /** Voor de mailvoorbeeldweergave zonder logo (naam in de primaire kleur). */
  primaryColor?: string | null;
}

export function BrandingUploader({ 
  logoUrl, 
  faviconUrl, 
  onLogoChange, 
  onFaviconChange,
  primaryColor,
}: BrandingUploaderProps) {
  const { t } = useTranslation();
  const { uploadImage, uploading } = useImageUpload();
  // MAIL-LOGO-1: het logo krijgt bij elke upload een e-mailvariant (tenants.email_logo_url).
  const { uploadLogo, uploading: logoUploading, emailPreview, clearEmailPreview } = useLogoUpload();
  const { currentTenant } = useTenant();
  const [uploadingType, setUploadingType] = useState<'logo' | 'favicon' | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File, type: 'logo' | 'favicon') => {
    if (!currentTenant) return;
    setUploadingType(type);
    const path = `${currentTenant.id}/${type}/${Date.now()}`;
    const url = type === 'logo'
      ? await uploadLogo(file, path, 'theme')
      : await uploadImage(file, 'tenant-logos', path);
    if (url) {
      if (type === 'logo') {
        onLogoChange(url);
      } else {
        onFaviconChange(url);
      }
    }
    setUploadingType(null);
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file, 'logo');
    e.target.value = '';
  };

  const handleFaviconSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file, 'favicon');
  };

  return (
    <div className="space-y-6">
      {/* Logo Upload */}
      <div className="space-y-3">
        <Label>{t('settings.logoUpload.logo')}</Label>
        <div className="flex items-start gap-4">
          <div className="relative h-24 w-48 rounded-lg border-2 border-dashed bg-muted/30 flex items-center justify-center overflow-hidden">
            {logoUrl ? (
              <>
                <img 
                  src={logoUrl} 
                  alt={t('settings.logoUpload.logoAlt')}
                  className="h-full w-full object-contain p-2" 
                />
                <button
                  type="button"
                  aria-label={t('settings.logoUpload.removeLogo')}
                  onClick={() => { clearEmailPreview(); onLogoChange(null); }}
                  className="absolute top-1 right-1 p-1 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  <X className="h-3 w-3" />
                </button>
              </>
            ) : (
              <div className="text-center text-muted-foreground">
                <ImageIcon className="h-8 w-8 mx-auto mb-1 opacity-50" />
                <span className="text-xs">{t('settings.logoUpload.noLogo')}</span>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <input
              ref={logoInputRef}
              type="file"
              accept={EMAIL_LOGO_ACCEPT}
              className="hidden"
              onChange={handleLogoSelect}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={logoUploading && uploadingType === 'logo'}
              onClick={() => logoInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploadingType === 'logo' ? t('settings.logoUpload.uploading') : t('settings.logoUpload.uploadLogo')}
            </Button>
            <p className="text-xs text-muted-foreground">
              {t('settings.logoUpload.logoHint')}
            </p>
          </div>
        </div>
        <EmailLogoPreview
          logoUrl={emailPreview?.previewUrl ?? logoUrl ?? currentTenant?.logo_url ?? null}
          shopName={currentTenant?.name || ''}
          primaryColor={primaryColor}
          variant={emailPreview}
        />
      </div>

      {/* Favicon Upload */}
      <div className="space-y-3">
        <Label>{t('settings.logoUpload.favicon')}</Label>
        <div className="flex items-start gap-4">
          <div className="relative h-16 w-16 rounded-lg border-2 border-dashed bg-muted/30 flex items-center justify-center overflow-hidden">
            {faviconUrl ? (
              <>
                <img 
                  src={faviconUrl} 
                  alt={t('settings.logoUpload.faviconAlt')}
                  className="h-full w-full object-contain p-1" 
                />
                <button
                  type="button"
                  aria-label={t('settings.logoUpload.removeFavicon')}
                  onClick={() => onFaviconChange(null)}
                  className="absolute -top-1 -right-1 p-1 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  <X className="h-3 w-3" />
                </button>
              </>
            ) : (
              <div className="text-center text-muted-foreground">
                <ImageIcon className="h-5 w-5 opacity-50" />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <input
              ref={faviconInputRef}
              type="file"
              accept="image/png,image/x-icon,image/svg+xml"
              className="hidden"
              onChange={handleFaviconSelect}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading && uploadingType === 'favicon'}
              onClick={() => faviconInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploadingType === 'favicon' ? t('settings.logoUpload.uploading') : t('settings.logoUpload.uploadFavicon')}
            </Button>
            <p className="text-xs text-muted-foreground">
              {t('settings.logoUpload.faviconHint')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
