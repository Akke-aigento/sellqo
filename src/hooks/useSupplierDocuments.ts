import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "./useTenant";
import { toast } from "sonner";
import type {
  SupplierDocument,
  SupplierDocumentFormData,
  SupplierDocumentType,
  SupplierPaymentStatus,
} from "@/types/supplier";

export function useSupplierDocuments(filters?: {
  supplierId?: string;
  purchaseOrderId?: string;
  documentType?: SupplierDocumentType | SupplierDocumentType[];
  paymentStatus?: SupplierPaymentStatus | SupplierPaymentStatus[];
  dateFrom?: string;
  dateTo?: string;
}) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["supplier-documents", currentTenant?.id, filters],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      let query = supabase
        .from("supplier_documents")
        .select(`
          *,
          supplier:suppliers(id, name),
          purchase_order:purchase_orders(id, order_number)
        `)
        .eq("tenant_id", currentTenant.id)
        .order("created_at", { ascending: false });

      if (filters?.supplierId) {
        query = query.eq("supplier_id", filters.supplierId);
      }

      if (filters?.purchaseOrderId) {
        query = query.eq("purchase_order_id", filters.purchaseOrderId);
      }

      if (filters?.documentType) {
        if (Array.isArray(filters.documentType)) {
          query = query.in("document_type", filters.documentType);
        } else {
          query = query.eq("document_type", filters.documentType);
        }
      }

      if (filters?.paymentStatus) {
        if (Array.isArray(filters.paymentStatus)) {
          query = query.in("payment_status", filters.paymentStatus);
        } else {
          query = query.eq("payment_status", filters.paymentStatus);
        }
      }

      if (filters?.dateFrom) {
        query = query.gte("document_date", filters.dateFrom);
      }

      if (filters?.dateTo) {
        query = query.lte("document_date", filters.dateTo);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as SupplierDocument[];
    },
    enabled: !!currentTenant?.id,
  });
}

export function useSupplierDocumentMutations() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();

  const uploadDocument = useMutation({
    mutationFn: async ({
      file,
      data,
    }: {
      file: File;
      data: SupplierDocumentFormData;
    }) => {
      if (!currentTenant?.id) throw new Error("No tenant selected");

      // Upload file to storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const storagePath = `${currentTenant.id}/${data.supplier_id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("supplier-documents")
        .upload(storagePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("supplier-documents")
        .getPublicUrl(storagePath);

      // Create document record
      const { data: document, error: dbError } = await supabase
        .from("supplier_documents")
        .insert({
          tenant_id: currentTenant.id,
          supplier_id: data.supplier_id,
          purchase_order_id: data.purchase_order_id,
          document_type: data.document_type,
          document_number: data.document_number,
          document_date: data.document_date,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_size: file.size,
          mime_type: file.type,
          storage_path: storagePath,
          amount: data.amount,
          tax_amount: data.tax_amount,
          total_amount: data.total_amount,
          due_date: data.due_date,
          notes: data.notes,
        })
        .select()
        .single();

      if (dbError) throw dbError;
      return document;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-documents"] });
      toast.success("Document geüpload");
    },
    onError: (error) => {
      toast.error("Fout bij uploaden document: " + error.message);
    },
  });

  const updateDocument = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<SupplierDocumentFormData> & {
        payment_status?: SupplierPaymentStatus;
        paid_amount?: number;
        paid_at?: string;
      };
    }) => {
      const { data: document, error } = await supabase
        .from("supplier_documents")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return document;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-documents"] });
      toast.success("Document bijgewerkt");
    },
    onError: (error) => {
      toast.error("Fout bij bijwerken document: " + error.message);
    },
  });

  const deleteDocument = useMutation({
    mutationFn: async (id: string) => {
      // Get storage path first
      const { data: doc } = await supabase
        .from("supplier_documents")
        .select("storage_path")
        .eq("id", id)
        .single();

      // Delete from storage if exists
      if (doc?.storage_path) {
        await supabase.storage.from("supplier-documents").remove([doc.storage_path]);
      }

      // Delete record
      const { error } = await supabase.from("supplier_documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-documents"] });
      toast.success("Document verwijderd");
    },
    onError: (error) => {
      toast.error("Fout bij verwijderen document: " + error.message);
    },
  });

  const markAsPaid = useMutation({
    mutationFn: async ({
      id,
      paidAmount,
    }: {
      id: string;
      paidAmount?: number;
    }) => {
      const { data: doc } = await supabase
        .from("supplier_documents")
        .select("total_amount, paid_amount")
        .eq("id", id)
        .single();

      const newPaidAmount = paidAmount ?? doc?.total_amount ?? 0;
      const totalAmount = doc?.total_amount ?? 0;

      let paymentStatus: SupplierPaymentStatus = "paid";
      if (newPaidAmount < totalAmount && newPaidAmount > 0) {
        paymentStatus = "partial";
      } else if (newPaidAmount <= 0) {
        paymentStatus = "pending";
      }

      const { error } = await supabase
        .from("supplier_documents")
        .update({
          paid_amount: newPaidAmount,
          paid_at: new Date().toISOString(),
          payment_status: paymentStatus,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-documents"] });
      toast.success("Betaling geregistreerd");
    },
    onError: (error) => {
      toast.error("Fout bij registreren betaling: " + error.message);
    },
  });

  return { uploadDocument, updateDocument, deleteDocument, markAsPaid };
}

export function useSupplierDocumentStats() {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["supplier-document-stats", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;

      const { data, error } = await supabase
        .from("supplier_documents")
        .select("document_type, payment_status, total_amount, due_date")
        .eq("tenant_id", currentTenant.id);

      if (error) throw error;

      const today = new Date().toISOString().split("T")[0];

      const stats = {
        totalInvoices: 0,
        openInvoicesAmount: 0,
        overdueAmount: 0,
        overdueCount: 0,
        paidThisMonth: 0,
      };

      data.forEach((doc) => {
        if (doc.document_type === "invoice") {
          stats.totalInvoices++;

          if (["pending", "partial"].includes(doc.payment_status)) {
            stats.openInvoicesAmount += doc.total_amount || 0;

            if (doc.due_date && doc.due_date < today) {
              stats.overdueAmount += doc.total_amount || 0;
              stats.overdueCount++;
            }
          }
        }
      });

      return stats;
    },
    enabled: !!currentTenant?.id,
  });
}
