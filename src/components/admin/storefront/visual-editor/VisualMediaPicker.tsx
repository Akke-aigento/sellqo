import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { ImagePlus, Upload, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface VisualMediaPickerProps {
  value?: string;
  onSelect: (url: string) => void;
  aspectRatio?: 'video' | 'square' | 'portrait';
  className?: string;
  placeholder?: string;
}

export function VisualMediaPicker({
  value,
  onSelect,
  aspectRatio = 'video',
  className,
  placeholder = 'Klik om afbeelding te kiezen',
}: VisualMediaPickerProps) {
  const { currentTenant } = useTenant();
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = useCallback(async (file: File) => {
    if (!currentTenant?.id) {
      toast.error('Geen tenant geselecteerd');
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentTenant.id}/storefront/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('tenant-assets')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('tenant-assets')
        .getPublicUrl(fileName);

      onSelect(publicUrl);
      setIsOpen(false);
      toast.success('Afbeelding geüpload');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Fout bij uploaden');
    } finally {
      setIsUploading(false);
    }
  }, [currentTenant?.id, onSelect]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      handleUpload(acceptedFiles[0]);
    }
  }, [handleUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif'] },
    maxFiles: 1,
    disabled: isUploading,
  });

  const aspectClasses = {
    video: 'aspect-video',
    square: 'aspect-square',
    portrait: 'aspect-[3/4]',
  };

  return (
    <>
      {/* Image preview / click target */}
      <div
        onClick={() => setIsOpen(true)}
        className={cn(
          'relative cursor-pointer group overflow-hidden rounded-lg',
          aspectClasses[aspectRatio],
          !value && 'border-2 border-dashed border-muted-foreground/30 bg-muted/50',
          'hover:ring-2 hover:ring-primary hover:ring-offset-2 transition-all',
          className
        )}
      >
        {value ? (
          <>
            <img
              src={value}
              alt=""
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <ImagePlus className="h-8 w-8 text-white" />
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
            <ImagePlus className="h-8 w-8 mb-2" />
            <span className="text-sm">{placeholder}</span>
          </div>
        )}
      </div>

      {/* Media picker dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Afbeelding Kiezen</DialogTitle>
          </DialogHeader>

          {/* Drop zone */}
          <div
            {...getRootProps()}
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
              isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary',
              isUploading && 'pointer-events-none opacity-50'
            )}
          >
            <input {...getInputProps()} />
            {isUploading ? (
              <div className="flex flex-col items-center">
                <Loader2 className="h-8 w-8 animate-spin mb-2" />
                <p>Uploaden...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <Upload className="h-8 w-8 mb-2 text-muted-foreground" />
                <p className="font-medium">Sleep een afbeelding hierheen</p>
                <p className="text-sm text-muted-foreground mt-1">
                  of klik om te bladeren
                </p>
              </div>
            )}
          </div>

          {/* Current image preview */}
          {value && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">Huidige afbeelding</p>
              <div className="relative inline-block">
                <img
                  src={value}
                  alt=""
                  className="h-24 w-auto rounded border"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect('');
                    setIsOpen(false);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
