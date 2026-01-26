import { useState, useCallback } from 'react';
import { ImageIcon, ArrowRight, ArrowLeft, Upload, X, Loader2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { OnboardingTooltip } from '../OnboardingTooltip';
import { OnboardingData } from '@/hooks/useOnboarding';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface LogoUploadStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
  onPrev: () => void;
  tenantId: string | null;
}

export function LogoUploadStep({
  data,
  updateData,
  onNext,
  onPrev,
  tenantId,
}: LogoUploadStepProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file || !tenantId) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${tenantId}/logo.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('tenant-assets')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
        .from('tenant-assets')
        .getPublicUrl(fileName);

      updateData({ logoUrl: publicUrl.publicUrl });

      // Also update tenant in database
      await supabase
        .from('tenants')
        .update({ logo_url: publicUrl.publicUrl })
        .eq('id', tenantId);

    } catch (error: any) {
      console.error('Upload error:', error);
      setUploadError(error.message || 'Upload mislukt');
    } finally {
      setIsUploading(false);
    }
  }, [tenantId, updateData]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.svg'],
    },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024, // 5MB
  });

  const removeLogo = () => {
    updateData({ logoUrl: null });
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <ImageIcon className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Upload je logo</h2>
        <div className="flex items-center justify-center gap-2">
          <p className="text-muted-foreground">
            Je logo verschijnt op e-mails, facturen en je webshop.
          </p>
          <OnboardingTooltip
            title="Logo uploaden"
            content={
              <span>
                <strong>Aanbevolen formaat:</strong><br />
                200x200 pixels of groter<br />
                PNG, JPG of SVG<br />
                Transparante achtergrond werkt het beste
              </span>
            }
          />
        </div>
      </div>

      <div className="space-y-4">
        {data.logoUrl ? (
          <div className="relative mx-auto w-48 h-48">
            <img
              src={data.logoUrl}
              alt="Jouw logo"
              className="w-full h-full object-contain rounded-lg border bg-muted p-4"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute -top-2 -right-2 h-8 w-8 rounded-full"
              onClick={removeLogo}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div
            {...getRootProps()}
            className={cn(
              'mx-auto max-w-md border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
              isDragActive && 'border-primary bg-primary/5',
              !isDragActive && 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
            )}
          >
            <input {...getInputProps()} />
            {isUploading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Uploaden...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">
                    {isDragActive ? 'Laat los om te uploaden' : 'Sleep je logo hierheen'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    of klik om een bestand te selecteren
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  PNG, JPG, WEBP of SVG (max. 5MB)
                </p>
              </div>
            )}
          </div>
        )}

        {uploadError && (
          <p className="text-center text-sm text-destructive">{uploadError}</p>
        )}
      </div>

      <div className="flex gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onPrev}
          className="flex-1"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Vorige
        </Button>
        <Button
          type="button"
          onClick={onNext}
          className="flex-1"
        >
          {data.logoUrl ? 'Volgende stap' : 'Overslaan voor nu'}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
