import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useToast } from './use-toast';

type BucketName = 'product-images' | 'tenant-logos' | 'invoices' | 'ai-images' | 'marketing-assets';

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

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast({ 
        title: 'Ongeldig bestandstype', 
        description: 'Alleen JPG, PNG, WebP en GIF zijn toegestaan', 
        variant: 'destructive' 
      });
      return null;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({ 
        title: 'Bestand te groot', 
        description: 'Maximum bestandsgrootte is 5MB', 
        variant: 'destructive' 
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

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true, // Allow overwriting for logos
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
        description: error instanceof Error ? error.message : 'Onbekende fout', 
        variant: 'destructive' 
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
