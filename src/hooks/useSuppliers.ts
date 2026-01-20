import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "./useTenant";
import { toast } from "sonner";
import type { Supplier, SupplierFormData } from "@/types/supplier";

export function useSuppliers(filters?: {
  search?: string;
  isActive?: boolean;
  tags?: string[];
}) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["suppliers", currentTenant?.id, filters],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      let query = supabase
        .from("suppliers")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .order("name");

      if (filters?.search) {
        query = query.or(
          `name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,contact_person.ilike.%${filters.search}%`
        );
      }

      if (filters?.isActive !== undefined) {
        query = query.eq("is_active", filters.isActive);
      }

      if (filters?.tags && filters.tags.length > 0) {
        query = query.overlaps("tags", filters.tags);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Supplier[];
    },
    enabled: !!currentTenant?.id,
  });
}

export function useSupplier(id: string | undefined) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["supplier", id],
    queryFn: async () => {
      if (!id || !currentTenant?.id) return null;

      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("id", id)
        .eq("tenant_id", currentTenant.id)
        .single();

      if (error) throw error;
      return data as Supplier;
    },
    enabled: !!id && !!currentTenant?.id,
  });
}

export function useSupplierMutations() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();

  const createSupplier = useMutation({
    mutationFn: async (data: SupplierFormData) => {
      if (!currentTenant?.id) throw new Error("No tenant selected");

      const { data: supplier, error } = await supabase
        .from("suppliers")
        .insert({
          ...data,
          tenant_id: currentTenant.id,
          tags: data.tags || [],
        })
        .select()
        .single();

      if (error) throw error;
      return supplier;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Leverancier aangemaakt");
    },
    onError: (error) => {
      toast.error("Fout bij aanmaken leverancier: " + error.message);
    },
  });

  const updateSupplier = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SupplierFormData> }) => {
      const { data: supplier, error } = await supabase
        .from("suppliers")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return supplier;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["supplier", variables.id] });
      toast.success("Leverancier bijgewerkt");
    },
    onError: (error) => {
      toast.error("Fout bij bijwerken leverancier: " + error.message);
    },
  });

  const deleteSupplier = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Leverancier verwijderd");
    },
    onError: (error) => {
      toast.error("Fout bij verwijderen leverancier: " + error.message);
    },
  });

  return { createSupplier, updateSupplier, deleteSupplier };
}

export function useSupplierStats() {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["supplier-stats", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;

      // Get supplier count
      const { count: totalSuppliers } = await supabase
        .from("suppliers")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", currentTenant.id);

      // Get active supplier count
      const { count: activeSuppliers } = await supabase
        .from("suppliers")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", currentTenant.id)
        .eq("is_active", true);

      // Get open invoices
      const { data: openInvoices } = await supabase
        .from("supplier_documents")
        .select("total_amount")
        .eq("tenant_id", currentTenant.id)
        .eq("document_type", "invoice")
        .in("payment_status", ["pending", "partial", "overdue"]);

      const openInvoicesTotal = openInvoices?.reduce(
        (sum, inv) => sum + (inv.total_amount || 0),
        0
      ) || 0;

      // Get pending orders count
      const { count: pendingOrders } = await supabase
        .from("purchase_orders")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", currentTenant.id)
        .in("status", ["sent", "confirmed", "shipped"]);

      return {
        totalSuppliers: totalSuppliers || 0,
        activeSuppliers: activeSuppliers || 0,
        openInvoicesTotal,
        openInvoicesCount: openInvoices?.length || 0,
        pendingOrders: pendingOrders || 0,
      };
    },
    enabled: !!currentTenant?.id,
  });
}
