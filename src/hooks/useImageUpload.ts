import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useToast } from './use-toast';

type BucketName = 'product-images' | 'tenant-logos' | 'invoices' | 'ai-images' | 'marketing-assets';

const IMAGE_EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  avif: 'image/avif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
};

const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20MB — modern phone photos can be 5-15MB

export function useImageUpload() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const uploadImage = async (
    file: File, 
    bucket: BucketName = 'product-images',
    customPath?: string
  ): Promise<string | null> => {
    if (!currentTenant) {
      toast({ title: 'Fout', description: 'Geen winkel geselecteerd', variant: 'destructive' });
      return null;
    }

    // Validate file type — Android often returns file.type === '' for content:// URIs,
    // so we fall back to the extension. Reject only when clearly non-image.
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const extMime = IMAGE_EXT_MIME[ext];
    const isImageMime = file.type.startsWith('image/');
    const isAcceptable = isImageMime || (file.type === '' && !!extMime);
    if (!isAcceptable) {
      toast({
        title: 'Ongeldig bestandstype',
        description: `${file.name}: alleen afbeeldingen (JPG, PNG, WebP, HEIC, GIF, AVIF) zijn toegestaan.`,
        variant: 'destructive',
        duration: 8000,
      });
      return null;
    }

    // Validate file size (20MB)
    if (file.size > MAX_IMAGE_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      toast({
        title: 'Bestand te groot',
        description: `${file.name} is ${mb} MB. Maximum is 20 MB — verklein de foto en probeer opnieuw.`,
        variant: 'destructive',
        duration: 8000,
      });
      return null;
    }

    setUploading(true);
    setProgress(0);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = customPath 
        ? `${customPath}.${fileExt}`
        : `${currentTenant.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Android often delivers file.type === '' — provide an explicit contentType
      // so Supabase Storage doesn't store the object as application/octet-stream
      // (which breaks <img src> rendering downstream).
      const contentType = file.type || extMime || 'application/octet-stream';

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true, // Allow overwriting for logos
          contentType,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      setProgress(100);
      return publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      toast({ 
        title: 'Upload mislukt', 
        description: `${file.name}: ${error instanceof Error ? error.message : 'Onbekende fout'}`,
        variant: 'destructive',
        duration: 8000,
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const deleteImage = async (url: string): Promise<boolean> => {
    try {
      // Extract path from URL
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      const bucketIndex = pathParts.indexOf('product-images');
      if (bucketIndex === -1) return false;
      
      const filePath = pathParts.slice(bucketIndex + 1).join('/');

      const { error } = await supabase.storage
        .from('product-images')
        .remove([filePath]);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Delete error:', error);
      toast({ 
        title: 'Verwijderen mislukt', 
        description: error instanceof Error ? error.message : 'Onbekende fout', 
        variant: 'destructive' 
      });
      return false;
    }
  };

  return {
    uploadImage,
    deleteImage,
    uploading,
    progress,
  };
}
