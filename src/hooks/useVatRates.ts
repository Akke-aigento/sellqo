import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import type { VatRate, VatRateFormData, VatCategory } from "@/types/vatRate";

export const useVatRates = (countryCode?: string) => {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: vatRates = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["vat-rates", currentTenant?.id, countryCode],
    queryFn: async () => {
      let query = supabase
        .from("vat_rates")
        .select("*")
        .or(`tenant_id.is.null,tenant_id.eq.${currentTenant?.id}`)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (countryCode) {
        query = query.eq("country_code", countryCode);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Map the database response to our VatRate type
      return (data || []).map(item => ({
        ...item,
        category: item.category as VatCategory,
      })) as VatRate[];
    },
    enabled: !!currentTenant?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (formData: VatRateFormData) => {
      if (!currentTenant?.id) throw new Error("Geen tenant geselecteerd");

      const { data, error } = await supabase
        .from("vat_rates")
        .insert({
          tenant_id: currentTenant.id,
          country_code: formData.country_code,
          rate: formData.rate,
          category: formData.category,
          name_nl: formData.name_nl,
          name_en: formData.name_en,
          name_fr: formData.name_fr,
          name_de: formData.name_de,
          is_default: formData.is_default,
          is_active: formData.is_active,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vat-rates"] });
      toast({
        title: "BTW-tarief aangemaakt",
        description: "Het BTW-tarief is succesvol toegevoegd.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Fout bij aanmaken",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data: formData,
    }: {
      id: string;
      data: Partial<VatRateFormData>;
    }) => {
      const { data, error } = await supabase
        .from("vat_rates")
        .update({
          country_code: formData.country_code,
          rate: formData.rate,
          category: formData.category,
          name_nl: formData.name_nl,
          name_en: formData.name_en,
          name_fr: formData.name_fr,
          name_de: formData.name_de,
          is_default: formData.is_default,
          is_active: formData.is_active,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vat-rates"] });
      toast({
        title: "BTW-tarief bijgewerkt",
        description: "De wijzigingen zijn opgeslagen.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Fout bij bijwerken",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("vat_rates")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vat-rates"] });
      toast({
        title: "BTW-tarief verwijderd",
        description: "Het BTW-tarief is verwijderd.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Fout bij verwijderen",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getDefaultVatRate = (countryCode: string): VatRate | undefined => {
    return vatRates.find(
      (r) => r.country_code === countryCode && r.is_default
    );
  };

  const getVatRatesByCountry = (countryCode: string): VatRate[] => {
    return vatRates.filter((r) => r.country_code === countryCode);
  };

  return {
    vatRates,
    isLoading,
    error,
    createVatRate: createMutation.mutateAsync,
    updateVatRate: updateMutation.mutateAsync,
    deleteVatRate: deleteMutation.mutateAsync,
    getDefaultVatRate,
    getVatRatesByCountry,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};
