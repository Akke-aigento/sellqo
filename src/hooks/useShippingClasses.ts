import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import type {
  ShippingClassWithCounts,
  ShippingClassFormData,
} from "@/types/shipping";

/**
 * SHIP-CLASS-2 — verzendklassen als echte entiteit.
 * Levert de klassen van de actieve tenant plus het aantal gekoppelde
 * verzendmethodes en producten (nodig om verwijderen te blokkeren).
 */
export const useShippingClasses = () => {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  const { data: shippingClasses = [], isLoading } = useQuery({
    queryKey: ["shipping-classes", tenantId],
    queryFn: async (): Promise<ShippingClassWithCounts[]> => {
      if (!tenantId) return [];

      const [classesRes, methodsRes, specsRes] = await Promise.all([
        supabase
          .from("shipping_classes")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
        supabase
          .from("shipping_methods")
          .select("shipping_class_id")
          .eq("tenant_id", tenantId)
          .not("shipping_class_id", "is", null),
        supabase
          .from("product_specifications")
          .select("shipping_class_id")
          .eq("tenant_id", tenantId)
          .not("shipping_class_id", "is", null),
      ]);

      if (classesRes.error) throw classesRes.error;

      const countBy = (rows: { shipping_class_id: string | null }[] | null) => {
        const map = new Map<string, number>();
        (rows || []).forEach((r) => {
          if (!r.shipping_class_id) return;
          map.set(r.shipping_class_id, (map.get(r.shipping_class_id) || 0) + 1);
        });
        return map;
      };

      const methodCounts = countBy(methodsRes.data as any);
      const productCounts = countBy(specsRes.data as any);

      return (classesRes.data || []).map((c) => ({
        ...c,
        method_count: methodCounts.get(c.id) || 0,
        product_count: productCounts.get(c.id) || 0,
      })) as ShippingClassWithCounts[];
    },
    enabled: !!tenantId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["shipping-classes"] });
    queryClient.invalidateQueries({ queryKey: ["shipping-methods"] });
  };

  const createMutation = useMutation({
    mutationFn: async (form: ShippingClassFormData) => {
      if (!tenantId) throw new Error("Geen tenant geselecteerd");
      const { data, error } = await supabase
        .from("shipping_classes")
        .insert({
          tenant_id: tenantId,
          name: form.name.trim(),
          description: form.description?.trim() || null,
          sort_order: form.sort_order ?? 0,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Verzendklasse aangemaakt" });
    },
    onError: (error: Error) => {
      const duplicate = error.message.includes("duplicate key");
      toast({
        title: "Fout bij aanmaken",
        description: duplicate
          ? "Er bestaat al een verzendklasse met deze naam."
          : error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data: form,
    }: {
      id: string;
      data: ShippingClassFormData;
    }) => {
      const { data, error } = await supabase
        .from("shipping_classes")
        .update({
          name: form.name.trim(),
          description: form.description?.trim() || null,
          sort_order: form.sort_order ?? 0,
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Verzendklasse bijgewerkt" });
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
      const cls = shippingClasses.find((c) => c.id === id);
      if (cls && (cls.method_count > 0 || cls.product_count > 0)) {
        throw new Error(
          `Deze verzendklasse is nog gekoppeld aan ${cls.method_count} verzendmethode(s) en ${cls.product_count} product(en). Koppel die eerst los.`,
        );
      }
      const { error } = await supabase
        .from("shipping_classes")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Verzendklasse verwijderd" });
    },
    onError: (error: Error) => {
      toast({
        title: "Verwijderen niet mogelijk",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    shippingClasses,
    isLoading,
    createShippingClass: createMutation.mutateAsync,
    updateShippingClass: updateMutation.mutateAsync,
    deleteShippingClass: deleteMutation.mutateAsync,
    isSaving: createMutation.isPending || updateMutation.isPending,
  };
};

/**
 * Producten koppelen aan (of loskoppelen van) een verzendklasse via
 * `product_specifications.shipping_class_id`.
 */
export const useShippingClassProducts = (shippingClassId?: string | null) => {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["shipping-class-products", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, product_specifications(shipping_class_id)")
        .eq("tenant_id", tenantId)
        .order("name", { ascending: true })
        .limit(2000);
      if (error) throw error;
      return (data || []).map((p: any) => ({
        id: p.id as string,
        name: p.name as string,
        sku: (p.sku as string | null) ?? null,
        shipping_class_id:
          (Array.isArray(p.product_specifications)
            ? p.product_specifications[0]?.shipping_class_id
            : p.product_specifications?.shipping_class_id) ?? null,
      }));
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async (selectedProductIds: string[]) => {
      if (!tenantId) throw new Error("Geen tenant geselecteerd");
      if (!shippingClassId) throw new Error("Geen verzendklasse geselecteerd");

      const products = data || [];
      const selected = new Set(selectedProductIds);
      const toLink = products.filter(
        (p) => selected.has(p.id) && p.shipping_class_id !== shippingClassId,
      );
      const toUnlink = products.filter(
        (p) => !selected.has(p.id) && p.shipping_class_id === shippingClassId,
      );

      let failed = 0;
      for (const p of toLink) {
        const { error } = await supabase
          .from("product_specifications")
          .upsert(
            {
              product_id: p.id,
              tenant_id: tenantId,
              shipping_class_id: shippingClassId,
            },
            { onConflict: "product_id" },
          )
          .select("id");
        if (error) {
          console.error("[SHIP-CLASS-2] koppelen mislukt", p.id, error);
          failed++;
        }
      }
      for (const p of toUnlink) {
        const { error } = await supabase
          .from("product_specifications")
          .update({ shipping_class_id: null })
          .eq("product_id", p.id)
          .eq("tenant_id", tenantId)
          .select("id");
        if (error) {
          console.error("[SHIP-CLASS-2] loskoppelen mislukt", p.id, error);
          failed++;
        }
      }

      return { linked: toLink.length, unlinked: toUnlink.length, failed };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["shipping-class-products"] });
      queryClient.invalidateQueries({ queryKey: ["shipping-classes"] });
      queryClient.invalidateQueries({ queryKey: ["product-specifications"] });
      if (res.failed > 0) {
        toast({
          title: "Deels mislukt",
          description: `${res.failed} product(en) konden niet worden bijgewerkt.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Producten bijgewerkt",
          description: `${res.linked} gekoppeld, ${res.unlinked} losgekoppeld.`,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Fout bij koppelen",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    products: data || [],
    isLoading,
    saveSelection: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  };
};