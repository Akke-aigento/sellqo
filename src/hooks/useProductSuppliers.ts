import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "./useTenant";
import { toast } from "sonner";
import type { ProductSupplier, ProductSupplierFormData } from "@/types/supplier";

export function useProductSuppliers(filters?: {
  productId?: string;
  supplierId?: string;
}) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["product-suppliers", currentTenant?.id, filters],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      let query = supabase
        .from("product_suppliers")
        .select(`
          *,
          supplier:suppliers(id, name, email, is_active),
          product:products(id, name, sku, image_url, stock_quantity, price)
        `)
        .eq("tenant_id", currentTenant.id);

      if (filters?.productId) {
        query = query.eq("product_id", filters.productId);
      }

      if (filters?.supplierId) {
        query = query.eq("supplier_id", filters.supplierId);
      }

      const { data, error } = await query.order("is_primary", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as ProductSupplier[];
    },
    enabled: !!currentTenant?.id,
  });
}

export function useProductSupplierMutations() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();

  const createProductSupplier = useMutation({
    mutationFn: async (data: ProductSupplierFormData) => {
      if (!currentTenant?.id) throw new Error("No tenant selected");

      // If setting as primary, unset other primaries first
      if (data.is_primary) {
        await supabase
          .from("product_suppliers")
          .update({ is_primary: false })
          .eq("tenant_id", currentTenant.id)
          .eq("product_id", data.product_id);
      }

      const { data: productSupplier, error } = await supabase
        .from("product_suppliers")
        .insert({
          ...data,
          tenant_id: currentTenant.id,
        })
        .select()
        .single();

      if (error) throw error;
      return productSupplier;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-suppliers"] });
      toast.success("Leverancierskoppeling aangemaakt");
    },
    onError: (error) => {
      if (error.message.includes("duplicate key")) {
        toast.error("Dit product is al gekoppeld aan deze leverancier");
      } else {
        toast.error("Fout bij aanmaken koppeling: " + error.message);
      }
    },
  });

  const updateProductSupplier = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<ProductSupplierFormData>;
    }) => {
      // If setting as primary, unset other primaries first
      if (data.is_primary) {
        const { data: current } = await supabase
          .from("product_suppliers")
          .select("product_id")
          .eq("id", id)
          .single();

        if (current) {
          await supabase
            .from("product_suppliers")
            .update({ is_primary: false })
            .eq("tenant_id", currentTenant?.id)
            .eq("product_id", current.product_id)
            .neq("id", id);
        }
      }

      const { data: productSupplier, error } = await supabase
        .from("product_suppliers")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return productSupplier;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-suppliers"] });
      toast.success("Leverancierskoppeling bijgewerkt");
    },
    onError: (error) => {
      toast.error("Fout bij bijwerken koppeling: " + error.message);
    },
  });

  const deleteProductSupplier = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-suppliers"] });
      toast.success("Leverancierskoppeling verwijderd");
    },
    onError: (error) => {
      toast.error("Fout bij verwijderen koppeling: " + error.message);
    },
  });

  const setPrimarySupplier = useMutation({
    mutationFn: async ({ id, productId }: { id: string; productId: string }) => {
      if (!currentTenant?.id) throw new Error("No tenant selected");

      // Unset all primaries for this product
      await supabase
        .from("product_suppliers")
        .update({ is_primary: false })
        .eq("tenant_id", currentTenant.id)
        .eq("product_id", productId);

      // Set the selected one as primary
      const { error } = await supabase
        .from("product_suppliers")
        .update({ is_primary: true })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-suppliers"] });
      toast.success("Primaire leverancier ingesteld");
    },
    onError: (error) => {
      toast.error("Fout bij instellen primaire leverancier: " + error.message);
    },
  });

  return {
    createProductSupplier,
    updateProductSupplier,
    deleteProductSupplier,
    setPrimarySupplier,
  };
}
