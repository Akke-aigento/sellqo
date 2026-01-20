import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useToast } from './use-toast';
import type { ProductFile } from '@/types/product';

export function useProductFiles(productId: string | undefined) {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const filesQuery = useQuery({
    queryKey: ['product-files', productId],
    queryFn: async () => {
      if (!productId || !currentTenant) return [];

      const { data, error } = await supabase
        .from('product_files')
        .select('*')
        .eq('product_id', productId)
        .eq('tenant_id', currentTenant.id)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as ProductFile[];
    },
    enabled: !!productId && !!currentTenant,
  });

  const uploadFile = useMutation({
    mutationFn: async ({ file, isPreview = false }: { file: File; isPreview?: boolean }) => {
      if (!currentTenant || !productId) throw new Error('Missing tenant or product');

      // Upload to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentTenant.id}/${productId}/${Date.now()}-${file.name}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('digital-products')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get current max sort order
      const { data: existingFiles } = await supabase
        .from('product_files')
        .select('sort_order')
        .eq('product_id', productId)
        .order('sort_order', { ascending: false })
        .limit(1);

      const nextSortOrder = existingFiles && existingFiles.length > 0 
        ? (existingFiles[0].sort_order || 0) + 1 
        : 0;

      // Create database record
      const { data: fileRecord, error: dbError } = await supabase
        .from('product_files')
        .insert({
          product_id: productId,
          tenant_id: currentTenant.id,
          file_name: file.name,
          file_path: uploadData.path,
          file_size: file.size,
          file_type: file.type,
          is_preview: isPreview,
          sort_order: nextSortOrder,
        })
        .select()
        .single();

      if (dbError) throw dbError;
      return fileRecord as ProductFile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-files', productId] });
      toast({ title: 'Bestand geüpload' });
    },
    onError: (error: Error) => {
      toast({ title: 'Upload mislukt', description: error.message, variant: 'destructive' });
    },
  });

  const updateFile = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ProductFile> }) => {
      const { error } = await supabase
        .from('product_files')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-files', productId] });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  const deleteFile = useMutation({
    mutationFn: async (fileId: string) => {
      // Get file path first
      const { data: file } = await supabase
        .from('product_files')
        .select('file_path')
        .eq('id', fileId)
        .single();

      if (file?.file_path) {
        // Delete from storage
        await supabase.storage
          .from('digital-products')
          .remove([file.file_path]);
      }

      // Delete database record
      const { error } = await supabase
        .from('product_files')
        .delete()
        .eq('id', fileId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-files', productId] });
      toast({ title: 'Bestand verwijderd' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  return {
    files: filesQuery.data || [],
    isLoading: filesQuery.isLoading,
    uploadFile,
    updateFile,
    deleteFile,
    refetch: filesQuery.refetch,
  };
}
