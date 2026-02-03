import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import type { 
  ImportJob, 
  ImportCategoryMapping, 
  ImportOptions,
  FieldMapping,
  ImportDataType,
  ImportPlatform 
} from '@/types/import';

export function useImportJobs() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const importJobsQuery = useQuery({
    queryKey: ['import-jobs', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      
      const { data, error } = await supabase
        .from('import_jobs')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as unknown as ImportJob[];
    },
    enabled: !!currentTenant?.id,
  });

  const createImportJob = useMutation({
    mutationFn: async (job: {
      source_platform: ImportPlatform;
      data_type: ImportDataType;
      file_name?: string;
      mapping?: FieldMapping;
      options?: ImportOptions;
      total_rows?: number;
    }) => {
      if (!currentTenant?.id) throw new Error('No tenant selected');
      
      const { data, error } = await supabase
        .from('import_jobs')
        .insert([{
          tenant_id: currentTenant.id,
          source_platform: job.source_platform,
          data_type: job.data_type,
          file_name: job.file_name,
          mapping: job.mapping ? JSON.parse(JSON.stringify(job.mapping)) : null,
          options: job.options ? JSON.parse(JSON.stringify(job.options)) : null,
          total_rows: job.total_rows,
          status: 'pending',
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data as unknown as ImportJob;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-jobs'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateImportJob = useMutation({
    mutationFn: async ({ 
      id, 
      ...updates 
    }: Partial<ImportJob> & { id: string }) => {
      const updateData: Record<string, unknown> = { ...updates };
      if (updates.mapping) updateData.mapping = JSON.parse(JSON.stringify(updates.mapping));
      if (updates.options) updateData.options = JSON.parse(JSON.stringify(updates.options));
      if (updates.errors) updateData.errors = JSON.parse(JSON.stringify(updates.errors));
      
      const { data, error } = await supabase
        .from('import_jobs')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as unknown as ImportJob;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-jobs'] });
    },
  });

  return {
    importJobs: importJobsQuery.data || [],
    isLoading: importJobsQuery.isLoading,
    createImportJob,
    updateImportJob,
  };
}

export function useImportCategoryMappings(importJobId: string | undefined) {
  const queryClient = useQueryClient();

  const mappingsQuery = useQuery({
    queryKey: ['import-category-mappings', importJobId],
    queryFn: async () => {
      if (!importJobId) return [];
      
      const { data, error } = await supabase
        .from('import_category_mappings')
        .select('*')
        .eq('import_job_id', importJobId);
      
      if (error) throw error;
      return data as ImportCategoryMapping[];
    },
    enabled: !!importJobId,
  });

  const createCategoryMappings = useMutation({
    mutationFn: async (mappings: Omit<ImportCategoryMapping, 'id' | 'created_at'>[]) => {
      const { data, error } = await supabase
        .from('import_category_mappings')
        .insert(mappings)
        .select();
      
      if (error) throw error;
      return data as ImportCategoryMapping[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-category-mappings'] });
    },
  });

  const updateCategoryMapping = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ImportCategoryMapping> & { id: string }) => {
      const { data, error } = await supabase
        .from('import_category_mappings')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as ImportCategoryMapping;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-category-mappings'] });
    },
  });

  return {
    categoryMappings: mappingsQuery.data || [],
    isLoading: mappingsQuery.isLoading,
    createCategoryMappings,
    updateCategoryMapping,
  };
}

// Parse CSV file with robust multi-line support
export async function parseCSV(file: File): Promise<{
  headers: string[];
  rows: Record<string, string>[];
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        let text = e.target?.result as string;
        
        // Remove BOM if present
        if (text.charCodeAt(0) === 0xFEFF) {
          text = text.slice(1);
        }
        
        // Parse using state machine - handles multi-line quoted values
        const allRows: string[][] = [];
        let currentRow: string[] = [];
        let currentCell = '';
        let inQuotes = false;
        
        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          const nextChar = text[i + 1];
          
          if (char === '"') {
            if (inQuotes && nextChar === '"') {
              // Escaped quote ("") - add single quote and skip next
              currentCell += '"';
              i++;
            } else {
              // Toggle quote mode
              inQuotes = !inQuotes;
            }
          } else if ((char === ',' || char === ';') && !inQuotes) {
            // End of cell (delimiter outside quotes)
            currentRow.push(currentCell.trim());
            currentCell = '';
          } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
            // End of row (newline outside quotes)
            if (char === '\r') i++; // Skip \n in \r\n
            currentRow.push(currentCell.trim());
            if (currentRow.length > 0 && currentRow.some(c => c)) {
              allRows.push(currentRow);
            }
            currentRow = [];
            currentCell = '';
          } else if (char === '\r' && !inQuotes) {
            // Mac-style line ending (just \r)
            currentRow.push(currentCell.trim());
            if (currentRow.length > 0 && currentRow.some(c => c)) {
              allRows.push(currentRow);
            }
            currentRow = [];
            currentCell = '';
          } else {
            // Regular character - add to current cell
            currentCell += char;
          }
        }
        
        // Push final cell/row if exists
        if (currentCell || currentRow.length > 0) {
          currentRow.push(currentCell.trim());
          if (currentRow.some(c => c)) {
            allRows.push(currentRow);
          }
        }
        
        if (allRows.length < 2) {
          reject(new Error('File must have at least a header row and one data row'));
          return;
        }
        
        // First row is headers
        const headers = allRows[0];
        
        // Convert remaining rows to objects
        const rows: Record<string, string>[] = [];
        for (let i = 1; i < allRows.length; i++) {
          const values = allRows[i];
          const row: Record<string, string> = {};
          headers.forEach((header, idx) => {
            row[header] = values[idx] || '';
          });
          rows.push(row);
        }
        
        resolve({ headers, rows });
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
