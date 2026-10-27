// INKOOP-6 — instellingen van de facturen-inbox: afzenders controleren, afzenderlijst,
// beslissen over wachtende documenten en een overzicht van de bronnen.
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { SupplierDocumentSource } from "@/types/supplier";

export type InboxDecision = "approve" | "approve_sender" | "reject" | "block_sender";

export interface InboxSender {
  id: string;
  email: string;
  status: "approved" | "blocked";
  created_at: string;
}

export interface SourceSummary {
  source: SupplierDocumentSource;
  count: number;
  last: string | null;
}

const SOURCES: SupplierDocumentSource[] = ["email", "bol", "upload", "odoo_archive"];

/** Mag deze gebruiker de instellingen wijzigen (beheerder van de winkel of platformbeheer)? */
export function useCanManageInbox(tenantId: string | undefined): boolean {
  const { roles } = useAuth();
  return useMemo(
    () => !!tenantId && roles.some((r) => r.role === "platform_admin" || (r.role === "tenant_admin" && r.tenant_id === tenantId)),
    [roles, tenantId],
  );
}

export function useSupplierInbox(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["supplier-inbox", tenantId] });
    queryClient.invalidateQueries({ queryKey: ["supplier-documents"] });
    queryClient.invalidateQueries({ queryKey: ["supplier-document-stats"] });
  };

  const settings = useQuery({
    queryKey: ["supplier-inbox", tenantId, "settings"],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase.from("supplier_inbox_settings")
        .select("require_sender_approval").eq("tenant_id", tenantId).maybeSingle();
      if (error) throw error;
      // Geen rij = standaard: afzenders controleren.
      return { require_sender_approval: data?.require_sender_approval ?? true };
    },
  });

  const saveSettings = useMutation({
    mutationFn: async (patch: { require_sender_approval: boolean }) => {
      const { error } = await supabase.from("supplier_inbox_settings")
        .upsert({ tenant_id: tenantId as string, ...patch, updated_at: new Date().toISOString() }, { onConflict: "tenant_id" });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const senders = useQuery({
    queryKey: ["supplier-inbox", tenantId, "senders"],
    enabled: !!tenantId,
    queryFn: async (): Promise<InboxSender[]> => {
      const { data, error } = await supabase.from("supplier_inbox_senders")
        .select("id, email, status, created_at").eq("tenant_id", tenantId).order("email");
      if (error) throw error;
      return (data ?? []) as InboxSender[];
    },
  });

  const removeSender = useMutation({
    mutationFn: async (senderId: string) => {
      const { error } = await supabase.rpc("supplier_inbox_sender_remove", { p_sender_id: senderId });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const pendingCount = useQuery({
    queryKey: ["supplier-inbox", tenantId, "pending"],
    enabled: !!tenantId,
    queryFn: async () => {
      const { count, error } = await supabase.from("supplier_documents")
        .select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("review_status", "pending");
      if (error) throw error;
      return count ?? 0;
    },
  });

  return { settings, saveSettings, senders, removeSender, pendingCount };
}

/** Beslissen over een wachtend document (of alles van die afzender). */
export function useInboxReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ documentId, decision }: { documentId: string; decision: InboxDecision }) => {
      const { data, error } = await supabase.rpc("supplier_inbox_review", { p_document_id: documentId, p_decision: decision });
      if (error) throw error;
      return { count: Number(data ?? 0), decision };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-inbox"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-documents"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-document-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Per bron: hoeveel documenten en wanneer het laatste binnenkwam. Enkel geladen als het venster open is. */
export function useInboxSources(tenantId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["supplier-inbox", tenantId, "sources"],
    enabled: !!tenantId && enabled,
    queryFn: async (): Promise<SourceSummary[]> =>
      Promise.all(SOURCES.map(async (source) => {
        const { data, count, error } = await supabase.from("supplier_documents")
          .select("created_at", { count: "exact" }).eq("tenant_id", tenantId).eq("source", source)
          .order("created_at", { ascending: false }).limit(1);
        if (error) throw error;
        return { source, count: count ?? 0, last: data?.[0]?.created_at ?? null };
      })),
  });
}
