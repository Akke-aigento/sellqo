import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "./useTenant";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import type {
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderFormData,
  PurchaseOrderStatus,
} from "@/types/supplier";

export function usePurchaseOrders(filters?: {
  status?: PurchaseOrderStatus | PurchaseOrderStatus[];
  supplierId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["purchase-orders", currentTenant?.id, filters],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      let query = supabase
        .from("purchase_orders")
        .select(`
          *,
          supplier:suppliers(id, name, email)
        `)
        .eq("tenant_id", currentTenant.id)
        .order("created_at", { ascending: false });

      if (filters?.status) {
        if (Array.isArray(filters.status)) {
          query = query.in("status", filters.status);
        } else {
          query = query.eq("status", filters.status);
        }
      }

      if (filters?.supplierId) {
        query = query.eq("supplier_id", filters.supplierId);
      }

      if (filters?.dateFrom) {
        query = query.gte("order_date", filters.dateFrom);
      }

      if (filters?.dateTo) {
        query = query.lte("order_date", filters.dateTo);
      }

      if (filters?.search) {
        query = query.ilike("order_number", `%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as (PurchaseOrder & { supplier: { id: string; name: string; email: string | null } })[];
    },
    enabled: !!currentTenant?.id,
  });
}

export function usePurchaseOrder(id: string | undefined) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["purchase-order", id],
    queryFn: async () => {
      if (!id || !currentTenant?.id) return null;

      const { data, error } = await supabase
        .from("purchase_orders")
        .select(`
          *,
          supplier:suppliers(*),
          items:purchase_order_items(
            *,
            product:products(id, name, sku)
          )
        `)
        .eq("id", id)
        .eq("tenant_id", currentTenant.id)
        .single();

      if (error) throw error;
      return data as unknown as PurchaseOrder & { 
        supplier: import("@/types/supplier").Supplier;
        items: (PurchaseOrderItem & { product: { id: string; name: string; sku: string | null } | null })[];
      };
    },
    enabled: !!id && !!currentTenant?.id,
  });
}

export function usePurchaseOrderMutations() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const generateOrderNumber = async (): Promise<string> => {
    if (!currentTenant?.id) throw new Error("No tenant selected");

    const { data, error } = await supabase.rpc("generate_po_number", {
      p_tenant_id: currentTenant.id,
    });

    if (error) throw error;
    return data as string;
  };

  const createPurchaseOrder = useMutation({
    mutationFn: async (data: PurchaseOrderFormData) => {
      if (!currentTenant?.id) throw new Error("No tenant selected");

      const orderNumber = await generateOrderNumber();

      // Calculate totals
      const subtotal = data.items.reduce(
        (sum, item) => sum + item.quantity_ordered * item.unit_price,
        0
      );
      const taxAmount = data.items.reduce(
        (sum, item) =>
          sum + item.quantity_ordered * item.unit_price * ((item.tax_rate || 21) / 100),
        0
      );
      const total = subtotal + taxAmount + (data.shipping_cost || 0);

      // Create order
      const { data: order, error: orderError } = await supabase
        .from("purchase_orders")
        .insert({
          tenant_id: currentTenant.id,
          supplier_id: data.supplier_id,
          order_number: orderNumber,
          order_date: data.order_date || new Date().toISOString().split("T")[0],
          expected_delivery_date: data.expected_delivery_date,
          shipping_cost: data.shipping_cost || 0,
          subtotal,
          tax_amount: taxAmount,
          total,
          notes: data.notes,
          internal_notes: data.internal_notes,
          created_by: user?.id,
          status: "draft",
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create items
      const items = data.items.map((item) => ({
        purchase_order_id: order.id,
        product_id: item.product_id,
        product_supplier_id: item.product_supplier_id,
        product_name: item.product_name,
        supplier_sku: item.supplier_sku,
        quantity_ordered: item.quantity_ordered,
        quantity_received: 0,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate || 21,
        line_total: item.quantity_ordered * item.unit_price,
        notes: item.notes,
      }));

      const { error: itemsError } = await supabase
        .from("purchase_order_items")
        .insert(items);

      if (itemsError) throw itemsError;

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast.success("Inkooporder aangemaakt");
    },
    onError: (error) => {
      toast.error("Fout bij aanmaken inkooporder: " + error.message);
    },
  });

  const updatePurchaseOrderStatus = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: PurchaseOrderStatus;
    }) => {
      const updates: Record<string, unknown> = { status };

      // Set timestamp based on status
      const now = new Date().toISOString();
      if (status === "sent") updates.sent_at = now;
      if (status === "confirmed") updates.confirmed_at = now;
      if (status === "shipped") updates.shipped_at = now;
      if (status === "received" || status === "partially_received")
        updates.received_at = now;
      if (status === "cancelled") updates.cancelled_at = now;

      const { data, error } = await supabase
        .from("purchase_orders")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-order", variables.id] });
      toast.success("Status bijgewerkt");
    },
    onError: (error) => {
      toast.error("Fout bij bijwerken status: " + error.message);
    },
  });

  const updateItemReceivedQuantity = useMutation({
    mutationFn: async ({
      itemId,
      quantityReceived,
      orderId,
    }: {
      itemId: string;
      quantityReceived: number;
      orderId: string;
    }) => {
      const { error } = await supabase
        .from("purchase_order_items")
        .update({ quantity_received: quantityReceived })
        .eq("id", itemId);

      if (error) throw error;

      // Check if all items are fully received
      const { data: items } = await supabase
        .from("purchase_order_items")
        .select("quantity_ordered, quantity_received")
        .eq("purchase_order_id", orderId);

      if (items) {
        const allReceived = items.every(
          (item) => item.quantity_received >= item.quantity_ordered
        );
        const someReceived = items.some((item) => item.quantity_received > 0);

        let newStatus: PurchaseOrderStatus;
        if (allReceived) {
          newStatus = "received";
        } else if (someReceived) {
          newStatus = "partially_received";
        } else {
          return;
        }

        await supabase
          .from("purchase_orders")
          .update({ status: newStatus, received_at: new Date().toISOString() })
          .eq("id", orderId);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-order", variables.orderId] });
      toast.success("Ontvangst geregistreerd");
    },
    onError: (error) => {
      toast.error("Fout bij registreren ontvangst: " + error.message);
    },
  });

  const deletePurchaseOrder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("purchase_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast.success("Inkooporder verwijderd");
    },
    onError: (error) => {
      toast.error("Fout bij verwijderen inkooporder: " + error.message);
    },
  });

  return {
    createPurchaseOrder,
    updatePurchaseOrderStatus,
    updateItemReceivedQuantity,
    deletePurchaseOrder,
  };
}

export function usePurchaseOrderStats() {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["purchase-order-stats", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;

      const { data, error } = await supabase
        .from("purchase_orders")
        .select("status, total")
        .eq("tenant_id", currentTenant.id);

      if (error) throw error;

      const stats = {
        draft: 0,
        pending: 0,
        inTransit: 0,
        received: 0,
        totalValue: 0,
        pendingValue: 0,
      };

      data.forEach((order) => {
        if (order.status === "draft") stats.draft++;
        if (["sent", "confirmed"].includes(order.status)) {
          stats.pending++;
          stats.pendingValue += order.total || 0;
        }
        if (["shipped", "partially_received"].includes(order.status)) {
          stats.inTransit++;
        }
        if (order.status === "received") stats.received++;
        stats.totalValue += order.total || 0;
      });

      return stats;
    },
    enabled: !!currentTenant?.id,
  });
}
