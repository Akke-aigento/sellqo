import { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useImageUpload } from '@/hooks/useImageUpload';

interface BrandingUploaderProps {
  logoUrl: string | null;
  faviconUrl: string | null;
  onLogoChange: (url: string | null) => void;
  onFaviconChange: (url: string | null) => void;
}

export function BrandingUploader({ 
  logoUrl, 
  faviconUrl, 
  onLogoChange, 
  onFaviconChange 
}: BrandingUploaderProps) {
  const { uploadImage, uploading } = useImageUpload();
  const [uploadingType, setUploadingType] = useState<'logo' | 'favicon' | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File, type: 'logo' | 'favicon') => {
    setUploadingType(type);
    const url = await uploadImage(file, 'tenant-logos', `${type}/${Date.now()}`);
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
  };

  const handleFaviconSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file, 'favicon');
  };

  return (
    <div className="space-y-6">
      {/* Logo Upload */}
      <div className="space-y-3">
        <Label>Logo</Label>
        <div className="flex items-start gap-4">
          <div className="relative h-24 w-48 rounded-lg border-2 border-dashed bg-muted/30 flex items-center justify-center overflow-hidden">
            {logoUrl ? (
              <>
                <img 
                  src={logoUrl} 
                  alt="Logo preview" 
                  className="h-full w-full object-contain p-2" 
                />
                <button
                  onClick={() => onLogoChange(null)}
                  className="absolute top-1 right-1 p-1 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  <X className="h-3 w-3" />
                </button>
              </>
            ) : (
              <div className="text-center text-muted-foreground">
                <ImageIcon className="h-8 w-8 mx-auto mb-1 opacity-50" />
                <span className="text-xs">Geen logo</span>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoSelect}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={uploading && uploadingType === 'logo'}
              onClick={() => logoInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploadingType === 'logo' ? 'Uploaden...' : 'Upload Logo'}
            </Button>
            <p className="text-xs text-muted-foreground">
              Aanbevolen: 400x100px, PNG of SVG
            </p>
          </div>
        </div>
      </div>

      {/* Favicon Upload */}
      <div className="space-y-3">
        <Label>Favicon</Label>
        <div className="flex items-start gap-4">
          <div className="relative h-16 w-16 rounded-lg border-2 border-dashed bg-muted/30 flex items-center justify-center overflow-hidden">
            {faviconUrl ? (
              <>
                <img 
                  src={faviconUrl} 
                  alt="Favicon preview" 
                  className="h-full w-full object-contain p-1" 
                />
                <button
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
              variant="outline"
              size="sm"
              disabled={uploading && uploadingType === 'favicon'}
              onClick={() => faviconInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploadingType === 'favicon' ? 'Uploaden...' : 'Upload Favicon'}
            </Button>
            <p className="text-xs text-muted-foreground">
              32x32px of 64x64px, PNG of ICO
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
