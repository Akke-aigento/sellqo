import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import type { ShippingMethod, ShippingMethodFormData } from "@/types/shipping";

export const useShippingMethods = () => {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: shippingMethods = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["shipping-methods", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from("shipping_methods")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return data as ShippingMethod[];
    },
    enabled: !!currentTenant?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (formData: ShippingMethodFormData) => {
      if (!currentTenant?.id) throw new Error("Geen tenant geselecteerd");

      const { data, error } = await supabase
        .from("shipping_methods")
        .insert({
          tenant_id: currentTenant.id,
          name: formData.name,
          description: formData.description || null,
          price: formData.price,
          free_above: formData.free_above || null,
          estimated_days_min: formData.estimated_days_min || 1,
          estimated_days_max: formData.estimated_days_max || 3,
          is_active: formData.is_active,
          is_default: formData.is_default,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipping-methods"] });
      toast({
        title: "Verzendmethode aangemaakt",
        description: "De verzendmethode is succesvol toegevoegd.",
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
      data: Partial<ShippingMethodFormData>;
    }) => {
      const { data, error } = await supabase
        .from("shipping_methods")
        .update({
          name: formData.name,
          description: formData.description || null,
          price: formData.price,
          free_above: formData.free_above || null,
          estimated_days_min: formData.estimated_days_min,
          estimated_days_max: formData.estimated_days_max,
          is_active: formData.is_active,
          is_default: formData.is_default,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipping-methods"] });
      toast({
        title: "Verzendmethode bijgewerkt",
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
        .from("shipping_methods")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipping-methods"] });
      toast({
        title: "Verzendmethode verwijderd",
        description: "De verzendmethode is verwijderd.",
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

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("shipping_methods")
        .update({ is_active })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipping-methods"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Fout",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    shippingMethods,
    isLoading,
    error,
    createShippingMethod: createMutation.mutateAsync,
    updateShippingMethod: updateMutation.mutateAsync,
    deleteShippingMethod: deleteMutation.mutateAsync,
    toggleActive: toggleActiveMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};
