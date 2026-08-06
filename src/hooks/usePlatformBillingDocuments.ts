import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { invokeWithErrorBody } from '@/lib/invokeWithErrorBody';
import { TenantContext } from '@/hooks/useTenant';

export interface PlatformBillingInvoice {
  id: string;
  invoice_number: string | null;
  status: string;
  total: number;
  issue_date: string | null;
  paid_at: string | null;
  has_pdf: boolean;
  credited_by: string[];
}

export interface PlatformBillingCreditNote {
  id: string;
  credit_note_number: string | null;
  total: number;
  issue_date: string | null;
  original_invoice_id: string | null;
  original_invoice_number: string | null;
  has_pdf: boolean;
}

export interface PlatformBillingPaymentRequest {
  id: string;
  payment_request_number: string | null;
  total: number;
  due_date: string | null;
  checkout_session_url: string | null;
  has_pdf: boolean;
  status: string;
  cycle_type: 'recurring' | 'proration' | string;
  description: string | null;
}

export interface PlatformBillingDocuments {
  success: boolean;
  invoices: PlatformBillingInvoice[];
  credit_notes: PlatformBillingCreditNote[];
  payment_requests: PlatformBillingPaymentRequest[];
}

/**
 * 2a·4 — the invoices, credit notes and open payment requests of the tenant's
 * own SellQo subscription. They live on the internal SellQo tenant with the
 * tenant as customer, so tenant-scoped RLS makes them unreachable from the
 * client: everything goes through the service-role edge function.
 */
export function usePlatformBillingDocuments(options?: { poll?: boolean }) {
  const tenantContext = useContext(TenantContext);
  const tenantId = tenantContext?.currentTenant?.id ?? null;

  return useQuery({
    queryKey: ['platform-billing-documents', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      return await invokeWithErrorBody<PlatformBillingDocuments>('get-platform-billing-status', {
        body: { tenant_id: tenantId, action: 'documents' },
      });
    },
    enabled: !!tenantId,
    // PAY-UX-1 — poll while an open payment request is pending (read-only).
    refetchInterval: options?.poll ? 5000 : false,
    refetchOnWindowFocus: true,
  });
}
